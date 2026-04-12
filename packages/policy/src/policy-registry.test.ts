import { describe, expect, it } from "vitest";
import type { RiskCaseId } from "@tianqi/shared";
import { ERROR_CODES } from "@tianqi/contracts";
import { createPolicyRegistry } from "./policy-registry.js";
import type { RankingPolicy, RankingPolicyInput, RankingPolicyResult } from "./ranking-policy.js";
import type { FundWaterfallPolicy, FundWaterfallPolicyInput, FundWaterfallPolicyResult } from "./fund-waterfall-policy.js";
import type { CandidateSelectionPolicy, CandidateSelectionPolicyInput, CandidateSelectionPolicyResult } from "./candidate-selection-policy.js";
import type { PolicyDescriptor } from "./policy-descriptor.js";

const caseId = "rc-test" as RiskCaseId;

const stubRankingPolicy: RankingPolicy = {
  descriptor: { policyType: "ranking", policyName: "score-desc", policyVersion: "1.0.0" },
  rank(input: RankingPolicyInput): RankingPolicyResult {
    const sorted = [...input.candidates].sort((a, b) => b.score - a.score);
    return {
      policyName: "score-desc",
      policyVersion: "1.0.0",
      rankedCandidates: sorted,
      explanation: "Ranked by score descending",
      decisionSummary: `${sorted.length} candidates ranked`
    };
  }
};

const stubWaterfallPolicy: FundWaterfallPolicy = {
  descriptor: { policyType: "fund_waterfall", policyName: "priority-first", policyVersion: "1.0.0" },
  allocate(input: FundWaterfallPolicyInput): FundWaterfallPolicyResult {
    return {
      policyName: "priority-first",
      policyVersion: "1.0.0",
      allocations: [{ sourceId: "s1", allocatedAmount: input.requestedAmount, remainingAmount: "0" }],
      totalAllocated: input.requestedAmount,
      shortfallAmount: "0",
      explanation: "Allocated from highest priority source",
      decisionSummary: `Allocated ${input.requestedAmount}`
    };
  }
};

const stubSelectionPolicy: CandidateSelectionPolicy = {
  descriptor: { policyType: "candidate_selection", policyName: "threshold-filter", policyVersion: "1.0.0" },
  select(input: CandidateSelectionPolicyInput): CandidateSelectionPolicyResult {
    const selected = input.candidates.filter((c) => c.score > 0);
    const rejected = input.candidates.filter((c) => c.score <= 0);
    return {
      policyName: "threshold-filter",
      policyVersion: "1.0.0",
      selectedCandidates: selected.map((c) => ({ accountId: c.accountId, selectionReason: "score > 0" })),
      rejectedCandidates: rejected.map((c) => ({ accountId: c.accountId, rejectionReason: "score <= 0" })),
      excludedCount: rejected.length,
      appliedThreshold: 0,
      explanation: `Selected ${selected.length} of ${input.candidates.length} by criteria: ${input.selectionCriteria}`,
      decisionSummary: `${selected.length} selected, ${rejected.length} excluded`
    };
  }
};

describe("PolicyRegistry: register and resolve", () => {
  it("registered ranking policy can be resolved", () => {
    const reg = createPolicyRegistry();
    const d = stubRankingPolicy.descriptor;
    const regResult = reg.register(d, stubRankingPolicy);
    expect(regResult.ok).toBe(true);

    const resolved = reg.resolve(d);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.value.descriptor.policyName).toBe("score-desc");
    }
  });

  it("registered fund waterfall policy can be resolved", () => {
    const reg = createPolicyRegistry();
    const d = stubWaterfallPolicy.descriptor;
    reg.register(d, stubWaterfallPolicy);

    const resolved = reg.resolve(d);
    expect(resolved.ok).toBe(true);
  });

  it("registered candidate selection policy can be resolved", () => {
    const reg = createPolicyRegistry();
    const d = stubSelectionPolicy.descriptor;
    reg.register(d, stubSelectionPolicy);

    const resolved = reg.resolve(d);
    expect(resolved.ok).toBe(true);
  });

  it("unregistered policy returns structured error", () => {
    const reg = createPolicyRegistry();
    const d: PolicyDescriptor = { policyType: "ranking", policyName: "unknown", policyVersion: "1.0.0" };
    const resolved = reg.resolve(d);
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error.errorType).toBe("policy_not_registered");
      expect(resolved.error.code).toBe(ERROR_CODES.POLICY_NOT_REGISTERED);
    }
  });

  it("type mismatch on register returns structured error", () => {
    const reg = createPolicyRegistry();
    const wrongDescriptor: PolicyDescriptor = { policyType: "fund_waterfall", policyName: "score-desc", policyVersion: "1.0.0" };
    const result = reg.register(wrongDescriptor, stubRankingPolicy);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.errorType).toBe("policy_type_mismatch");
      expect(result.error.code).toBe(ERROR_CODES.POLICY_TYPE_MISMATCH);
    }
  });

  it("empty version on register returns structured error", () => {
    const reg = createPolicyRegistry();
    const badDescriptor: PolicyDescriptor = { policyType: "ranking", policyName: "score-desc", policyVersion: "" };
    const result = reg.register(badDescriptor, stubRankingPolicy);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.errorType).toBe("policy_version_invalid");
      expect(result.error.code).toBe(ERROR_CODES.POLICY_VERSION_INVALID);
    }
  });

  it("empty name on register returns structured error", () => {
    const reg = createPolicyRegistry();
    const badDescriptor: PolicyDescriptor = { policyType: "ranking", policyName: "  ", policyVersion: "1.0.0" };
    const result = reg.register(badDescriptor, stubRankingPolicy);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.errorType).toBe("policy_version_invalid");
    }
  });

  it("listByType returns descriptors of matching type", () => {
    const reg = createPolicyRegistry();
    reg.register(stubRankingPolicy.descriptor, stubRankingPolicy);
    reg.register(stubWaterfallPolicy.descriptor, stubWaterfallPolicy);
    reg.register(stubSelectionPolicy.descriptor, stubSelectionPolicy);

    const rankings = reg.listByType("ranking");
    expect(rankings.length).toBe(1);
    expect(rankings[0]!.policyName).toBe("score-desc");

    const waterfalls = reg.listByType("fund_waterfall");
    expect(waterfalls.length).toBe(1);
  });
});

describe("PolicyRegistry: policy execution via resolved instance", () => {
  it("ranking policy produces result with explanation", () => {
    const result = stubRankingPolicy.rank({
      caseId,
      candidates: [
        { accountId: "a1", score: 3 },
        { accountId: "a2", score: 7 }
      ]
    });
    expect(result.policyName).toBe("score-desc");
    expect(result.policyVersion).toBe("1.0.0");
    expect(result.explanation).toBeTruthy();
    expect(result.decisionSummary).toBeTruthy();
    expect(result.rankedCandidates[0]!.accountId).toBe("a2");
  });

  it("fund waterfall policy produces result with explanation", () => {
    const result = stubWaterfallPolicy.allocate({
      caseId,
      requestedAmount: "1000",
      availableSources: [{ sourceId: "s1", sourceType: "insurance", availableAmount: "5000", priority: 1 }]
    });
    expect(result.policyName).toBe("priority-first");
    expect(result.policyVersion).toBe("1.0.0");
    expect(result.explanation).toBeTruthy();
    expect(result.decisionSummary).toBeTruthy();
    expect(result.totalAllocated).toBe("1000");
  });

  it("candidate selection policy produces result with explanation", () => {
    const result = stubSelectionPolicy.select({
      caseId,
      candidates: [
        { accountId: "a1", score: 5 },
        { accountId: "a2", score: -1 }
      ],
      selectionCriteria: "score > 0"
    });
    expect(result.policyName).toBe("threshold-filter");
    expect(result.policyVersion).toBe("1.0.0");
    expect(result.explanation).toBeTruthy();
    expect(result.decisionSummary).toBeTruthy();
    expect(result.selectedCandidates.length).toBe(1);
    expect(result.excludedCount).toBe(1);
  });
});
