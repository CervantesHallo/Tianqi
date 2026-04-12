import { ok, err } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";
import type { PolicyConfigurationRoot } from "./policy-configuration-root.js";
import { validatePolicyConfigurationRoot } from "./policy-configuration-root.js";
import type { PolicyRegistryOperations } from "./policy-registry.js";
import type { RankingPolicy } from "./ranking-policy.js";
import type { FundWaterfallPolicy } from "./fund-waterfall-policy.js";
import type { CandidateSelectionPolicy } from "./candidate-selection-policy.js";
import type { PolicyBundle } from "./policy-bundle.js";
import type { PolicyError } from "./policy-error.js";
import { policyBundleResolutionError } from "./policy-error.js";

export type PolicyBundleResolutionResult = Result<PolicyBundle, PolicyBundleResolutionFailure>;

export type PolicyBundleResolutionFailure = {
  readonly errorType: "bundle_resolution_failed";
  readonly errors: readonly PolicyError[];
  readonly summary: string;
};

export const resolvePolicyBundle = (
  config: PolicyConfigurationRoot,
  registry: PolicyRegistryOperations
): PolicyBundleResolutionResult => {
  const validation = validatePolicyConfigurationRoot(config, registry);
  if (!validation.valid) {
    return err({
      errorType: "bundle_resolution_failed",
      errors: validation.errors,
      summary: `Bundle resolution failed: ${validation.errors.length} validation error(s)`
    });
  }

  const rankingResult = registry.resolve(config.ranking);
  const waterfallResult = registry.resolve(config.fundWaterfall);
  const selectionResult = registry.resolve(config.candidateSelection);

  if (!rankingResult.ok || !waterfallResult.ok || !selectionResult.ok) {
    const resolutionErrors: PolicyError[] = [];
    if (!rankingResult.ok) resolutionErrors.push(policyBundleResolutionError(config.ranking));
    if (!waterfallResult.ok) resolutionErrors.push(policyBundleResolutionError(config.fundWaterfall));
    if (!selectionResult.ok) resolutionErrors.push(policyBundleResolutionError(config.candidateSelection));
    return err({
      errorType: "bundle_resolution_failed",
      errors: resolutionErrors,
      summary: `Bundle resolution failed: ${resolutionErrors.length} policy(s) could not be resolved`
    });
  }

  return ok({
    configVersion: config.configVersion,
    rankingPolicyDescriptor: config.ranking,
    fundWaterfallPolicyDescriptor: config.fundWaterfall,
    candidateSelectionPolicyDescriptor: config.candidateSelection,
    rankingPolicy: rankingResult.value as RankingPolicy,
    fundWaterfallPolicy: waterfallResult.value as FundWaterfallPolicy,
    candidateSelectionPolicy: selectionResult.value as CandidateSelectionPolicy
  });
};
