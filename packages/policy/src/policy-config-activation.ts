import type { PolicyRegistryOperations } from "./policy-registry.js";
import type { PolicyConfigActivationRegistryOperations } from "./policy-config-activation-registry.js";
import type { PolicyError } from "./policy-error.js";
import {
  configVersionNotFoundError,
  configAlreadyActiveError,
  configActivationPreflightFailedError,
  configLifecycleInvalidError
} from "./policy-error.js";
import { runPolicyConfigActivationPreflight } from "./policy-config-preflight.js";

export type ActivatePolicyConfigVersionCommand = {
  readonly targetConfigVersion: string;
  readonly activatedBy: string;
  readonly activatedAt: string;
  readonly allowOverrideActive: boolean;
};

export type PolicyConfigActivationStatus = "activated" | "rejected" | "already_active";

export type PolicyConfigActivationResult = {
  readonly requestedVersion: string;
  readonly previousActiveVersion: string | null;
  readonly currentActiveVersion: string | null;
  readonly activationStatus: PolicyConfigActivationStatus;
  readonly preflightStatus: boolean;
  readonly preflightSummary: string;
  readonly bundleSummary: string;
  readonly warnings: readonly string[];
  readonly errors: readonly PolicyError[];
  readonly rollbackAvailable: boolean;
};

export const activatePolicyConfigVersion = (
  command: ActivatePolicyConfigVersionCommand,
  policyRegistry: PolicyRegistryOperations,
  activationRegistry: PolicyConfigActivationRegistryOperations
): PolicyConfigActivationResult => {
  const record = activationRegistry.getVersion(command.targetConfigVersion);
  const currentActive = activationRegistry.getActiveVersion();
  const previousVersion = currentActive?.configVersion ?? null;

  if (!record) {
    return {
      requestedVersion: command.targetConfigVersion,
      previousActiveVersion: previousVersion,
      currentActiveVersion: previousVersion,
      activationStatus: "rejected",
      preflightStatus: false,
      preflightSummary: "Target version not found in registry",
      bundleSummary: "",
      warnings: [],
      errors: [configVersionNotFoundError(command.targetConfigVersion)],
      rollbackAvailable: false
    };
  }

  if (currentActive?.configVersion === command.targetConfigVersion) {
    return {
      requestedVersion: command.targetConfigVersion,
      previousActiveVersion: previousVersion,
      currentActiveVersion: previousVersion,
      activationStatus: "already_active",
      preflightStatus: true,
      preflightSummary: "Already the active version",
      bundleSummary: "",
      warnings: [],
      errors: [configAlreadyActiveError(command.targetConfigVersion)],
      rollbackAvailable: currentActive.previousVersion !== null
    };
  }

  if (currentActive && !command.allowOverrideActive) {
    return {
      requestedVersion: command.targetConfigVersion,
      previousActiveVersion: previousVersion,
      currentActiveVersion: previousVersion,
      activationStatus: "rejected",
      preflightStatus: false,
      preflightSummary: "Override not allowed: active version exists",
      bundleSummary: "",
      warnings: [],
      errors: [configLifecycleInvalidError(command.targetConfigVersion,
        `Cannot activate: version ${previousVersion} is active and allowOverrideActive is false`)],
      rollbackAvailable: false
    };
  }

  if (record.status !== "draft" && record.status !== "validated" && record.status !== "rolled_back") {
    return {
      requestedVersion: command.targetConfigVersion,
      previousActiveVersion: previousVersion,
      currentActiveVersion: previousVersion,
      activationStatus: "rejected",
      preflightStatus: false,
      preflightSummary: `Cannot activate from status: ${record.status}`,
      bundleSummary: "",
      warnings: [],
      errors: [configLifecycleInvalidError(command.targetConfigVersion,
        `Cannot activate from status '${record.status}', expected draft/validated/rolled_back`)],
      rollbackAvailable: currentActive !== null
    };
  }

  const preflight = runPolicyConfigActivationPreflight(record.config, policyRegistry);

  if (!preflight.passed) {
    activationRegistry.updateVersion({ ...record, status: "rejected" });
    return {
      requestedVersion: command.targetConfigVersion,
      previousActiveVersion: previousVersion,
      currentActiveVersion: previousVersion,
      activationStatus: "rejected",
      preflightStatus: false,
      preflightSummary: preflight.summary,
      bundleSummary: "",
      warnings: preflight.warnings,
      errors: [
        configActivationPreflightFailedError(command.targetConfigVersion, preflight.summary),
        ...preflight.errors
      ],
      rollbackAvailable: currentActive !== null
    };
  }

  if (currentActive) {
    activationRegistry.updateVersion({
      ...currentActive,
      status: "rolled_back",
      rolledBackAt: command.activatedAt
    });
  }

  activationRegistry.updateVersion({
    ...record,
    status: "active",
    activatedAt: command.activatedAt,
    previousVersion: previousVersion
  });
  activationRegistry.setActiveVersion(command.targetConfigVersion);

  const cfg = record.config;
  return {
    requestedVersion: command.targetConfigVersion,
    previousActiveVersion: previousVersion,
    currentActiveVersion: command.targetConfigVersion,
    activationStatus: "activated",
    preflightStatus: true,
    preflightSummary: preflight.summary,
    bundleSummary: `ranking=${cfg.ranking.policyName}@${cfg.ranking.policyVersion}, ` +
      `waterfall=${cfg.fundWaterfall.policyName}@${cfg.fundWaterfall.policyVersion}, ` +
      `selection=${cfg.candidateSelection.policyName}@${cfg.candidateSelection.policyVersion}`,
    warnings: preflight.warnings,
    errors: [],
    rollbackAvailable: previousVersion !== null
  };
};
