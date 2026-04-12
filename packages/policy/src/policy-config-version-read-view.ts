import type { PolicyDescriptor } from "./policy-descriptor.js";
import type { PolicyConfigVersionStatus } from "./policy-config-version.js";
import type { PolicyConfigActivationRegistryOperations } from "./policy-config-activation-registry.js";
import type {
  PolicyConfigVersionAuditActionType,
  PolicyConfigVersionAuditRegistryOperations
} from "./policy-config-version-audit-record.js";

export type PolicyConfigVersionReadView = {
  readonly currentActiveVersion: string | null;
  readonly currentStatus: PolicyConfigVersionStatus | null;
  readonly currentDescriptors: {
    readonly ranking: PolicyDescriptor;
    readonly fundWaterfall: PolicyDescriptor;
    readonly candidateSelection: PolicyDescriptor;
  } | null;
  readonly previousVersion: string | null;
  readonly lastAuditAction: PolicyConfigVersionAuditActionType | null;
  readonly lastAuditSummary: string | null;
  readonly lastChangedAt: string | null;
  readonly rollbackAvailable: boolean;
};

export const buildPolicyConfigVersionReadView = (
  activationRegistry: PolicyConfigActivationRegistryOperations,
  auditRegistry: PolicyConfigVersionAuditRegistryOperations
): PolicyConfigVersionReadView => {
  const active = activationRegistry.getActiveVersion();
  const latestAudit = auditRegistry.getLatest();

  if (!active) {
    return {
      currentActiveVersion: null,
      currentStatus: null,
      currentDescriptors: null,
      previousVersion: null,
      lastAuditAction: latestAudit?.actionType ?? null,
      lastAuditSummary: latestAudit?.summary ?? null,
      lastChangedAt: latestAudit?.triggeredAt ?? null,
      rollbackAvailable: false
    };
  }

  return {
    currentActiveVersion: active.configVersion,
    currentStatus: active.status,
    currentDescriptors: {
      ranking: active.config.ranking,
      fundWaterfall: active.config.fundWaterfall,
      candidateSelection: active.config.candidateSelection
    },
    previousVersion: active.previousVersion,
    lastAuditAction: latestAudit?.actionType ?? null,
    lastAuditSummary: latestAudit?.summary ?? null,
    lastChangedAt: latestAudit?.triggeredAt ?? null,
    rollbackAvailable: active.previousVersion !== null
  };
};
