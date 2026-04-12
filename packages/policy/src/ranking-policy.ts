import type { RiskCaseId } from "@tianqi/shared";
import type { PolicyDescriptor } from "./policy-descriptor.js";

export type AdlCandidate = {
  readonly accountId: string;
  readonly score: number;
};

export type RankingPolicyInput = {
  readonly caseId: RiskCaseId;
  readonly candidates: readonly AdlCandidate[];
};

export type RankingPolicyResult = {
  readonly policyName: string;
  readonly policyVersion: string;
  readonly rankedCandidates: readonly AdlCandidate[];
  readonly explanation: string;
  readonly decisionSummary: string;
};

export type RankingPolicy = {
  readonly descriptor: PolicyDescriptor;
  rank(input: RankingPolicyInput): RankingPolicyResult;
};
