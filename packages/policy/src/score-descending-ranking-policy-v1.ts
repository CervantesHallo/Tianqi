import type { PolicyDescriptor } from "./policy-descriptor.js";
import type { RankingPolicy, RankingPolicyInput, RankingPolicyResult } from "./ranking-policy.js";

const DESCRIPTOR: PolicyDescriptor = {
  policyType: "ranking",
  policyName: "score-descending",
  policyVersion: "1.0.0"
};

export const scoreDescendingRankingPolicyV1: RankingPolicy = {
  descriptor: DESCRIPTOR,
  rank(input: RankingPolicyInput): RankingPolicyResult {
    if (input.candidates.length === 0) {
      return {
        policyName: DESCRIPTOR.policyName,
        policyVersion: DESCRIPTOR.policyVersion,
        rankedCandidates: [],
        explanation: `No candidates to rank for case ${input.caseId}`,
        decisionSummary: "0 candidates ranked (empty input)"
      };
    }

    const sorted = [...input.candidates].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.accountId.localeCompare(b.accountId);
    });

    const tieGroups = new Map<number, number>();
    for (const c of sorted) {
      tieGroups.set(c.score, (tieGroups.get(c.score) ?? 0) + 1);
    }
    const tieCount = [...tieGroups.values()].filter((n) => n > 1).length;

    const top = sorted[0]!;
    const bottom = sorted[sorted.length - 1]!;

    return {
      policyName: DESCRIPTOR.policyName,
      policyVersion: DESCRIPTOR.policyVersion,
      rankedCandidates: sorted,
      explanation: `Ranked ${sorted.length} candidates by score descending` +
        (tieCount > 0 ? `, ${tieCount} tie group(s) broken by accountId lexicographic order` : "") +
        `. Top: ${top.accountId} (score=${top.score}), Bottom: ${bottom.accountId} (score=${bottom.score})` +
        ` for case ${input.caseId}`,
      decisionSummary: `${sorted.length} candidates ranked, score range [${bottom.score}, ${top.score}]` +
        (tieCount > 0 ? `, ${tieCount} tie(s) resolved` : "")
    };
  }
};
