import type {
  AdapterHealthStatus,
  ConfigPort,
  ConfigPortError,
  RuntimeConfig
} from "@tianqi/ports";
import { createConfigVersion, err, ok } from "@tianqi/shared";
import type { ConfigVersion, Result } from "@tianqi/shared";

// Step 10 established ConfigContractProbe as a testkit-only observation surface. Adapters
// must not import @tianqi/adapter-testkit at production time (META-RULE F), so we declare
// the probe shape locally with structural compatibility — identical brand and method set,
// no cross-package type import. Only RuntimeConfig (Port shape) is shared with the testkit.
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

export type InMemoryConfigOptions = Readonly<Record<string, never>>;

export type InMemoryConfig = ConfigPort & {
  readonly adapterName: "config-memory";
  init(): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<AdapterHealthStatus>;
} & TestkitProbe;

const portError = (code: "TQ-INF-003" | "TQ-INF-004", action: string): ConfigPortError => ({
  message: `${code}: ${action}`
});

const probeError = (code: string, action: string): ConfigContractProbeError => ({
  message: `${code}: ${action}`
});

// RuntimeConfig.values is Record<string, string|number|boolean> — JSON-safe, so we use
// JSON round-trip for deep cloning. Deeper shapes would need structuredClone, but the
// Port's type narrows us to primitives.
const freezeValues = (values: RuntimeConfig["values"]): RuntimeConfig["values"] =>
  JSON.parse(JSON.stringify(values)) as RuntimeConfig["values"];

export const createInMemoryConfig = (_options?: InMemoryConfigOptions): InMemoryConfig => {
  const versions = new Map<number, RuntimeConfig>();
  const auditTrail: ConfigAuditEntry[] = [];
  let activeVersion: ConfigVersion | null = null;
  let nextVersionNumber = 1;
  let state: LifecycleState = "created";
  let auditFailureMode = false;

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
    // Contract from Step 10: preview never dedups by content hash. Two identical-content
    // preview calls produce two distinct version numbers so the audit trail is injective.
    const version = createConfigVersion(nextVersionNumber);
    nextVersionNumber += 1;
    versions.set(version as unknown as number, {
      version,
      values: freezeValues(values)
    });
    return version;
  };

  // Step 10 hard template — 1PC + compensation:
  //   1. Flip the active pointer to target
  //   2. Append the audit entry
  //   3. If audit fails (fault injection or real I/O), rollback the pointer to previous
  // The invariant is: audit trail length is always >= legal pointer transitions. The
  // active pointer never outruns the audit trail. config-memory implements this in a
  // single synchronous block because there is no external storage to coordinate with.
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
    // Defensive copy on read — callers cannot mutate the store through the returned value.
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
      // Unreachable: activate/rollback both guard against unknown versions. Still return
      // a structured error rather than throw so callers always see a Result.
      return err({ message: "TQ-CON-006: active version disappeared from store" });
    }
    return ok({ version: snapshot.version, values: freezeValues(snapshot.values) });
  };

  const init = async (): Promise<void> => {
    if (state === "running") return;
    if (state === "shut_down") return;
    state = "running";
  };

  const shutdown = async (): Promise<void> => {
    state = "shut_down";
  };

  const healthCheck = async (): Promise<AdapterHealthStatus> => ({
    adapterName: "config-memory",
    healthy: state === "running",
    details: {
      lifecycle: state,
      activeVersion: activeVersion === null ? "none" : String(activeVersion),
      versionCount: versions.size,
      auditEntries: auditTrail.length,
      auditFailureMode
    },
    checkedAt: new Date().toISOString()
  });

  return {
    adapterName: "config-memory",
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
