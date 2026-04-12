import type { PolicyDescriptor } from "./policy-descriptor.js";
import type { RankingPolicy } from "./ranking-policy.js";
import type { FundWaterfallPolicy } from "./fund-waterfall-policy.js";
import type { CandidateSelectionPolicy } from "./candidate-selection-policy.js";

export type PolicyBundle = {
  readonly configVersion: string;
  readonly rankingPolicyDescriptor: PolicyDescriptor;
  readonly fundWaterfallPolicyDescriptor: PolicyDescriptor;
  readonly candidateSelectionPolicyDescriptor: PolicyDescriptor;
  readonly rankingPolicy: RankingPolicy;
  readonly fundWaterfallPolicy: FundWaterfallPolicy;
  readonly candidateSelectionPolicy: CandidateSelectionPolicy;
};
