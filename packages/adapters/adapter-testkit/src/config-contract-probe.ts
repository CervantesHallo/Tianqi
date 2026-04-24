import type { RuntimeConfig } from "@tianqi/ports";
import type { ConfigVersion, Result } from "@tianqi/shared";

// ConfigContractProbe — testkit-only observation/mutation surface for ConfigPort adapters.
//
// The production ConfigPort exposes only one method, getActiveConfig(), which is insufficient
// to exercise the full set of invariants documented in 补充文档 §5 (versioning, preview, activate,
// rollback, audit trail, activation atomicity). This probe gives contract tests the minimum
// set of additional hooks required to assert those invariants without leaking Adapter
// internals into production code. Adapters advertise compliance by returning the
// `__configProbe: true` brand together with the listed methods.
//
// META-RULE M (testkit observation primitives) applies: every method here exists solely to
// let the contract suite assert something; nothing is a substitute for a real Port method.
// Production callers must never depend on ConfigContractProbe.

export type ConfigAuditCause = "activate" | "rollback";

// One entry in the activation audit trail. Adapter fixtures append an entry per successful
// activation or rollback; on audit-append failure the activation is rolled back so the
// audit trail and the active pointer never drift (see TQ-CON-007 in contracts).
export type ConfigAuditEntry = {
  readonly fromVersion: ConfigVersion | null;
  readonly toVersion: ConfigVersion;
  readonly at: string;
  readonly cause: ConfigAuditCause;
};

export type ConfigContractProbeError = {
  readonly message: string;
};

export type ConfigContractProbe = {
  readonly __configProbe: true;
  // Registers a new version with the given values. Returns the assigned monotonic
  // ConfigVersion. The new version is NOT automatically active; activate() must be called
  // separately. Preview-only persistence mirrors 补充文档 §5.3 "预览 ≠ 生效".
  preview(values: RuntimeConfig["values"]): ConfigVersion;
  // Flips the active pointer to the given version. Appends an audit entry with
  // cause="activate". If setAuditFailureMode(true) is on, the audit append fails and the
  // activation is rolled back; the returned Result carries TQ-CON-007.
  activate(version: ConfigVersion): Promise<Result<void, ConfigContractProbeError>>;
  // Flips the active pointer to a previously-previewed version. Appends an audit entry
  // with cause="rollback". Returns TQ-CON-006 if the target version was never previewed.
  rollback(version: ConfigVersion): Promise<Result<void, ConfigContractProbeError>>;
  // Reads a specific version's snapshot. Returns TQ-CON-006 when the version is unknown.
  getByVersion(version: ConfigVersion): Result<RuntimeConfig, ConfigContractProbeError>;
  // Returns an immutable snapshot of the activation audit trail in chronological order.
  getAuditTrail(): readonly ConfigAuditEntry[];
  // Toggles fault injection for audit-append: when true, the next activate()/rollback()
  // fails after the audit append and the active pointer is rolled back.
  setAuditFailureMode(enabled: boolean): void;
};
