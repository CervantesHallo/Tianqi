import type { RiskCaseId } from "@tianqi/shared";
import type { PolicyDescriptor } from "./policy-descriptor.js";
import type { AdlCandidate } from "./ranking-policy.js";

export type SelectedCandidate = {
  readonly accountId: string;
  readonly selectionReason: string;
};

export type RejectedCandidate = {
  readonly accountId: string;
  readonly rejectionReason: string;
};

export type CandidateSelectionPolicyInput = {
  readonly caseId: RiskCaseId;
  readonly candidates: readonly AdlCandidate[];
  readonly selectionCriteria: string;
};

export type CandidateSelectionPolicyResult = {
  readonly policyName: string;
  readonly policyVersion: string;
  readonly selectedCandidates: readonly SelectedCandidate[];
  readonly rejectedCandidates: readonly RejectedCandidate[];
  readonly excludedCount: number;
  readonly appliedThreshold: number;
  readonly explanation: string;
  readonly decisionSummary: string;
};

export type CandidateSelectionPolicy = {
  readonly descriptor: PolicyDescriptor;
  select(input: CandidateSelectionPolicyInput): CandidateSelectionPolicyResult;
};
