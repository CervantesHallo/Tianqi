import { describe, expect, it } from "vitest";
import type { RiskCaseId } from "@tianqi/shared";
import {
  createThresholdCandidateSelectionPolicyV1,
  thresholdCandidateSelectionPolicyV1
} from "./threshold-candidate-selection-policy-v1.js";

const caseId = "rc-selection-test" as RiskCaseId;

describe("ThresholdCandidateSelectionPolicyV1: basic filtering", () => {
  it("selects candidates with score >= threshold", () => {
    const policy = createThresholdCandidateSelectionPolicyV1(5);
    const result = policy.select({
      caseId,
      candidates: [
        { accountId: "a1", score: 10 },
        { accountId: "a2", score: 3 },
        { accountId: "a3", score: 5 },
        { accountId: "a4", score: 1 }
      ],
      selectionCriteria: "score >= 5"
    });
    expect(result.selectedCandidates.length).toBe(2);
    expect(result.selectedCandidates.map((c) => c.accountId)).toContain("a1");
    expect(result.selectedCandidates.map((c) => c.accountId)).toContain("a3");
    expect(result.appliedThreshold).toBe(5);
  });

  it("rejected candidates have rejection reasons", () => {
    const policy = createThresholdCandidateSelectionPolicyV1(5);
    const result = policy.select({
      caseId,
      candidates: [
        { accountId: "a1", score: 10 },
        { accountId: "a2", score: 3 }
      ],
      selectionCriteria: "score >= 5"
    });
    expect(result.rejectedCandidates.length).toBe(1);
    expect(result.rejectedCandidates[0]!.accountId).toBe("a2");
    expect(result.rejectedCandidates[0]!.rejectionReason).toContain("3");
    expect(result.rejectedCandidates[0]!.rejectionReason).toContain("5");
    expect(result.excludedCount).toBe(1);
  });

  it("descriptor fields are correct", () => {
    const result = thresholdCandidateSelectionPolicyV1.select({
      caseId,
      candidates: [{ accountId: "a1", score: 1 }],
      selectionCriteria: "test"
    });
    expect(result.policyName).toBe("threshold-filter");
    expect(result.policyVersion).toBe("1.0.0");
  });
});

describe("ThresholdCandidateSelectionPolicyV1: threshold edge cases", () => {
  it("threshold=0 selects all non-negative scores", () => {
    const policy = createThresholdCandidateSelectionPolicyV1(0);
    const result = policy.select({
      caseId,
      candidates: [
        { accountId: "a1", score: 0 },
        { accountId: "a2", score: -1 },
        { accountId: "a3", score: 5 }
      ],
      selectionCriteria: "score >= 0"
    });
    expect(result.selectedCandidates.length).toBe(2);
    expect(result.rejectedCandidates.length).toBe(1);
    expect(result.rejectedCandidates[0]!.accountId).toBe("a2");
    expect(result.appliedThreshold).toBe(0);
  });

  it("high threshold rejects all", () => {
    const policy = createThresholdCandidateSelectionPolicyV1(100);
    const result = policy.select({
      caseId,
      candidates: [
        { accountId: "a1", score: 50 },
        { accountId: "a2", score: 99 }
      ],
      selectionCriteria: "score >= 100"
    });
    expect(result.selectedCandidates.length).toBe(0);
    expect(result.rejectedCandidates.length).toBe(2);
    expect(result.excludedCount).toBe(2);
  });
});

describe("ThresholdCandidateSelectionPolicyV1: explanation", () => {
  it("explanation describes threshold and rejected scores", () => {
    const policy = createThresholdCandidateSelectionPolicyV1(5);
    const result = policy.select({
      caseId,
      candidates: [
        { accountId: "a1", score: 10 },
        { accountId: "a2", score: 2 },
        { accountId: "a3", score: 1 }
      ],
      selectionCriteria: "risk score"
    });
    expect(result.explanation).toContain("Threshold filter");
    expect(result.explanation).toContain("5");
    expect(result.explanation).toContain("2 rejected");
    expect(result.decisionSummary).toContain("threshold=5");
  });

  it("selected candidate reasons include threshold", () => {
    const policy = createThresholdCandidateSelectionPolicyV1(3);
    const result = policy.select({
      caseId,
      candidates: [{ accountId: "a1", score: 7 }],
      selectionCriteria: "test"
    });
    expect(result.selectedCandidates[0]!.selectionReason).toContain("7");
    expect(result.selectedCandidates[0]!.selectionReason).toContain("3");
  });
});
