import type { PolicyDescriptor } from "./policy-descriptor.js";
import type { RankingPolicy, RankingPolicyInput, RankingPolicyResult } from "./ranking-policy.js";

const DESCRIPTOR: PolicyDescriptor = {
  policyType: "ranking",
  policyName: "default-score-descending",
  policyVersion: "1.0.0-stub"
};

export const defaultRankingPolicyStub: RankingPolicy = {
  descriptor: DESCRIPTOR,
  rank(input: RankingPolicyInput): RankingPolicyResult {
    const sorted = [...input.candidates].sort((a, b) => b.score - a.score);
    return {
      policyName: DESCRIPTOR.policyName,
      policyVersion: DESCRIPTOR.policyVersion,
      rankedCandidates: sorted,
      explanation: `Stub ranking: sorted ${sorted.length} candidates by score descending for case ${input.caseId}`,
      decisionSummary: `${sorted.length} candidates ranked by score descending`
    };
  }
};
