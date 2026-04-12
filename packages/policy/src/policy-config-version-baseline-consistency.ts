import type { PolicyConfigActivationOutcome } from "./policy-config-activation-orchestrator.js";

export type PolicyConfigVersionBaselineConsistencyResult = {
  readonly passed: boolean;
  readonly violations: readonly string[];
};

export const assertPolicyConfigVersionBaselineConsistency = (
  outcome: PolicyConfigActivationOutcome
): PolicyConfigVersionBaselineConsistencyResult => {
  const violations: string[] = [];
  const { activationResult, auditRecord, bundleDiff, readView } = outcome;

  if (readView.currentActiveVersion !== activationResult.currentActiveVersion) {
    violations.push(
      `readView.currentActiveVersion (${readView.currentActiveVersion}) !== ` +
      `activationResult.currentActiveVersion (${activationResult.currentActiveVersion})`
    );
  }

  if (activationResult.activationStatus === "activated") {
    const expectedRollback = activationResult.previousActiveVersion !== null;
    if (readView.rollbackAvailable !== expectedRollback) {
      violations.push(
        `readView.rollbackAvailable (${readView.rollbackAvailable}) inconsistent ` +
        `with previousActiveVersion (${activationResult.previousActiveVersion})`
      );
    }
  }

  if (activationResult.activationStatus === "already_active" && bundleDiff !== null) {
    violations.push("already_active should not produce bundleDiff");
  }

  if (activationResult.activationStatus === "rejected") {
    if (activationResult.currentActiveVersion !== activationResult.previousActiveVersion) {
      violations.push(
        `rejected should not change active: current=${activationResult.currentActiveVersion} ` +
        `prev=${activationResult.previousActiveVersion}`
      );
    }
  }

  if (auditRecord.resultStatus !== activationResult.activationStatus) {
    violations.push(
      `audit.resultStatus (${auditRecord.resultStatus}) !== ` +
      `activationResult.activationStatus (${activationResult.activationStatus})`
    );
  }

  if (readView.lastAuditAction !== auditRecord.actionType) {
    violations.push(
      `readView.lastAuditAction (${readView.lastAuditAction}) !== ` +
      `auditRecord.actionType (${auditRecord.actionType})`
    );
  }

  if (bundleDiff !== null && activationResult.previousActiveVersion !== null) {
    if (bundleDiff.fromConfigVersion !== activationResult.previousActiveVersion) {
      violations.push(
        `bundleDiff.fromConfigVersion (${bundleDiff.fromConfigVersion}) !== ` +
        `previousActiveVersion (${activationResult.previousActiveVersion})`
      );
    }
    if (bundleDiff.toConfigVersion !== activationResult.currentActiveVersion) {
      violations.push(
        `bundleDiff.toConfigVersion (${bundleDiff.toConfigVersion}) !== ` +
        `currentActiveVersion (${activationResult.currentActiveVersion})`
      );
    }
  }

  return { passed: violations.length === 0, violations };
};
