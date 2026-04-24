import type {
  AdapterFoundation,
  AdapterHealthStatus,
  ConfigPort,
  ConfigPortError,
  RuntimeConfig
} from "@tianqi/ports";
import { createConfigVersion, err, ok } from "@tianqi/shared";
import type { ConfigVersion, Result } from "@tianqi/shared";

import type {
  ConfigAuditEntry,
  ConfigContractProbe,
  ConfigContractProbeError
} from "../config-contract-probe.js";

type LifecycleState = "created" | "running" | "shut_down";

export type ReferenceConfig = ConfigPort & AdapterFoundation & ConfigContractProbe;

const portError = (code: "TQ-INF-003" | "TQ-INF-004", action: string): ConfigPortError => ({
  message: `${code}: ${action}`
});

const probeError = (code: string, action: string): ConfigContractProbeError => ({
  message: `${code}: ${action}`
});

// Deep-copies an object so the internal store is insulated from caller mutation. The
// RuntimeConfig.values shape is Record<string, string|number|boolean> — JSON-safe by
// construction, so JSON round-tripping is both sufficient and faster than structuredClone.
const freezeValues = (values: RuntimeConfig["values"]): RuntimeConfig["values"] =>
  JSON.parse(JSON.stringify(values)) as RuntimeConfig["values"];

export const createReferenceConfig = (): ReferenceConfig => {
  const store = new Map<number, RuntimeConfig>();
  const audit: ConfigAuditEntry[] = [];
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

  const preview: ConfigContractProbe["preview"] = (values) => {
    assertRunning("preview");
    // Monotonic numbering: even re-previewing identical content produces a new version.
    // No hidden dedup (补充文档 §5.3 "preview 不做内容去重，保持审计可追溯").
    const version = createConfigVersion(nextVersionNumber);
    nextVersionNumber += 1;
    store.set(version as unknown as number, {
      version,
      values: freezeValues(values)
    });
    return version;
  };

  const recordActivation = (
    targetVersion: ConfigVersion,
    cause: ConfigAuditEntry["cause"]
  ): Result<void, ConfigContractProbeError> => {
    const previousActive = activeVersion;
    activeVersion = targetVersion;
    // Audit-append happens AFTER the pointer flip. If fault injection is on, we roll
    // back the pointer to previousActive so the audit trail and active pointer stay
    // consistent (TQ-CON-007). Production Adapters achieve this atomicity via a
    // transaction; the reference fixture simulates it with a try/rollback pair.
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
    audit.push({
      fromVersion: previousActive,
      toVersion: targetVersion,
      at: new Date().toISOString(),
      cause
    });
    return ok(undefined);
  };

  const activate: ConfigContractProbe["activate"] = async (version) => {
    assertRunning("activate");
    if (!store.has(version as unknown as number)) {
      return err(
        probeError("TQ-CON-006", `activate target version ${String(version)} not previewed`)
      );
    }
    return recordActivation(version, "activate");
  };

  const rollback: ConfigContractProbe["rollback"] = async (version) => {
    assertRunning("rollback");
    if (!store.has(version as unknown as number)) {
      return err(
        probeError("TQ-CON-006", `rollback target version ${String(version)} not previewed`)
      );
    }
    return recordActivation(version, "rollback");
  };

  const getByVersion: ConfigContractProbe["getByVersion"] = (version) => {
    const snapshot = store.get(version as unknown as number);
    if (snapshot === undefined) {
      return err(probeError("TQ-CON-006", `version ${String(version)} not previewed`));
    }
    // Defensive copy on read: callers cannot mutate the store through the returned object.
    return ok({ version: snapshot.version, values: freezeValues(snapshot.values) });
  };

  const getAuditTrail: ConfigContractProbe["getAuditTrail"] = () =>
    audit.map((entry) => ({ ...entry }));

  const setAuditFailureMode: ConfigContractProbe["setAuditFailureMode"] = (enabled) => {
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
      // No version has been activated yet. Port contract returns a ConfigPortError rather
      // than a Result-ok-with-empty-config so callers must handle "no active config" explicitly.
      return err({
        message: "TQ-CON-006: no config version is currently active"
      });
    }
    const snapshot = store.get(activeVersion as unknown as number);
    if (snapshot === undefined) {
      // Unreachable under normal operation: activate()/rollback() guard against unknown
      // versions. Guarding here still catches storage corruption and surfaces it with a
      // structured message instead of throwing.
      return err({
        message: "TQ-CON-006: active version disappeared from store"
      });
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
    adapterName: "reference-config",
    healthy: state === "running",
    details: {
      lifecycle: state,
      activeVersion: activeVersion === null ? "none" : String(activeVersion),
      knownVersions: store.size,
      auditEntries: audit.length,
      auditFailureMode
    },
    checkedAt: new Date().toISOString()
  });

  return {
    adapterName: "reference-config",
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
