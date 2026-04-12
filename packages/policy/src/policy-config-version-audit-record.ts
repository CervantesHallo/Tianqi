import type { PolicyConfigActivationStatus } from "./policy-config-activation.js";
import type { PolicyConfigActivationResult } from "./policy-config-activation.js";
import type { PolicyBundleDiff } from "./policy-bundle-diff.js";

export type PolicyConfigVersionAuditActionType = "activate" | "rollback";

export type PolicyConfigVersionAuditRecord = {
  readonly auditId: string;
  readonly actionType: PolicyConfigVersionAuditActionType;
  readonly fromVersion: string | null;
  readonly toVersion: string;
  readonly triggeredAt: string;
  readonly triggeredBy: string;
  readonly preflightStatus: boolean;
  readonly resultStatus: PolicyConfigActivationStatus;
  readonly summary: string;
  readonly bundleDiffSummary: string;
};

export type PolicyConfigVersionAuditRegistryOperations = {
  record(auditRecord: PolicyConfigVersionAuditRecord): void;
  getLatest(): PolicyConfigVersionAuditRecord | null;
  getLatestByTargetVersion(version: string): PolicyConfigVersionAuditRecord | null;
  listAll(): readonly PolicyConfigVersionAuditRecord[];
};

export const createPolicyConfigVersionAuditRegistry = (): PolicyConfigVersionAuditRegistryOperations => {
  const records: PolicyConfigVersionAuditRecord[] = [];

  return {
    record(auditRecord) {
      records.push(auditRecord);
    },

    getLatest() {
      return records.length > 0 ? records[records.length - 1]! : null;
    },

    getLatestByTargetVersion(version) {
      for (let i = records.length - 1; i >= 0; i--) {
        if (records[i]!.toVersion === version) return records[i]!;
      }
      return null;
    },

    listAll() {
      return [...records];
    }
  };
};

export const buildActivationAuditRecord = (
  auditId: string,
  triggeredBy: string,
  triggeredAt: string,
  result: PolicyConfigActivationResult,
  bundleDiff: PolicyBundleDiff | null
): PolicyConfigVersionAuditRecord => ({
  auditId,
  actionType: "activate",
  fromVersion: result.previousActiveVersion,
  toVersion: result.requestedVersion,
  triggeredAt,
  triggeredBy,
  preflightStatus: result.preflightStatus,
  resultStatus: result.activationStatus,
  summary: result.activationStatus === "activated"
    ? `Activated ${result.requestedVersion}` +
      (result.previousActiveVersion ? ` (from ${result.previousActiveVersion})` : " (initial)")
    : `Activation rejected for ${result.requestedVersion}: ${result.preflightSummary}`,
  bundleDiffSummary: bundleDiff?.diffSummary ?? "N/A (no previous version)"
});

export const buildRollbackAuditRecord = (
  auditId: string,
  triggeredBy: string,
  triggeredAt: string,
  result: PolicyConfigActivationResult,
  bundleDiff: PolicyBundleDiff | null
): PolicyConfigVersionAuditRecord => ({
  auditId,
  actionType: "rollback",
  fromVersion: result.previousActiveVersion,
  toVersion: result.requestedVersion || result.currentActiveVersion || "",
  triggeredAt,
  triggeredBy,
  preflightStatus: result.preflightStatus,
  resultStatus: result.activationStatus,
  summary: result.activationStatus === "activated"
    ? `Rolled back to ${result.currentActiveVersion} from ${result.previousActiveVersion}`
    : `Rollback rejected: ${result.preflightSummary}`,
  bundleDiffSummary: bundleDiff?.diffSummary ?? "N/A"
});
