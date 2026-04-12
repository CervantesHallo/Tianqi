import type { PolicyRegistryOperations } from "./policy-registry.js";
import type { PolicyConfigActivationRegistryOperations } from "./policy-config-activation-registry.js";
import type { PolicyConfigActivationResult } from "./policy-config-activation.js";
import type { PolicyError } from "./policy-error.js";
import {
  configRollbackTargetMissingError,
  configActivationPreflightFailedError,
  configVersionNotFoundError
} from "./policy-error.js";
import { runPolicyConfigActivationPreflight } from "./policy-config-preflight.js";

export type RollbackPolicyConfigVersionCommand = {
  readonly rolledBackBy: string;
  readonly rolledBackAt: string;
};

export const rollbackToPreviousPolicyConfigVersion = (
  command: RollbackPolicyConfigVersionCommand,
  policyRegistry: PolicyRegistryOperations,
  activationRegistry: PolicyConfigActivationRegistryOperations
): PolicyConfigActivationResult => {
  const currentActive = activationRegistry.getActiveVersion();

  if (!currentActive) {
    return buildRollbackRejection(
      null,
      [configRollbackTargetMissingError("No active version to roll back from")]
    );
  }

  const targetVersion = currentActive.previousVersion;
  if (!targetVersion) {
    return buildRollbackRejection(
      currentActive.configVersion,
      [configRollbackTargetMissingError(`Active version ${currentActive.configVersion} has no previous version`)]
    );
  }

  const targetRecord = activationRegistry.getVersion(targetVersion);
  if (!targetRecord) {
    return buildRollbackRejection(
      currentActive.configVersion,
      [configVersionNotFoundError(targetVersion)]
    );
  }

  const preflight = runPolicyConfigActivationPreflight(targetRecord.config, policyRegistry);
  if (!preflight.passed) {
    return {
      requestedVersion: targetVersion,
      previousActiveVersion: currentActive.configVersion,
      currentActiveVersion: currentActive.configVersion,
      activationStatus: "rejected",
      preflightStatus: false,
      preflightSummary: preflight.summary,
      bundleSummary: "",
      warnings: preflight.warnings,
      errors: [
        configActivationPreflightFailedError(targetVersion, `Rollback target preflight failed: ${preflight.summary}`),
        ...preflight.errors
      ],
      rollbackAvailable: false
    };
  }

  activationRegistry.updateVersion({
    ...currentActive,
    status: "rolled_back",
    rolledBackAt: command.rolledBackAt
  });

  activationRegistry.updateVersion({
    ...targetRecord,
    status: "active",
    activatedAt: command.rolledBackAt,
    previousVersion: currentActive.configVersion
  });
  activationRegistry.setActiveVersion(targetVersion);

  const cfg = targetRecord.config;
  return {
    requestedVersion: targetVersion,
    previousActiveVersion: currentActive.configVersion,
    currentActiveVersion: targetVersion,
    activationStatus: "activated",
    preflightStatus: true,
    preflightSummary: preflight.summary,
    bundleSummary: `ranking=${cfg.ranking.policyName}@${cfg.ranking.policyVersion}, ` +
      `waterfall=${cfg.fundWaterfall.policyName}@${cfg.fundWaterfall.policyVersion}, ` +
      `selection=${cfg.candidateSelection.policyName}@${cfg.candidateSelection.policyVersion}`,
    warnings: preflight.warnings,
    errors: [],
    rollbackAvailable: true
  };
};

const buildRollbackRejection = (
  currentVersion: string | null,
  errors: readonly PolicyError[]
): PolicyConfigActivationResult => ({
  requestedVersion: "",
  previousActiveVersion: currentVersion,
  currentActiveVersion: currentVersion,
  activationStatus: "rejected",
  preflightStatus: false,
  preflightSummary: errors[0]?.message ?? "Rollback rejected",
  bundleSummary: "",
  warnings: [],
  errors,
  rollbackAvailable: false
});
