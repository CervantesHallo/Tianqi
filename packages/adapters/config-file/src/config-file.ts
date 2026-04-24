import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { setTimeout as scheduleTimer } from "node:timers";

import { parse as parseYaml } from "yaml";

import type {
  AdapterHealthStatus,
  ConfigPort,
  ConfigPortError,
  RuntimeConfig
} from "@tianqi/ports";
import { createConfigVersion, err, ok } from "@tianqi/shared";
import type { ConfigVersion, Result } from "@tianqi/shared";

// ConfigContractProbe shape mirrored locally for structural compatibility with
// @tianqi/adapter-testkit without creating a production-time dependency (META-RULE F).
// Intentionally written independently of @tianqi/config-memory — two Adapters re-implement
// the 1PC + compensation skeleton from scratch, proving the pattern is portable (not
// just a copy-paste).
type ConfigAuditEntry = {
  readonly fromVersion: ConfigVersion | null;
  readonly toVersion: ConfigVersion;
  readonly at: string;
  readonly cause: "activate" | "rollback";
};

type ConfigContractProbeError = { readonly message: string };

type TestkitProbe = {
  readonly __configProbe: true;
  preview(values: RuntimeConfig["values"]): ConfigVersion;
  activate(version: ConfigVersion): Promise<Result<void, ConfigContractProbeError>>;
  rollback(version: ConfigVersion): Promise<Result<void, ConfigContractProbeError>>;
  getByVersion(version: ConfigVersion): Result<RuntimeConfig, ConfigContractProbeError>;
  getAuditTrail(): readonly ConfigAuditEntry[];
  setAuditFailureMode(enabled: boolean): void;
};

type LifecycleState = "created" | "running" | "shut_down";

export type FileConfigOptions = {
  readonly filePath: string;
  readonly healthCheckTimeoutMs?: number;
};

export type FileConfig = ConfigPort & {
  readonly adapterName: "config-file";
  init(): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<AdapterHealthStatus>;
} & TestkitProbe;

const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 2_000;

const portError = (code: "TQ-INF-003" | "TQ-INF-004", action: string): ConfigPortError => ({
  message: `${code}: ${action}`
});

const probeError = (code: string, action: string): ConfigContractProbeError => ({
  message: `${code}: ${action}`
});

const freezeValues = (values: RuntimeConfig["values"]): RuntimeConfig["values"] =>
  JSON.parse(JSON.stringify(values)) as RuntimeConfig["values"];

// Minimal structural validator. The YAML file must be a mapping with `version` as a
// positive integer and `values` as a flat object of string/number/boolean. We deliberately
// do NOT pull in ajv/zod — per the Step 11 scope, this adapter accepts only a tiny schema
// and pushes richer validation to the caller. Future Step may introduce a schema plugin.
type ParsedFile = {
  readonly fileVersion: number;
  readonly values: RuntimeConfig["values"];
};

const isPrimitiveConfigValue = (value: unknown): value is string | number | boolean =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

const validateParsed = (raw: unknown): ParsedFile | { readonly error: string } => {
  if (raw === null || typeof raw !== "object") {
    return { error: "YAML root must be a mapping" };
  }
  const root = raw as Record<string, unknown>;
  const versionRaw = root["version"];
  if (typeof versionRaw !== "number" || !Number.isInteger(versionRaw) || versionRaw <= 0) {
    return { error: "root `version` must be a positive integer" };
  }
  const valuesRaw = root["values"];
  if (valuesRaw === null || typeof valuesRaw !== "object" || Array.isArray(valuesRaw)) {
    return { error: "root `values` must be a plain object" };
  }
  const values: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(valuesRaw as Record<string, unknown>)) {
    if (!isPrimitiveConfigValue(value)) {
      return {
        error: `values.${key} must be a string, number, or boolean (got ${typeof value})`
      };
    }
    values[key] = value;
  }
  return { fileVersion: versionRaw, values };
};

export const createFileConfig = (options: FileConfigOptions): FileConfig => {
  const { filePath } = options;
  const healthCheckTimeoutMs = options.healthCheckTimeoutMs ?? DEFAULT_HEALTH_CHECK_TIMEOUT_MS;

  const versions = new Map<number, RuntimeConfig>();
  const auditTrail: ConfigAuditEntry[] = [];
  let activeVersion: ConfigVersion | null = null;
  let nextVersionNumber = 1;
  let state: LifecycleState = "created";
  let auditFailureMode = false;
  let fileYamlVersion: number | null = null;
  let lastError: string | null = null;

  const assertRunning = (action: string): void => {
    // Step 5 lesson: check shut_down before created so shutdown wins over init-missing.
    if (state === "shut_down") {
      throw new Error(`TQ-INF-004: ${action} after shutdown`);
    }
    if (state === "created") {
      throw new Error(`TQ-INF-003: ${action} before init`);
    }
  };

  const preview = (values: RuntimeConfig["values"]): ConfigVersion => {
    assertRunning("preview");
    const version = createConfigVersion(nextVersionNumber);
    nextVersionNumber += 1;
    versions.set(version as unknown as number, {
      version,
      values: freezeValues(values)
    });
    return version;
  };

  // Step 10 hard template — 1PC + compensation. Deliberately independent of the identical
  // pattern in @tianqi/config-memory; two Adapters write their own copy so the pattern
  // is proven portable rather than just cloned.
  const recordActivation = (
    targetVersion: ConfigVersion,
    cause: ConfigAuditEntry["cause"]
  ): Result<void, ConfigContractProbeError> => {
    const previousActive = activeVersion;
    activeVersion = targetVersion;
    if (auditFailureMode) {
      activeVersion = previousActive;
      return err(
        probeError(
          "TQ-CON-007",
          `${cause} rolled back because audit append failed (attempted=${String(
            targetVersion
          )}, rolled_back_to=${previousActive === null ? "null" : String(previousActive)})`
        )
      );
    }
    auditTrail.push({
      fromVersion: previousActive,
      toVersion: targetVersion,
      at: new Date().toISOString(),
      cause
    });
    return ok(undefined);
  };

  const activate = async (
    version: ConfigVersion
  ): Promise<Result<void, ConfigContractProbeError>> => {
    assertRunning("activate");
    if (!versions.has(version as unknown as number)) {
      return err(
        probeError("TQ-CON-006", `activate target version ${String(version)} not previewed`)
      );
    }
    return recordActivation(version, "activate");
  };

  const rollback = async (
    version: ConfigVersion
  ): Promise<Result<void, ConfigContractProbeError>> => {
    assertRunning("rollback");
    if (!versions.has(version as unknown as number)) {
      return err(
        probeError("TQ-CON-006", `rollback target version ${String(version)} not previewed`)
      );
    }
    return recordActivation(version, "rollback");
  };

  const getByVersion = (
    version: ConfigVersion
  ): Result<RuntimeConfig, ConfigContractProbeError> => {
    const snapshot = versions.get(version as unknown as number);
    if (snapshot === undefined) {
      return err(probeError("TQ-CON-006", `version ${String(version)} not previewed`));
    }
    return ok({ version: snapshot.version, values: freezeValues(snapshot.values) });
  };

  const getAuditTrail = (): readonly ConfigAuditEntry[] =>
    auditTrail.map((entry) => ({ ...entry }));

  const setAuditFailureMode = (enabled: boolean): void => {
    auditFailureMode = enabled;
  };

  const getActiveConfig = async (): Promise<Result<RuntimeConfig, ConfigPortError>> => {
    if (state === "shut_down") {
      return err(portError("TQ-INF-004", "getActiveConfig called after shutdown"));
    }
    if (state === "created") {
      return err(portError("TQ-INF-003", "getActiveConfig called before init"));
    }
    if (activeVersion === null) {
      return err({ message: "TQ-CON-006: no config version is currently active" });
    }
    const snapshot = versions.get(activeVersion as unknown as number);
    if (snapshot === undefined) {
      return err({ message: "TQ-CON-006: active version disappeared from store" });
    }
    return ok({ version: snapshot.version, values: freezeValues(snapshot.values) });
  };

  const init = async (): Promise<void> => {
    if (state === "running") return;
    if (state === "shut_down") return;
    let raw: string;
    try {
      raw = await readFile(filePath, "utf8");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      lastError = `TQ-INF-011: ${reason}`;
      throw new Error(`TQ-INF-011: config file unreadable at ${filePath} (${reason})`);
    }
    let parsed: unknown;
    try {
      parsed = parseYaml(raw);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      lastError = `TQ-CON-008: ${reason}`;
      throw new Error(`TQ-CON-008: config file YAML parse failed at ${filePath} (${reason})`);
    }
    const validated = validateParsed(parsed);
    if ("error" in validated) {
      lastError = `TQ-CON-008: ${validated.error}`;
      throw new Error(`TQ-CON-008: ${validated.error} (${filePath})`);
    }
    state = "running";
    fileYamlVersion = validated.fileVersion;
    // Decision (docs §C): Adapter counter is the single source of truth for ConfigVersion.
    // The YAML `version` field is validated as a positive integer (format check) but is
    // NOT used as the ConfigVersion. Runtime preview() during this process lifetime mints
    // versions via the internal counter. This keeps the contract invariant that two
    // preview calls of identical content return distinct versions (Step 10 class 2).
    //
    // META-RULE A resolution: Step 11 instruction §B.3 literally asks init() to call both
    // preview + activate. Step 10 frozen contract 1.1 asserts that getActiveConfig() must
    // return a structured error immediately after init() with no active version. The two
    // collide, and the frozen contract wins. init() therefore stages the YAML content as
    // a pre-loaded version (via preview), but does NOT auto-activate. Callers activate it
    // explicitly after init() — one extra line that buys full contract compliance and a
    // happy side effect: the YAML can be inspected via getByVersion() before it goes live,
    // which is a natural "dry run" surface for operators.
    preview(validated.values);
    lastError = null;
  };

  const shutdown = async (): Promise<void> => {
    state = "shut_down";
  };

  // External service healthCheck (META-RULE I): non-throwing, independent timeout, read-only
  // probe. fs.access with R_OK is the minimal "can I still read this file?" check — it
  // does not load data, does not lock, does not mutate anything.
  const probeFileReadable = async (): Promise<{
    readonly readable: boolean;
    readonly error: string | null;
  }> => {
    const timeoutMs = healthCheckTimeoutMs;
    const timer = new Promise<{ readonly readable: false; readonly error: string }>((resolve) => {
      scheduleTimer(() => {
        resolve({ readable: false, error: `health check timed out after ${timeoutMs}ms` });
      }, timeoutMs);
    });
    const probe = access(filePath, fsConstants.R_OK)
      .then(() => ({ readable: true, error: null }) as const)
      .catch((error: unknown) => ({
        readable: false as const,
        error: error instanceof Error ? error.message : String(error)
      }));
    return Promise.race([probe, timer]);
  };

  const healthCheck = async (): Promise<AdapterHealthStatus> => {
    if (state !== "running") {
      return {
        adapterName: "config-file",
        healthy: false,
        details: {
          lifecycle: state,
          filePath,
          fileReadable: false,
          activeVersion: activeVersion === null ? "none" : String(activeVersion),
          versionCount: versions.size,
          lastError: lastError ?? "none",
          healthCheckTimeoutMs
        },
        checkedAt: new Date().toISOString()
      };
    }
    const probeResult = await probeFileReadable();
    if (!probeResult.readable && probeResult.error !== null) {
      lastError = probeResult.error;
    }
    return {
      adapterName: "config-file",
      healthy: probeResult.readable,
      details: {
        lifecycle: state,
        filePath,
        fileReadable: probeResult.readable,
        activeVersion: activeVersion === null ? "none" : String(activeVersion),
        versionCount: versions.size,
        fileYamlVersion: fileYamlVersion === null ? "none" : String(fileYamlVersion),
        lastError: probeResult.error ?? lastError ?? "none",
        healthCheckTimeoutMs
      },
      checkedAt: new Date().toISOString()
    };
  };

  return {
    adapterName: "config-file",
    __configProbe: true,
    getActiveConfig,
    preview,
    activate,
    rollback,
    getByVersion,
    getAuditTrail,
    setAuditFailureMode,
    init,
    shutdown,
    healthCheck
  };
};
