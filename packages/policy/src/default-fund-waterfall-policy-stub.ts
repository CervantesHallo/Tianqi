import type { PolicyDescriptor } from "./policy-descriptor.js";
import type {
  FundWaterfallPolicy,
  FundWaterfallPolicyInput,
  FundWaterfallPolicyResult
} from "./fund-waterfall-policy.js";

const DESCRIPTOR: PolicyDescriptor = {
  policyType: "fund_waterfall",
  policyName: "default-priority-fill",
  policyVersion: "1.0.0-stub"
};

export const defaultFundWaterfallPolicyStub: FundWaterfallPolicy = {
  descriptor: DESCRIPTOR,
  allocate(input: FundWaterfallPolicyInput): FundWaterfallPolicyResult {
    const sorted = [...input.availableSources].sort((a, b) => a.priority - b.priority);
    let remaining = parseFloat(input.requestedAmount);
    const allocations = sorted
      .map((s) => {
        const available = parseFloat(s.availableAmount);
        const allocated = Math.min(remaining, available);
        remaining -= allocated;
        return {
          sourceId: s.sourceId,
          allocatedAmount: String(allocated),
          remainingAmount: String(available - allocated)
        };
      })
      .filter((a) => parseFloat(a.allocatedAmount) > 0);

    const totalAllocated = String(parseFloat(input.requestedAmount) - Math.max(0, remaining));
    const shortfall = Math.max(0, remaining);

    return {
      policyName: DESCRIPTOR.policyName,
      policyVersion: DESCRIPTOR.policyVersion,
      allocations,
      totalAllocated,
      shortfallAmount: String(shortfall),
      explanation: `Stub waterfall: allocated ${totalAllocated} of ${input.requestedAmount} from ${sorted.length} sources by priority for case ${input.caseId}`,
      decisionSummary: `${allocations.length} source(s) used, ${totalAllocated} allocated`
    };
  }
};
