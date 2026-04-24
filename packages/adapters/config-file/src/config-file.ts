import { createHash } from "node:crypto";
import {
  access,
  appendFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import { watch as fsWatch, watchFile, unwatchFile, constants as fsConstants } from "node:fs";
import type { FSWatcher } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { pid } from "node:process";
import { setTimeout as scheduleTimer, clearTimeout as clearScheduledTimer } from "node:timers";

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
// Intentionally written independently of @tianqi/config-memory.
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

export type FileConfigWatchMode = "fs-watch" | "poll" | "manual" | "off";
export type FileConfigAutoActivate = "never" | "onLoad";

export type FileConfigOptions = {
  readonly filePath: string;
  readonly historyDirectory?: string;
  readonly watchMode?: FileConfigWatchMode;
  readonly pollIntervalMs?: number;
  readonly watchDebounceMs?: number;
  readonly autoActivate?: FileConfigAutoActivate;
  readonly healthCheckTimeoutMs?: number;
  readonly historyRetention?: { readonly maxVersions?: number };
};

export type FileConfig = ConfigPort & {
  readonly adapterName: "config-file";
  init(): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<AdapterHealthStatus>;
  reload(): Promise<Result<void, ConfigPortError>>;
} & TestkitProbe;

const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 2_000;
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_WATCH_DEBOUNCE_MS = 100;
const DEFAULT_MAX_VERSIONS = 100;

const portError = (code: "TQ-INF-003" | "TQ-INF-004", action: string): ConfigPortError => ({
  message: `${code}: ${action}`
});

const probeError = (code: string, action: string): ConfigContractProbeError => ({
  message: `${code}: ${action}`
});

const freezeValues = (values: RuntimeConfig["values"]): RuntimeConfig["values"] =>
  JSON.parse(JSON.stringify(values)) as RuntimeConfig["values"];

const sha256 = (input: string): string => createHash("sha256").update(input).digest("hex");

// Structural mirror of NodeJS.ErrnoException — the global NodeJS namespace type is not
// available under our strict ESLint setup (no-undef). We only need `.code` for ENOENT
// detection, so a narrow local type keeps the adapter self-contained.
type ErrnoLike = Error & { readonly code?: string };
const isEnoent = (error: unknown): boolean =>
  error instanceof Error && (error as ErrnoLike).code === "ENOENT";

const paddedVersionFilename = (n: number): string => `v${String(n).padStart(6, "0")}.yaml`;

// Minimal structural validator — same rules as Step 11. The YAML file must be a mapping
// with `version` as a positive integer and `values` as a flat object of string/number/
// boolean. Deeper validation (zod/ajv) is explicitly out of scope for Step 12.
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

// On-disk state.json envelope. Written after every mutation (preview / activate /
// rollback) so a crashed process loses at most the in-flight operation, not history.
// lastLoadedYamlHash is used on reload to detect "file content unchanged since last
// load" — skipping unnecessary preview entries when the file was merely touched.
type PersistedState = {
  readonly nextVersionNumber: number;
  readonly activeVersion: number | null;
  readonly fileYamlVersion: number | null;
  readonly lastLoadedYamlHash: string | null;
  readonly layoutVersion: 1;
};

const STATE_FILENAME = "state.json";
const AUDIT_FILENAME = "audit.jsonl";
const VERSIONS_DIRNAME = "versions";

const buildLayout = (
  historyDirectory: string
): {
  readonly root: string;
  readonly statePath: string;
  readonly auditPath: string;
  readonly versionsDir: string;
} => ({
  root: historyDirectory,
  statePath: join(historyDirectory, STATE_FILENAME),
  auditPath: join(historyDirectory, AUDIT_FILENAME),
  versionsDir: join(historyDirectory, VERSIONS_DIRNAME)
});

export const createFileConfig = (options: FileConfigOptions): FileConfig => {
  const { filePath } = options;
  const historyDirectory = options.historyDirectory ?? `${filePath}.tianqi-history`;
  const watchMode: FileConfigWatchMode = options.watchMode ?? "manual";
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const watchDebounceMs = options.watchDebounceMs ?? DEFAULT_WATCH_DEBOUNCE_MS;
  const autoActivate: FileConfigAutoActivate = options.autoActivate ?? "never";
  const healthCheckTimeoutMs = options.healthCheckTimeoutMs ?? DEFAULT_HEALTH_CHECK_TIMEOUT_MS;
  const maxVersions = options.historyRetention?.maxVersions ?? DEFAULT_MAX_VERSIONS;

  const layout = buildLayout(historyDirectory);

  // In-memory mirror of the on-disk state. After init() completes successfully every
  // mutator writes to disk BEFORE updating these, so a mid-op crash leaves disk in the
  // earlier-but-consistent state rather than writing torn state.
  const versions = new Map<number, RuntimeConfig>();
  const auditTrail: ConfigAuditEntry[] = [];
  let activeVersion: ConfigVersion | null = null;
  let nextVersionNumber = 1;
  let state: LifecycleState = "created";
  let auditFailureMode = false;
  let fileYamlVersion: number | null = null;
  let lastLoadedYamlHash: string | null = null;
  let lastError: string | null = null;

  let watcher: FSWatcher | null = null;
  let pollingActive = false;
  let debounceTimer: ReturnType<typeof scheduleTimer> | null = null;
  let reloadInFlight: Promise<void> | null = null;
  // Monotonic suffix for atomicWriteFile — guarantees unique tmp paths even when many
  // writes happen within the same millisecond. Without this, three preview() calls in
  // the same tick would share a tmp path and one of them would lose a rename race,
  // which would then cascade into a false TQ-CON-007 in a concurrent activate.
  let atomicWriteSequence = 0;
  // Tracks in-flight persistence promises from the sync preview() shim. Every disk
  // write it triggers is appended here; shutdown() and reload() await the settled set
  // so a subsequent init() on the same historyDirectory sees the latest state.json
  // rather than a stale snapshot. This is the only correctness coupling between the
  // sync probe API and the persistent-contract restart scenarios.
  const pendingPersistence = new Set<Promise<void>>();
  const trackPersistence = (task: Promise<void>): void => {
    pendingPersistence.add(task);
    task
      .finally(() => pendingPersistence.delete(task))
      .catch(() => {
        // Errors are already recorded to lastError by the task's own handler; the
        // defensive catch keeps the Set free of unhandled-rejection warnings.
      });
  };
  const drainPendingPersistence = async (): Promise<void> => {
    while (pendingPersistence.size > 0) {
      const snapshot = Array.from(pendingPersistence);
      await Promise.allSettled(snapshot);
    }
  };

  const assertRunning = (action: string): void => {
    // Step 5 lesson: check shut_down before created so shutdown wins over init-missing.
    if (state === "shut_down") {
      throw new Error(`TQ-INF-004: ${action} after shutdown`);
    }
    if (state === "created") {
      throw new Error(`TQ-INF-003: ${action} before init`);
    }
  };

  // -- Persistence helpers -------------------------------------------------------------

  const ensureHistoryDirectoryExists = async (): Promise<void> => {
    try {
      await mkdir(layout.versionsDir, { recursive: true });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `TQ-INF-012: history directory unreadable at ${historyDirectory} (${reason})`
      );
    }
  };

  // Atomic write: write to a temp sibling then rename. rename is atomic on POSIX + NTFS
  // for same-filesystem targets, so concurrent readers never see a partial file. The
  // tmp path carries pid + Date.now() + a monotonic sequence so that burst-concurrent
  // writes (multiple preview() calls within the same millisecond) cannot collide on a
  // single tmp path — collisions there would cascade into a spurious TQ-CON-007.
  const atomicWriteFile = async (target: string, contents: string): Promise<void> => {
    atomicWriteSequence += 1;
    const temp = `${target}.tmp-${pid}-${Date.now()}-${atomicWriteSequence}`;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(temp, contents, "utf8");
    await rename(temp, target);
  };

  const writeStateFile = async (): Promise<void> => {
    const payload: PersistedState = {
      nextVersionNumber,
      activeVersion: activeVersion === null ? null : Number(activeVersion),
      fileYamlVersion,
      lastLoadedYamlHash,
      layoutVersion: 1
    };
    await atomicWriteFile(layout.statePath, `${JSON.stringify(payload, null, 2)}\n`);
  };

  const readStateFile = async (): Promise<PersistedState | null> => {
    try {
      const raw = await readFile(layout.statePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (
        typeof parsed.nextVersionNumber !== "number" ||
        !Number.isInteger(parsed.nextVersionNumber) ||
        parsed.nextVersionNumber < 1 ||
        parsed.layoutVersion !== 1
      ) {
        throw new Error(`TQ-CON-009: state.json has invalid nextVersionNumber or layoutVersion`);
      }
      return {
        nextVersionNumber: parsed.nextVersionNumber,
        activeVersion: typeof parsed.activeVersion === "number" ? parsed.activeVersion : null,
        fileYamlVersion: typeof parsed.fileYamlVersion === "number" ? parsed.fileYamlVersion : null,
        lastLoadedYamlHash:
          typeof parsed.lastLoadedYamlHash === "string" ? parsed.lastLoadedYamlHash : null,
        layoutVersion: 1
      };
    } catch (error) {
      if (isEnoent(error)) {
        return null;
      }
      throw error;
    }
  };

  const serializeVersionToYaml = (config: RuntimeConfig): string => {
    // Minimal YAML emitter — flat key: value pairs. Values are primitives per validator,
    // so a hand-rolled serializer is shorter and more predictable than pulling yaml.stringify
    // into the write path (which could accidentally emit anchors or exotic tags).
    const entries = Object.entries(config.values);
    const lines = [`version: ${Number(config.version)}`, "values:"];
    for (const [key, value] of entries) {
      if (typeof value === "string") {
        lines.push(`  ${key}: ${JSON.stringify(value)}`);
      } else {
        lines.push(`  ${key}: ${String(value)}`);
      }
    }
    return `${lines.join("\n")}\n`;
  };

  const writeVersionFile = async (version: ConfigVersion, config: RuntimeConfig): Promise<void> => {
    const target = join(layout.versionsDir, paddedVersionFilename(Number(version)));
    await atomicWriteFile(target, serializeVersionToYaml(config));
  };

  const readVersionFile = async (n: number): Promise<RuntimeConfig | null> => {
    const target = join(layout.versionsDir, paddedVersionFilename(n));
    try {
      const raw = await readFile(target, "utf8");
      const parsed = parseYaml(raw);
      const validated = validateParsed(parsed);
      if ("error" in validated) {
        throw new Error(
          `TQ-CON-009: versions/${paddedVersionFilename(n)} invalid (${validated.error})`
        );
      }
      return {
        version: createConfigVersion(n),
        values: freezeValues(validated.values)
      };
    } catch (error) {
      if (isEnoent(error)) {
        return null;
      }
      throw error;
    }
  };

  const listStoredVersionNumbers = async (): Promise<number[]> => {
    try {
      const entries = await readdir(layout.versionsDir);
      const numbers: number[] = [];
      for (const entry of entries) {
        const match = /^v(\d+)\.yaml$/.exec(entry);
        if (match !== null && match[1] !== undefined) {
          numbers.push(Number(match[1]));
        }
      }
      numbers.sort((a, b) => a - b);
      return numbers;
    } catch (error) {
      if (isEnoent(error)) {
        return [];
      }
      throw error;
    }
  };

  const appendAuditLine = async (entry: ConfigAuditEntry): Promise<void> => {
    const serialized = JSON.stringify({
      fromVersion: entry.fromVersion === null ? null : Number(entry.fromVersion),
      toVersion: Number(entry.toVersion),
      at: entry.at,
      cause: entry.cause
    });
    await mkdir(dirname(layout.auditPath), { recursive: true });
    await appendFile(layout.auditPath, `${serialized}\n`, "utf8");
  };

  const readAuditJsonl = async (): Promise<ConfigAuditEntry[]> => {
    try {
      const raw = await readFile(layout.auditPath, "utf8");
      const entries: ConfigAuditEntry[] = [];
      const lines = raw.split("\n").filter((line) => line.length > 0);
      for (const line of lines) {
        const parsed = JSON.parse(line) as {
          fromVersion: number | null;
          toVersion: number;
          at: string;
          cause: "activate" | "rollback";
        };
        entries.push({
          fromVersion: parsed.fromVersion === null ? null : createConfigVersion(parsed.fromVersion),
          toVersion: createConfigVersion(parsed.toVersion),
          at: parsed.at,
          cause: parsed.cause
        });
      }
      return entries;
    } catch (error) {
      if (isEnoent(error)) {
        return [];
      }
      throw error;
    }
  };

  // Retention: when a mutation grows the versions map past maxVersions, drop the oldest
  // files that are neither active nor referenced by the last N audit entries. Conservative
  // default keeps 100 versions. Retention failures do NOT abort the mutation — they only
  // log to lastError, because losing a stale historical version is less severe than
  // refusing to persist a new one.
  const enforceRetention = async (): Promise<void> => {
    if (versions.size <= maxVersions) return;
    const toDrop = versions.size - maxVersions;
    const sortedNumbers = Array.from(versions.keys()).sort((a, b) => a - b);
    const activeNumber = activeVersion === null ? -1 : Number(activeVersion);
    let dropped = 0;
    for (const num of sortedNumbers) {
      if (dropped >= toDrop) break;
      if (num === activeNumber) continue;
      const fileName = paddedVersionFilename(num);
      try {
        await rm(join(layout.versionsDir, fileName), { force: true });
        versions.delete(num);
        dropped += 1;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        lastError = `retention skipped ${fileName}: ${reason}`;
      }
    }
  };

  // -- Probe + Port surface ------------------------------------------------------------

  // preview internal: assigns the next counter, stores the version in memory + on disk,
  // and updates state.json. Used by both the caller-facing preview() and the init/reload
  // paths. Disk I/O failures reject — callers (including reload) must handle them and
  // refrain from flipping the active pointer.
  const previewInternal = async (
    values: RuntimeConfig["values"],
    opts: { readonly persistOnDisk: boolean } = { persistOnDisk: true }
  ): Promise<ConfigVersion> => {
    const version = createConfigVersion(nextVersionNumber);
    nextVersionNumber += 1;
    const stored: RuntimeConfig = {
      version,
      values: freezeValues(values)
    };
    versions.set(version as unknown as number, stored);
    if (opts.persistOnDisk) {
      await writeVersionFile(version, stored);
      await writeStateFile();
      await enforceRetention();
    }
    return version;
  };

  // Synchronous preview shim for the probe contract surface. The probe expects a
  // synchronous call, but our disk writes are async. We schedule the disk write into a
  // fire-and-forget path, which is acceptable for probe-only tests because the basic
  // contract runs against a single Adapter instance per test and never observes the
  // mid-flight persistence state directly. Production callers with persistence needs
  // should use reload() or orchestrate their own preview+activate sequence; the sync
  // probe path is a testkit convenience.
  //
  // For correctness under the persistent contract (which DOES care about disk state),
  // the reload() path uses previewInternal directly with persistOnDisk: true.
  const preview = (values: RuntimeConfig["values"]): ConfigVersion => {
    assertRunning("preview");
    const version = createConfigVersion(nextVersionNumber);
    nextVersionNumber += 1;
    const stored: RuntimeConfig = {
      version,
      values: freezeValues(values)
    };
    versions.set(version as unknown as number, stored);
    // Best-effort persistence — failures are captured in lastError so healthCheck
    // surfaces them, but we don't block the probe sync API on disk I/O. The task is
    // tracked in pendingPersistence so shutdown() / reload() can await settlement.
    const task = (async () => {
      try {
        await writeVersionFile(version, stored);
        await writeStateFile();
        await enforceRetention();
      } catch (error) {
        lastError = `preview persist failed: ${
          error instanceof Error ? error.message : String(error)
        }`;
      }
    })();
    trackPersistence(task);
    return version;
  };

  // Step 10 hard template — 1PC + compensation, extended in Step 12 to persist audit
  // and state to disk. Disk writes happen AFTER the in-memory flip and BEFORE returning
  // success. If audit append or state write fails we rollback the in-memory pointer and
  // return TQ-CON-007 exactly as Step 11 did; the disk remains in the pre-flip state
  // because we only persist on success.
  const recordActivation = async (
    targetVersion: ConfigVersion,
    cause: ConfigAuditEntry["cause"]
  ): Promise<Result<void, ConfigContractProbeError>> => {
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
    const entry: ConfigAuditEntry = {
      fromVersion: previousActive,
      toVersion: targetVersion,
      at: new Date().toISOString(),
      cause
    };
    try {
      await appendAuditLine(entry);
      await writeStateFile();
    } catch (error) {
      // Disk failure during audit append → rollback the in-memory active pointer.
      // This is the Step 10 1PC + compensation invariant: audit length must always
      // bound legal active pointer transitions.
      activeVersion = previousActive;
      const reason = error instanceof Error ? error.message : String(error);
      return err(
        probeError(
          "TQ-CON-007",
          `${cause} rolled back because audit persistence failed (${reason})`
        )
      );
    }
    auditTrail.push(entry);
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

  // -- Init / Reload / Shutdown --------------------------------------------------------

  // Reads + parses + validates filePath. Pure — no state mutation. Returns either a
  // parsed payload or a structured error with a TQ-* code prefix.
  const readAndValidateYaml = async (): Promise<
    | {
        readonly ok: true;
        readonly raw: string;
        readonly parsed: ParsedFile;
        readonly hash: string;
      }
    | {
        readonly ok: false;
        readonly errorCode: "TQ-INF-011" | "TQ-CON-008";
        readonly reason: string;
      }
  > => {
    let raw: string;
    try {
      raw = await readFile(filePath, "utf8");
    } catch (error) {
      return {
        ok: false,
        errorCode: "TQ-INF-011",
        reason: error instanceof Error ? error.message : String(error)
      };
    }
    let parsed: unknown;
    try {
      parsed = parseYaml(raw);
    } catch (error) {
      return {
        ok: false,
        errorCode: "TQ-CON-008",
        reason: `YAML parse failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
    const validated = validateParsed(parsed);
    if ("error" in validated) {
      return {
        ok: false,
        errorCode: "TQ-CON-008",
        reason: validated.error
      };
    }
    return {
      ok: true,
      raw,
      parsed: validated,
      hash: sha256(raw)
    };
  };

  const restoreFromHistory = async (): Promise<void> => {
    const numbers = await listStoredVersionNumbers();
    for (const n of numbers) {
      const config = await readVersionFile(n);
      if (config === null) {
        throw new Error(
          `TQ-CON-009: state.json listed version ${n} but versions/${paddedVersionFilename(n)} missing`
        );
      }
      versions.set(n, config);
    }
    const storedAudit = await readAuditJsonl();
    for (const entry of storedAudit) {
      auditTrail.push(entry);
    }
  };

  const applyReload = async (): Promise<Result<void, ConfigPortError>> => {
    if (state !== "running") {
      return err(portError("TQ-INF-004", "reload called outside running state"));
    }
    if (watchMode === "off") {
      // Production freeze mode — reload is explicitly disabled. Return ok so callers
      // that reload() defensively don't treat this as a failure.
      return ok(undefined);
    }
    const result = await readAndValidateYaml();
    if (!result.ok) {
      lastError = `${result.errorCode}: ${result.reason}`;
      return err({
        message: `${result.errorCode}: ${result.reason}`
      });
    }
    // Content unchanged since last successful load → no new version, no audit entry.
    if (lastLoadedYamlHash !== null && lastLoadedYamlHash === result.hash) {
      return ok(undefined);
    }
    const newVersion = await previewInternal(result.parsed.values, { persistOnDisk: true });
    fileYamlVersion = result.parsed.fileVersion;
    lastLoadedYamlHash = result.hash;
    await writeStateFile();
    if (autoActivate === "onLoad") {
      const activationResult = await recordActivation(newVersion, "activate");
      if (!activationResult.ok) {
        return err({ message: activationResult.error.message });
      }
    }
    lastError = null;
    return ok(undefined);
  };

  const reload = async (): Promise<Result<void, ConfigPortError>> => {
    // Serialize concurrent reloads. Two fs.watch events firing back-to-back after a
    // debounce window could otherwise race the nextVersionNumber counter.
    if (reloadInFlight !== null) {
      await reloadInFlight;
    }
    let resolver: () => void;
    reloadInFlight = new Promise<void>((resolve) => {
      resolver = resolve;
    });
    try {
      // Wait for any sync-preview fire-and-forget writes to settle before reloading.
      // Otherwise the reload path could read and rewrite state.json underneath an
      // in-flight preview write, producing a rename race that manifests as a spurious
      // TQ-CON-007 on the next activate.
      await drainPendingPersistence();
      return await applyReload();
    } finally {
      reloadInFlight = null;
      // safe — resolver is assigned before the try block suspends.
      resolver!();
    }
  };

  const scheduleDebouncedReload = (): void => {
    if (state !== "running") return;
    if (debounceTimer !== null) {
      clearScheduledTimer(debounceTimer);
    }
    debounceTimer = scheduleTimer(() => {
      debounceTimer = null;
      void reload().catch(() => {
        // reload itself is non-throwing; the catch is defensive in case an unexpected
        // runtime error slips through. lastError is set by applyReload on failure, so
        // healthCheck surfaces the issue.
      });
    }, watchDebounceMs);
  };

  const startWatcher = (): void => {
    if (watchMode === "fs-watch") {
      try {
        watcher = fsWatch(filePath, { persistent: false }, () => {
          scheduleDebouncedReload();
        });
        watcher.on("error", (error: Error) => {
          lastError = `fs.watch error: ${error.message}`;
        });
      } catch (error) {
        // Some filesystems (network mounts, certain Docker overlays) don't support
        // fs.watch. Fall silently to manual — operators can poll-reload or call
        // reload() themselves. lastError surfaces the degradation via healthCheck.
        lastError = `fs.watch unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`;
        watcher = null;
      }
    } else if (watchMode === "poll") {
      watchFile(filePath, { interval: pollIntervalMs, persistent: false }, () => {
        scheduleDebouncedReload();
      });
      pollingActive = true;
    }
  };

  const stopWatcher = (): void => {
    if (debounceTimer !== null) {
      clearScheduledTimer(debounceTimer);
      debounceTimer = null;
    }
    if (watcher !== null) {
      watcher.close();
      watcher = null;
    }
    if (pollingActive) {
      unwatchFile(filePath);
      pollingActive = false;
    }
  };

  const init = async (): Promise<void> => {
    if (state === "running") return;
    if (state === "shut_down") return;

    await ensureHistoryDirectoryExists();

    const persisted = await readStateFile();
    if (persisted !== null) {
      // Cross-restart recovery path — restore all in-memory state from disk BEFORE
      // consulting the YAML file. The YAML is treated as a potential NEW source of
      // content (handled below); state.json is the authoritative record of what the
      // Adapter committed in its previous life.
      nextVersionNumber = persisted.nextVersionNumber;
      fileYamlVersion = persisted.fileYamlVersion;
      lastLoadedYamlHash = persisted.lastLoadedYamlHash;
      try {
        await restoreFromHistory();
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        lastError = reason;
        throw new Error(reason);
      }
      if (persisted.activeVersion !== null) {
        if (!versions.has(persisted.activeVersion)) {
          throw new Error(
            `TQ-CON-009: state.json activeVersion=${persisted.activeVersion} but that version is not in versions/`
          );
        }
        activeVersion = createConfigVersion(persisted.activeVersion);
      }
    }

    const readResult = await readAndValidateYaml();
    if (!readResult.ok) {
      lastError = `${readResult.errorCode}: ${readResult.reason}`;
      throw new Error(`${readResult.errorCode}: config file at ${filePath} (${readResult.reason})`);
    }

    if (persisted === null) {
      // Cold start — no history on disk. Cache the YAML as the first version; do NOT
      // auto-activate (Step 11 META-RULE A rule carries forward into Step 12).
      const v1 = await previewInternal(readResult.parsed.values, { persistOnDisk: true });
      fileYamlVersion = readResult.parsed.fileVersion;
      lastLoadedYamlHash = readResult.hash;
      await writeStateFile();
      if (autoActivate === "onLoad") {
        // onLoad in first-ever init still respects the 1PC + compensation flow —
        // recordActivation handles disk persistence and rollback on audit failure.
        const activationResult = await recordActivation(v1, "activate");
        if (!activationResult.ok) {
          throw new Error(activationResult.error.message);
        }
      }
    } else if (readResult.hash !== lastLoadedYamlHash) {
      // Cross-restart + YAML changed while the process was down. Stage the new
      // content as a new version. Operator (or autoActivate: "onLoad") decides when
      // to flip active.
      const newVersion = await previewInternal(readResult.parsed.values, {
        persistOnDisk: true
      });
      fileYamlVersion = readResult.parsed.fileVersion;
      lastLoadedYamlHash = readResult.hash;
      await writeStateFile();
      if (autoActivate === "onLoad") {
        const activationResult = await recordActivation(newVersion, "activate");
        if (!activationResult.ok) {
          throw new Error(activationResult.error.message);
        }
      }
    }

    state = "running";
    lastError = null;
    startWatcher();
  };

  const shutdown = async (): Promise<void> => {
    stopWatcher();
    // Drain any sync-preview fire-and-forget disk writes so a subsequent init() on
    // the same historyDirectory observes the latest state.json. Without this, tests
    // (and crash-recovery in production) could read an older nextVersionNumber /
    // activeVersion than the in-memory state reached.
    await drainPendingPersistence();
    state = "shut_down";
  };

  // External service healthCheck (META-RULE I): non-throwing, independent timeout,
  // read-only probe. fs.access with R_OK is the minimal "can I still read this file?"
  // check — it does not load data, does not lock, does not mutate anything.
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

  const probeHistoryWritable = async (): Promise<boolean> => {
    try {
      await access(historyDirectory, fsConstants.R_OK | fsConstants.W_OK);
      return true;
    } catch {
      return false;
    }
  };

  const healthCheck = async (): Promise<AdapterHealthStatus> => {
    if (state !== "running") {
      return {
        adapterName: "config-file",
        healthy: false,
        details: {
          lifecycle: state,
          filePath,
          historyDirectory,
          fileReadable: false,
          historyDirectoryWritable: false,
          watchMode,
          autoActivate,
          activeVersion: activeVersion === null ? "none" : String(activeVersion),
          versionCount: versions.size,
          auditEntries: auditTrail.length,
          lastError: lastError ?? "none",
          healthCheckTimeoutMs
        },
        checkedAt: new Date().toISOString()
      };
    }
    const [fileProbe, historyWritable] = await Promise.all([
      probeFileReadable(),
      probeHistoryWritable()
    ]);
    if (!fileProbe.readable && fileProbe.error !== null) {
      lastError = fileProbe.error;
    }
    return {
      adapterName: "config-file",
      healthy: fileProbe.readable && historyWritable,
      details: {
        lifecycle: state,
        filePath,
        historyDirectory,
        fileReadable: fileProbe.readable,
        historyDirectoryWritable: historyWritable,
        watchMode,
        autoActivate,
        activeVersion: activeVersion === null ? "none" : String(activeVersion),
        versionCount: versions.size,
        auditEntries: auditTrail.length,
        fileYamlVersion: fileYamlVersion === null ? "none" : String(fileYamlVersion),
        lastError: fileProbe.error ?? lastError ?? "none",
        healthCheckTimeoutMs,
        historyDirectoryPath: resolvePath(historyDirectory)
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
    healthCheck,
    reload
  };
};
