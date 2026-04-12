import { describe, expect, it } from "vitest";
import type { RiskCaseId } from "@tianqi/shared";
import { createPolicyRegistry } from "./policy-registry.js";
import { resolvePolicyBundle } from "./policy-bundle-resolver.js";
import { dryRunPolicyBundle } from "./policy-bundle-dry-run.js";
import { defaultRankingPolicyStub } from "./default-ranking-policy-stub.js";
import { defaultFundWaterfallPolicyStub } from "./default-fund-waterfall-policy-stub.js";
import { defaultCandidateSelectionPolicyStub } from "./default-candidate-selection-policy-stub.js";
import type { PolicyConfigurationRoot } from "./policy-configuration-root.js";
import type { RankingPolicy, RankingPolicyInput, RankingPolicyResult } from "./ranking-policy.js";

const registerAllStubs = () => {
  const reg = createPolicyRegistry();
  reg.register(defaultRankingPolicyStub.descriptor, defaultRankingPolicyStub);
  reg.register(defaultFundWaterfallPolicyStub.descriptor, defaultFundWaterfallPolicyStub);
  reg.register(defaultCandidateSelectionPolicyStub.descriptor, defaultCandidateSelectionPolicyStub);
  return reg;
};

const validConfig: PolicyConfigurationRoot = {
  configVersion: "1.0.0",
  ranking: defaultRankingPolicyStub.descriptor,
  fundWaterfall: defaultFundWaterfallPolicyStub.descriptor,
  candidateSelection: defaultCandidateSelectionPolicyStub.descriptor,
  configSource: "test",
  createdAt: "2026-03-25T00:00:00.000Z"
};

describe("Dry-run: stub bundle succeeds", () => {
  it("all three stubs produce valid results with explanation", () => {
    const resolved = resolvePolicyBundle(validConfig, registerAllStubs());
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const result = dryRunPolicyBundle(resolved.value);
    expect(result.success).toBe(true);
    expect(result.configVersion).toBe("1.0.0");
    expect(result.errors.length).toBe(0);
    expect(result.summary).toContain("passed");

    expect(result.rankingResult).not.toBeNull();
    expect(result.rankingResult!.policyName).toBe("default-score-descending");
    expect(result.rankingResult!.explanation).toBeTruthy();

    expect(result.fundWaterfallResult).not.toBeNull();
    expect(result.fundWaterfallResult!.policyName).toBe("default-priority-fill");
    expect(result.fundWaterfallResult!.explanation).toBeTruthy();

    expect(result.candidateSelectionResult).not.toBeNull();
    expect(result.candidateSelectionResult!.policyName).toBe("default-positive-score-filter");
    expect(result.candidateSelectionResult!.explanation).toBeTruthy();
  });
});

describe("Dry-run: contract violation detected", () => {
  it("ranking returning empty policyName fails dry-run", () => {
    const badRanking: RankingPolicy = {
      descriptor: { policyType: "ranking", policyName: "bad-rank", policyVersion: "0.0.1" },
      rank(_input: RankingPolicyInput): RankingPolicyResult {
        return {
          policyName: "",
          policyVersion: "0.0.1",
          rankedCandidates: [],
          explanation: "bad",
          decisionSummary: "bad"
        };
      }
    };

    const reg = createPolicyRegistry();
    reg.register(badRanking.descriptor, badRanking);
    reg.register(defaultFundWaterfallPolicyStub.descriptor, defaultFundWaterfallPolicyStub);
    reg.register(defaultCandidateSelectionPolicyStub.descriptor, defaultCandidateSelectionPolicyStub);

    const config: PolicyConfigurationRoot = {
      ...validConfig,
      ranking: badRanking.descriptor
    };
    const resolved = resolvePolicyBundle(config, reg);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const result = dryRunPolicyBundle(resolved.value);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]!.errorType).toBe("dry_run_failed");
  });
});

describe("Dry-run: exception during policy call detected", () => {
  it("ranking that throws is caught and reported", () => {
    const throwingRanking: RankingPolicy = {
      descriptor: { policyType: "ranking", policyName: "throw-rank", policyVersion: "0.0.1" },
      rank(): RankingPolicyResult {
        throw new Error("deliberate test error");
      }
    };

    const reg = createPolicyRegistry();
    reg.register(throwingRanking.descriptor, throwingRanking);
    reg.register(defaultFundWaterfallPolicyStub.descriptor, defaultFundWaterfallPolicyStub);
    reg.register(defaultCandidateSelectionPolicyStub.descriptor, defaultCandidateSelectionPolicyStub);

    const config: PolicyConfigurationRoot = {
      ...validConfig,
      ranking: throwingRanking.descriptor
    };
    const resolved = resolvePolicyBundle(config, reg);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const result = dryRunPolicyBundle(resolved.value);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.message.includes("threw exception"))).toBe(true);
  });
});

describe("Dry-run: stub policy execution correctness", () => {
  it("ranking stub sorts by score descending", () => {
    const caseId = "test-case" as RiskCaseId;
    const result = defaultRankingPolicyStub.rank({
      caseId,
      candidates: [
        { accountId: "a1", score: 3 },
        { accountId: "a2", score: 9 },
        { accountId: "a3", score: 1 }
      ]
    });
    expect(result.rankedCandidates[0]!.accountId).toBe("a2");
    expect(result.rankedCandidates[2]!.accountId).toBe("a3");
  });

  it("waterfall stub allocates by priority", () => {
    const caseId = "test-case" as RiskCaseId;
    const result = defaultFundWaterfallPolicyStub.allocate({
      caseId,
      requestedAmount: "150",
      availableSources: [
        { sourceId: "s1", sourceType: "insurance", availableAmount: "100", priority: 2 },
        { sourceId: "s2", sourceType: "reserve", availableAmount: "200", priority: 1 }
      ]
    });
    expect(result.allocations[0]!.sourceId).toBe("s2");
    expect(result.totalAllocated).toBe("150");
  });

  it("selection stub filters positive scores", () => {
    const caseId = "test-case" as RiskCaseId;
    const result = defaultCandidateSelectionPolicyStub.select({
      caseId,
      candidates: [
        { accountId: "a1", score: 5 },
        { accountId: "a2", score: -1 },
        { accountId: "a3", score: 0 }
      ],
      selectionCriteria: "positive_score"
    });
    expect(result.selectedCandidates.length).toBe(1);
    expect(result.excludedCount).toBe(2);
    expect(result.selectedCandidates[0]!.accountId).toBe("a1");
  });
});
