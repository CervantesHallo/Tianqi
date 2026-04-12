import type { PolicyDescriptor } from "./policy-descriptor.js";
import type {
  CandidateSelectionPolicy,
  CandidateSelectionPolicyInput,
  CandidateSelectionPolicyResult
} from "./candidate-selection-policy.js";

const DESCRIPTOR: PolicyDescriptor = {
  policyType: "candidate_selection",
  policyName: "default-positive-score-filter",
  policyVersion: "1.0.0-stub"
};

const STUB_THRESHOLD = 0;

export const defaultCandidateSelectionPolicyStub: CandidateSelectionPolicy = {
  descriptor: DESCRIPTOR,
  select(input: CandidateSelectionPolicyInput): CandidateSelectionPolicyResult {
    const selected = input.candidates.filter((c) => c.score > STUB_THRESHOLD);
    const rejected = input.candidates.filter((c) => c.score <= STUB_THRESHOLD);

    return {
      policyName: DESCRIPTOR.policyName,
      policyVersion: DESCRIPTOR.policyVersion,
      selectedCandidates: selected.map((c) => ({
        accountId: c.accountId,
        selectionReason: `score ${c.score} > ${STUB_THRESHOLD} (criteria: ${input.selectionCriteria})`
      })),
      rejectedCandidates: rejected.map((c) => ({
        accountId: c.accountId,
        rejectionReason: `score ${c.score} <= ${STUB_THRESHOLD}`
      })),
      excludedCount: rejected.length,
      appliedThreshold: STUB_THRESHOLD,
      explanation: `Stub selection: ${selected.length} of ${input.candidates.length} candidates passed positive-score filter for case ${input.caseId}`,
      decisionSummary: `${selected.length} selected, ${rejected.length} excluded`
    };
  }
};
