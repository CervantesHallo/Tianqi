import type { PolicyRegistryOperations } from "./policy-registry.js";
import { defaultRankingPolicyStub } from "./default-ranking-policy-stub.js";
import { defaultFundWaterfallPolicyStub } from "./default-fund-waterfall-policy-stub.js";
import { defaultCandidateSelectionPolicyStub } from "./default-candidate-selection-policy-stub.js";
import { scoreDescendingRankingPolicyV1 } from "./score-descending-ranking-policy-v1.js";
import { prioritySequentialFundWaterfallPolicyV1 } from "./priority-sequential-fund-waterfall-policy-v1.js";
import {
  createThresholdCandidateSelectionPolicyV1,
  DEFAULT_SELECTION_THRESHOLD
} from "./threshold-candidate-selection-policy-v1.js";

export const registerDefaultStubPolicies = (registry: PolicyRegistryOperations): void => {
  registry.register(defaultRankingPolicyStub.descriptor, defaultRankingPolicyStub);
  registry.register(defaultFundWaterfallPolicyStub.descriptor, defaultFundWaterfallPolicyStub);
  registry.register(defaultCandidateSelectionPolicyStub.descriptor, defaultCandidateSelectionPolicyStub);
};

export const registerDefaultRealPoliciesV1 = (
  registry: PolicyRegistryOperations,
  selectionThreshold: number = DEFAULT_SELECTION_THRESHOLD
): void => {
  registry.register(scoreDescendingRankingPolicyV1.descriptor, scoreDescendingRankingPolicyV1);
  registry.register(prioritySequentialFundWaterfallPolicyV1.descriptor, prioritySequentialFundWaterfallPolicyV1);
  const selectionPolicy = createThresholdCandidateSelectionPolicyV1(selectionThreshold);
  registry.register(selectionPolicy.descriptor, selectionPolicy);
};

export const registerAllDefaultPolicies = (
  registry: PolicyRegistryOperations,
  selectionThreshold: number = DEFAULT_SELECTION_THRESHOLD
): void => {
  registerDefaultStubPolicies(registry);
  registerDefaultRealPoliciesV1(registry, selectionThreshold);
};
