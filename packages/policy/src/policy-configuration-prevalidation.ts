import { buildPolicyKey, POLICY_TYPES } from "./policy-descriptor.js";
import type { PolicyConfigurationRoot } from "./policy-configuration-root.js";
import { validatePolicyConfigurationRoot } from "./policy-configuration-root.js";
import type { PolicyRegistryOperations } from "./policy-registry.js";
import type { PolicyError } from "./policy-error.js";

export type PolicyConfigurationPrevalidationResult = {
  readonly configVersion: string;
  readonly isValid: boolean;
  readonly resolvedPolicyTypes: readonly string[];
  readonly resolvedPolicyKeys: readonly string[];
  readonly errors: readonly PolicyError[];
  readonly warnings: readonly string[];
  readonly summary: string;
};

export const prevalidatePolicyConfiguration = (
  config: PolicyConfigurationRoot,
  registry: PolicyRegistryOperations
): PolicyConfigurationPrevalidationResult => {
  const validation = validatePolicyConfigurationRoot(config, registry);

  const warnings: string[] = [];
  const resolvedTypes: string[] = [];
  const resolvedKeys: string[] = [];

  if (validation.valid) {
    for (const pt of POLICY_TYPES) {
      const descriptor =
        pt === "ranking" ? config.ranking :
        pt === "fund_waterfall" ? config.fundWaterfall :
        config.candidateSelection;
      const resolved = registry.resolve(descriptor);
      if (resolved.ok) {
        resolvedTypes.push(pt);
        resolvedKeys.push(buildPolicyKey(descriptor));
      }
    }

    if (config.ranking.policyVersion.includes("stub") ||
        config.fundWaterfall.policyVersion.includes("stub") ||
        config.candidateSelection.policyVersion.includes("stub")) {
      warnings.push("Configuration references stub policy version(s)");
    }
  }

  const summary = validation.valid
    ? `Prevalidation passed: ${resolvedTypes.length}/${POLICY_TYPES.length} policy types resolved` +
      (warnings.length > 0 ? `, ${warnings.length} warning(s)` : "")
    : `Prevalidation failed: ${validation.errors.length} error(s)`;

  return {
    configVersion: config.configVersion,
    isValid: validation.valid,
    resolvedPolicyTypes: resolvedTypes,
    resolvedPolicyKeys: resolvedKeys,
    errors: validation.errors,
    warnings,
    summary
  };
};
