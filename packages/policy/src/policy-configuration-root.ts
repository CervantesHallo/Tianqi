import type { PolicyDescriptor } from "./policy-descriptor.js";
import type { PolicyRegistryOperations } from "./policy-registry.js";
import type { PolicyError } from "./policy-error.js";
import {
  policyTypeMismatchError,
  policyConfigIncompleteError,
  policyConfigUnresolvableError
} from "./policy-error.js";

export type PolicyConfigurationRoot = {
  readonly configVersion: string;
  readonly ranking: PolicyDescriptor;
  readonly fundWaterfall: PolicyDescriptor;
  readonly candidateSelection: PolicyDescriptor;
  readonly configSource: string;
  readonly createdAt: string;
};

export type PolicyConfigurationValidationResult = {
  readonly valid: boolean;
  readonly errors: readonly PolicyError[];
};

const validateDescriptorCompleteness = (
  label: string,
  d: PolicyDescriptor
): PolicyError | null => {
  if (!d.policyName.trim() || !d.policyVersion.trim()) {
    return policyConfigIncompleteError(label, d);
  }
  return null;
};

export const validatePolicyConfigurationRoot = (
  config: PolicyConfigurationRoot,
  registry: PolicyRegistryOperations
): PolicyConfigurationValidationResult => {
  const errors: PolicyError[] = [];

  if (config.ranking.policyType !== "ranking") {
    errors.push(policyTypeMismatchError(config.ranking, config.ranking.policyType));
  }
  if (config.fundWaterfall.policyType !== "fund_waterfall") {
    errors.push(policyTypeMismatchError(config.fundWaterfall, config.fundWaterfall.policyType));
  }
  if (config.candidateSelection.policyType !== "candidate_selection") {
    errors.push(policyTypeMismatchError(config.candidateSelection, config.candidateSelection.policyType));
  }

  const rankingComplete = validateDescriptorCompleteness("ranking", config.ranking);
  if (rankingComplete) errors.push(rankingComplete);
  const waterfallComplete = validateDescriptorCompleteness("fundWaterfall", config.fundWaterfall);
  if (waterfallComplete) errors.push(waterfallComplete);
  const selectionComplete = validateDescriptorCompleteness("candidateSelection", config.candidateSelection);
  if (selectionComplete) errors.push(selectionComplete);

  if (!config.configVersion.trim()) {
    errors.push(policyConfigIncompleteError("configVersion", config.ranking));
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const rankingResolved = registry.resolve(config.ranking);
  if (!rankingResolved.ok) {
    errors.push(policyConfigUnresolvableError(config.ranking));
  }
  const waterfallResolved = registry.resolve(config.fundWaterfall);
  if (!waterfallResolved.ok) {
    errors.push(policyConfigUnresolvableError(config.fundWaterfall));
  }
  const selectionResolved = registry.resolve(config.candidateSelection);
  if (!selectionResolved.ok) {
    errors.push(policyConfigUnresolvableError(config.candidateSelection));
  }

  return { valid: errors.length === 0, errors };
};
