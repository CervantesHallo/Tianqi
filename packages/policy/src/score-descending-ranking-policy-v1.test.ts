import { describe, expect, it } from "vitest";
import type { RiskCaseId } from "@tianqi/shared";
import { scoreDescendingRankingPolicyV1 } from "./score-descending-ranking-policy-v1.js";

const caseId = "rc-rank-test" as RiskCaseId;

describe("ScoreDescendingRankingPolicyV1: basic ranking", () => {
  it("sorts by score descending", () => {
    const result = scoreDescendingRankingPolicyV1.rank({
      caseId,
      candidates: [
        { accountId: "a1", score: 3 },
        { accountId: "a2", score: 9 },
        { accountId: "a3", score: 1 }
      ]
    });
    expect(result.rankedCandidates[0]!.accountId).toBe("a2");
    expect(result.rankedCandidates[1]!.accountId).toBe("a1");
    expect(result.rankedCandidates[2]!.accountId).toBe("a3");
  });

  it("descriptor fields are correct", () => {
    const result = scoreDescendingRankingPolicyV1.rank({
      caseId,
      candidates: [{ accountId: "a1", score: 1 }]
    });
    expect(result.policyName).toBe("score-descending");
    expect(result.policyVersion).toBe("1.0.0");
  });
});

describe("ScoreDescendingRankingPolicyV1: tie-break", () => {
  it("breaks ties by accountId lexicographic order", () => {
    const result = scoreDescendingRankingPolicyV1.rank({
      caseId,
      candidates: [
        { accountId: "charlie", score: 5 },
        { accountId: "alice", score: 5 },
        { accountId: "bob", score: 5 }
      ]
    });
    expect(result.rankedCandidates[0]!.accountId).toBe("alice");
    expect(result.rankedCandidates[1]!.accountId).toBe("bob");
    expect(result.rankedCandidates[2]!.accountId).toBe("charlie");
    expect(result.explanation).toContain("tie");
    expect(result.decisionSummary).toContain("tie");
  });

  it("stable across repeated calls with same input", () => {
    const input = {
      caseId,
      candidates: [
        { accountId: "b", score: 7 },
        { accountId: "a", score: 7 },
        { accountId: "c", score: 3 }
      ]
    };
    const r1 = scoreDescendingRankingPolicyV1.rank(input);
    const r2 = scoreDescendingRankingPolicyV1.rank(input);
    expect(r1.rankedCandidates.map((c) => c.accountId))
      .toEqual(r2.rankedCandidates.map((c) => c.accountId));
  });
});

describe("ScoreDescendingRankingPolicyV1: explanation", () => {
  it("explanation contains top and bottom candidates", () => {
    const result = scoreDescendingRankingPolicyV1.rank({
      caseId,
      candidates: [
        { accountId: "top", score: 100 },
        { accountId: "bottom", score: 1 }
      ]
    });
    expect(result.explanation).toContain("top");
    expect(result.explanation).toContain("bottom");
    expect(result.explanation).toContain("100");
    expect(result.explanation).toContain("1");
  });

  it("handles empty candidates", () => {
    const result = scoreDescendingRankingPolicyV1.rank({ caseId, candidates: [] });
    expect(result.rankedCandidates.length).toBe(0);
    expect(result.explanation).toContain("No candidates");
  });
});
