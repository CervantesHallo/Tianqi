import type { PolicyRegistryOperations } from "./policy-registry.js";
import type { PolicyConfigActivationRegistryOperations } from "./policy-config-activation-registry.js";
import type { PolicyConfigVersionAuditRegistryOperations } from "./policy-config-version-audit-record.js";
import type { PolicyConfigVersionAuditRecord } from "./policy-config-version-audit-record.js";
import type { ActivatePolicyConfigVersionCommand, PolicyConfigActivationResult } from "./policy-config-activation.js";
import type { RollbackPolicyConfigVersionCommand } from "./policy-config-rollback.js";
import type { PolicyBundleDiff } from "./policy-bundle-diff.js";
import type { PolicyConfigVersionReadView } from "./policy-config-version-read-view.js";
import { activatePolicyConfigVersion } from "./policy-config-activation.js";
import { rollbackToPreviousPolicyConfigVersion } from "./policy-config-rollback.js";
import { buildActivationAuditRecord, buildRollbackAuditRecord } from "./policy-config-version-audit-record.js";
import { diffPolicyConfigs } from "./policy-bundle-diff.js";
import { buildPolicyConfigVersionReadView } from "./policy-config-version-read-view.js";

export type PolicyConfigActivationOutcome = {
  readonly activationResult: PolicyConfigActivationResult;
  readonly auditRecord: PolicyConfigVersionAuditRecord;
  readonly bundleDiff: PolicyBundleDiff | null;
  readonly readView: PolicyConfigVersionReadView;
};

export const orchestratePolicyConfigActivation = (
  command: ActivatePolicyConfigVersionCommand,
  policyRegistry: PolicyRegistryOperations,
  activationRegistry: PolicyConfigActivationRegistryOperations,
  auditRegistry: PolicyConfigVersionAuditRegistryOperations,
  auditIdGenerator: () => string
): PolicyConfigActivationOutcome => {
  const previousActive = activationRegistry.getActiveVersion();

  const result = activatePolicyConfigVersion(command, policyRegistry, activationRegistry);

  let bundleDiff: PolicyBundleDiff | null = null;
  if (result.activationStatus === "activated" && previousActive) {
    const newActive = activationRegistry.getActiveVersion();
    if (newActive) {
      bundleDiff = diffPolicyConfigs(previousActive.config, newActive.config);
    }
  }

  const auditRecord = buildActivationAuditRecord(
    auditIdGenerator(), command.activatedBy, command.activatedAt, result, bundleDiff
  );
  auditRegistry.record(auditRecord);

  const readView = buildPolicyConfigVersionReadView(activationRegistry, auditRegistry);

  return { activationResult: result, auditRecord, bundleDiff, readView };
};

export const orchestratePolicyConfigRollback = (
  command: RollbackPolicyConfigVersionCommand,
  policyRegistry: PolicyRegistryOperations,
  activationRegistry: PolicyConfigActivationRegistryOperations,
  auditRegistry: PolicyConfigVersionAuditRegistryOperations,
  auditIdGenerator: () => string
): PolicyConfigActivationOutcome => {
  const currentActive = activationRegistry.getActiveVersion();

  const result = rollbackToPreviousPolicyConfigVersion(command, policyRegistry, activationRegistry);

  let bundleDiff: PolicyBundleDiff | null = null;
  if (result.activationStatus === "activated" && currentActive) {
    const newActive = activationRegistry.getActiveVersion();
    if (newActive) {
      bundleDiff = diffPolicyConfigs(currentActive.config, newActive.config);
    }
  }

  const auditRecord = buildRollbackAuditRecord(
    auditIdGenerator(), command.rolledBackBy, command.rolledBackAt, result, bundleDiff
  );
  auditRegistry.record(auditRecord);

  const readView = buildPolicyConfigVersionReadView(activationRegistry, auditRegistry);

  return { activationResult: result, auditRecord, bundleDiff, readView };
};
