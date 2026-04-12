import type { PolicyConfigurationRoot } from "./policy-configuration-root.js";
import { defaultRankingPolicyStub } from "./default-ranking-policy-stub.js";
import { defaultFundWaterfallPolicyStub } from "./default-fund-waterfall-policy-stub.js";
import { defaultCandidateSelectionPolicyStub } from "./default-candidate-selection-policy-stub.js";
import { scoreDescendingRankingPolicyV1 } from "./score-descending-ranking-policy-v1.js";
import { prioritySequentialFundWaterfallPolicyV1 } from "./priority-sequential-fund-waterfall-policy-v1.js";
import { thresholdCandidateSelectionPolicyV1 } from "./threshold-candidate-selection-policy-v1.js";

export const STUB_POLICY_CONFIG: PolicyConfigurationRoot = {
  configVersion: "0.1.0-stub",
  ranking: defaultRankingPolicyStub.descriptor,
  fundWaterfall: defaultFundWaterfallPolicyStub.descriptor,
  candidateSelection: defaultCandidateSelectionPolicyStub.descriptor,
  configSource: "built-in-stub",
  createdAt: "2026-03-25T00:00:00.000Z"
};

export const REAL_POLICY_CONFIG_V1: PolicyConfigurationRoot = {
  configVersion: "1.0.0",
  ranking: scoreDescendingRankingPolicyV1.descriptor,
  fundWaterfall: prioritySequentialFundWaterfallPolicyV1.descriptor,
  candidateSelection: thresholdCandidateSelectionPolicyV1.descriptor,
  configSource: "built-in-v1",
  createdAt: "2026-03-25T00:00:00.000Z"
};
