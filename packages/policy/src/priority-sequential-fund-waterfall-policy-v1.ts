import type { PolicyDescriptor } from "./policy-descriptor.js";
import type {
  FundAllocationEntry,
  FundWaterfallPolicy,
  FundWaterfallPolicyInput,
  FundWaterfallPolicyResult
} from "./fund-waterfall-policy.js";

const DESCRIPTOR: PolicyDescriptor = {
  policyType: "fund_waterfall",
  policyName: "priority-sequential",
  policyVersion: "1.0.0"
};

export const prioritySequentialFundWaterfallPolicyV1: FundWaterfallPolicy = {
  descriptor: DESCRIPTOR,
  allocate(input: FundWaterfallPolicyInput): FundWaterfallPolicyResult {
    const requested = parseFloat(input.requestedAmount);

    if (input.availableSources.length === 0 || requested <= 0) {
      const shortfall = requested > 0 ? requested : 0;
      return {
        policyName: DESCRIPTOR.policyName,
        policyVersion: DESCRIPTOR.policyVersion,
        allocations: [],
        totalAllocated: "0",
        shortfallAmount: String(shortfall),
        explanation: requested <= 0
          ? `No allocation needed: requested amount is ${input.requestedAmount} for case ${input.caseId}`
          : `No sources available to fulfill ${input.requestedAmount} for case ${input.caseId}`,
        decisionSummary: `0 allocated, shortfall ${shortfall}`
      };
    }

    const sorted = [...input.availableSources].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.sourceId.localeCompare(b.sourceId);
    });

    let remaining = requested;
    const allocations: FundAllocationEntry[] = [];
    const usedSources: string[] = [];

    for (const source of sorted) {
      if (remaining <= 0) break;
      const available = parseFloat(source.availableAmount);
      if (available <= 0) continue;
      const allocated = Math.min(remaining, available);
      remaining -= allocated;
      allocations.push({
        sourceId: source.sourceId,
        allocatedAmount: String(allocated),
        remainingAmount: String(available - allocated)
      });
      usedSources.push(`${source.sourceId}(priority=${source.priority}, allocated=${allocated})`);
    }

    const totalAllocated = String(requested - Math.max(0, remaining));
    const shortfall = Math.max(0, remaining);

    return {
      policyName: DESCRIPTOR.policyName,
      policyVersion: DESCRIPTOR.policyVersion,
      allocations,
      totalAllocated,
      shortfallAmount: String(shortfall),
      explanation: `Sequential waterfall: requested ${input.requestedAmount}, ` +
        `consumed ${allocations.length} of ${sorted.length} sources by priority. ` +
        `Sources used: [${usedSources.join(", ")}]` +
        (shortfall > 0 ? `. Shortfall: ${shortfall} (insufficient total funds)` : ". Fully funded") +
        ` for case ${input.caseId}`,
      decisionSummary: `${allocations.length} source(s), ${totalAllocated} allocated` +
        (shortfall > 0 ? `, shortfall ${shortfall}` : ", fully funded")
    };
  }
};
