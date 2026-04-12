import type { PolicyDescriptor } from "./policy-descriptor.js";
import type {
  CandidateSelectionPolicy,
  CandidateSelectionPolicyInput,
  CandidateSelectionPolicyResult
} from "./candidate-selection-policy.js";

const DESCRIPTOR: PolicyDescriptor = {
  policyType: "candidate_selection",
  policyName: "threshold-filter",
  policyVersion: "1.0.0"
};

export const createThresholdCandidateSelectionPolicyV1 = (
  threshold: number
): CandidateSelectionPolicy => ({
  descriptor: DESCRIPTOR,
  select(input: CandidateSelectionPolicyInput): CandidateSelectionPolicyResult {
    const selected = input.candidates.filter((c) => c.score >= threshold);
    const rejected = input.candidates.filter((c) => c.score < threshold);

    return {
      policyName: DESCRIPTOR.policyName,
      policyVersion: DESCRIPTOR.policyVersion,
      selectedCandidates: selected.map((c) => ({
        accountId: c.accountId,
        selectionReason: `score ${c.score} >= threshold ${threshold}`
      })),
      rejectedCandidates: rejected.map((c) => ({
        accountId: c.accountId,
        rejectionReason: `score ${c.score} < threshold ${threshold}`
      })),
      excludedCount: rejected.length,
      appliedThreshold: threshold,
      explanation: `Threshold filter: ${selected.length} of ${input.candidates.length} candidates with score >= ${threshold}. ` +
        `${rejected.length} rejected` +
        (rejected.length > 0 ? ` (scores: ${rejected.map((c) => c.score).join(", ")})` : "") +
        `. Criteria: ${input.selectionCriteria} for case ${input.caseId}`,
      decisionSummary: `${selected.length} selected, ${rejected.length} rejected (threshold=${threshold})`
    };
  }
});

export const DEFAULT_SELECTION_THRESHOLD = 0;

export const thresholdCandidateSelectionPolicyV1 =
  createThresholdCandidateSelectionPolicyV1(DEFAULT_SELECTION_THRESHOLD);
