import type { PolicyConfigurationRoot } from "./policy-configuration-root.js";
import type { PolicyRegistryOperations } from "./policy-registry.js";
import type { PolicyError } from "./policy-error.js";
import { prevalidatePolicyConfiguration } from "./policy-configuration-prevalidation.js";
import { resolvePolicyBundle } from "./policy-bundle-resolver.js";
import { dryRunPolicyBundle } from "./policy-bundle-dry-run.js";

export type PolicyConfigPreflightResult = {
  readonly configVersion: string;
  readonly passed: boolean;
  readonly validationPassed: boolean;
  readonly bundleResolved: boolean;
  readonly dryRunPassed: boolean;
  readonly warnings: readonly string[];
  readonly errors: readonly PolicyError[];
  readonly summary: string;
};

export const runPolicyConfigActivationPreflight = (
  config: PolicyConfigurationRoot,
  policyRegistry: PolicyRegistryOperations
): PolicyConfigPreflightResult => {
  const allErrors: PolicyError[] = [];
  const allWarnings: string[] = [];

  const prevalidation = prevalidatePolicyConfiguration(config, policyRegistry);
  allErrors.push(...prevalidation.errors);
  allWarnings.push(...prevalidation.warnings);

  if (!prevalidation.isValid) {
    return {
      configVersion: config.configVersion,
      passed: false,
      validationPassed: false,
      bundleResolved: false,
      dryRunPassed: false,
      warnings: allWarnings,
      errors: allErrors,
      summary: `Preflight failed at validation: ${prevalidation.summary}`
    };
  }

  const bundleResult = resolvePolicyBundle(config, policyRegistry);
  if (!bundleResult.ok) {
    allErrors.push(...bundleResult.error.errors);
    return {
      configVersion: config.configVersion,
      passed: false,
      validationPassed: true,
      bundleResolved: false,
      dryRunPassed: false,
      warnings: allWarnings,
      errors: allErrors,
      summary: `Preflight failed at bundle resolution: ${bundleResult.error.summary}`
    };
  }

  const dryRun = dryRunPolicyBundle(bundleResult.value);
  allErrors.push(...dryRun.errors);

  if (!dryRun.success) {
    return {
      configVersion: config.configVersion,
      passed: false,
      validationPassed: true,
      bundleResolved: true,
      dryRunPassed: false,
      warnings: allWarnings,
      errors: allErrors,
      summary: `Preflight failed at dry-run: ${dryRun.summary}`
    };
  }

  return {
    configVersion: config.configVersion,
    passed: true,
    validationPassed: true,
    bundleResolved: true,
    dryRunPassed: true,
    warnings: allWarnings,
    errors: allErrors,
    summary: `Preflight passed: validation OK, bundle resolved, dry-run OK` +
      (allWarnings.length > 0 ? ` (${allWarnings.length} warning(s))` : "")
  };
};
