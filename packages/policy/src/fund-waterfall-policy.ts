import type { RiskCaseId } from "@tianqi/shared";
import type { PolicyDescriptor } from "./policy-descriptor.js";

export type FundSource = {
  readonly sourceId: string;
  readonly sourceType: string;
  readonly availableAmount: string;
  readonly priority: number;
};

export type FundWaterfallPolicyInput = {
  readonly caseId: RiskCaseId;
  readonly requestedAmount: string;
  readonly availableSources: readonly FundSource[];
};

export type FundAllocationEntry = {
  readonly sourceId: string;
  readonly allocatedAmount: string;
  readonly remainingAmount: string;
};

export type FundWaterfallPolicyResult = {
  readonly policyName: string;
  readonly policyVersion: string;
  readonly allocations: readonly FundAllocationEntry[];
  readonly totalAllocated: string;
  readonly shortfallAmount: string;
  readonly explanation: string;
  readonly decisionSummary: string;
};

export type FundWaterfallPolicy = {
  readonly descriptor: PolicyDescriptor;
  allocate(input: FundWaterfallPolicyInput): FundWaterfallPolicyResult;
};
