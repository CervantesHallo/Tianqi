import { ERROR_CODES } from "@tianqi/contracts";
import type { PolicyDescriptor } from "./policy-descriptor.js";

export type PolicyErrorType =
  | "policy_not_registered"
  | "policy_type_mismatch"
  | "policy_version_invalid"
  | "policy_config_incomplete"
  | "policy_config_unresolvable"
  | "bundle_resolution_failed"
  | "dry_run_failed"
  | "config_version_not_found"
  | "config_activation_preflight_failed"
  | "config_already_active"
  | "config_rollback_target_missing"
  | "config_lifecycle_invalid"
  | "audit_write_failed"
  | "config_read_view_unavailable";

export type PolicyError = {
  readonly code: string;
  readonly errorType: PolicyErrorType;
  readonly message: string;
  readonly context: {
    readonly policyType: string;
    readonly policyName: string;
    readonly policyVersion: string;
  };
};

const descriptorContext = (d: PolicyDescriptor) => ({
  policyType: d.policyType,
  policyName: d.policyName,
  policyVersion: d.policyVersion
});

export const policyNotRegisteredError = (descriptor: PolicyDescriptor): PolicyError => ({
  code: ERROR_CODES.POLICY_NOT_REGISTERED,
  errorType: "policy_not_registered",
  message: `Policy not registered: ${descriptor.policyType}/${descriptor.policyName}@${descriptor.policyVersion}`,
  context: descriptorContext(descriptor)
});

export const policyTypeMismatchError = (
  descriptor: PolicyDescriptor,
  actualType: string
): PolicyError => ({
  code: ERROR_CODES.POLICY_TYPE_MISMATCH,
  errorType: "policy_type_mismatch",
  message: `Policy type mismatch: expected ${descriptor.policyType}, got ${actualType}`,
  context: descriptorContext(descriptor)
});

export const policyVersionInvalidError = (descriptor: PolicyDescriptor): PolicyError => ({
  code: ERROR_CODES.POLICY_VERSION_INVALID,
  errorType: "policy_version_invalid",
  message: `Policy version invalid: ${descriptor.policyName}@${descriptor.policyVersion}`,
  context: descriptorContext(descriptor)
});

export const policyConfigIncompleteError = (
  field: string,
  descriptor: PolicyDescriptor
): PolicyError => ({
  code: ERROR_CODES.POLICY_CONFIG_INCOMPLETE,
  errorType: "policy_config_incomplete",
  message: `Policy configuration incomplete: ${field} missing or invalid for ${descriptor.policyType}`,
  context: descriptorContext(descriptor)
});

export const policyConfigUnresolvableError = (descriptor: PolicyDescriptor): PolicyError => ({
  code: ERROR_CODES.POLICY_CONFIG_UNRESOLVABLE,
  errorType: "policy_config_unresolvable",
  message: `Policy configuration references unregistered policy: ${descriptor.policyType}/${descriptor.policyName}@${descriptor.policyVersion}`,
  context: descriptorContext(descriptor)
});

export const policyBundleResolutionError = (descriptor: PolicyDescriptor): PolicyError => ({
  code: ERROR_CODES.POLICY_CONFIG_UNRESOLVABLE,
  errorType: "bundle_resolution_failed",
  message: `Bundle resolution failed for: ${descriptor.policyType}/${descriptor.policyName}@${descriptor.policyVersion}`,
  context: descriptorContext(descriptor)
});

export const policyDryRunError = (descriptor: PolicyDescriptor, reason: string): PolicyError => ({
  code: ERROR_CODES.POLICY_EXECUTION_FAILED,
  errorType: "dry_run_failed",
  message: `Dry-run failed for ${descriptor.policyType}/${descriptor.policyName}@${descriptor.policyVersion}: ${reason}`,
  context: descriptorContext(descriptor)
});

const configContext = (configVersion: string) => ({
  policyType: "config" as const,
  policyName: configVersion,
  policyVersion: configVersion
});

export const configVersionNotFoundError = (configVersion: string): PolicyError => ({
  code: ERROR_CODES.CONFIG_VERSION_NOT_FOUND,
  errorType: "config_version_not_found",
  message: `Config version not found: ${configVersion}`,
  context: configContext(configVersion)
});

export const configActivationPreflightFailedError = (configVersion: string, reason: string): PolicyError => ({
  code: ERROR_CODES.CONFIG_ACTIVATION_PREFLIGHT_FAILED,
  errorType: "config_activation_preflight_failed",
  message: `Activation preflight failed for config ${configVersion}: ${reason}`,
  context: configContext(configVersion)
});

export const configAlreadyActiveError = (configVersion: string): PolicyError => ({
  code: ERROR_CODES.CONFIG_ALREADY_ACTIVE,
  errorType: "config_already_active",
  message: `Config version already active: ${configVersion}`,
  context: configContext(configVersion)
});

export const configRollbackTargetMissingError = (reason: string): PolicyError => ({
  code: ERROR_CODES.CONFIG_ROLLBACK_TARGET_MISSING,
  errorType: "config_rollback_target_missing",
  message: `Rollback target missing: ${reason}`,
  context: configContext("")
});

export const configLifecycleInvalidError = (configVersion: string, reason: string): PolicyError => ({
  code: ERROR_CODES.CONFIG_LIFECYCLE_INVALID,
  errorType: "config_lifecycle_invalid",
  message: `Invalid lifecycle transition for config ${configVersion}: ${reason}`,
  context: configContext(configVersion)
});

export const auditWriteFailedError = (reason: string): PolicyError => ({
  code: ERROR_CODES.POLICY_EXECUTION_FAILED,
  errorType: "audit_write_failed",
  message: `Audit record write failed: ${reason}`,
  context: configContext("")
});

export const configReadViewUnavailableError = (reason: string): PolicyError => ({
  code: ERROR_CODES.POLICY_EXECUTION_FAILED,
  errorType: "config_read_view_unavailable",
  message: `Config read view unavailable: ${reason}`,
  context: configContext("")
});
