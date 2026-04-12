import { describe, expect, it } from "vitest";
import type { RiskCaseId } from "@tianqi/shared";
import { prioritySequentialFundWaterfallPolicyV1 } from "./priority-sequential-fund-waterfall-policy-v1.js";

const caseId = "rc-waterfall-test" as RiskCaseId;

describe("PrioritySequentialFundWaterfallPolicyV1: single source sufficient", () => {
  it("uses only first source when sufficient", () => {
    const result = prioritySequentialFundWaterfallPolicyV1.allocate({
      caseId,
      requestedAmount: "100",
      availableSources: [
        { sourceId: "s1", sourceType: "insurance", availableAmount: "500", priority: 1 },
        { sourceId: "s2", sourceType: "reserve", availableAmount: "300", priority: 2 }
      ]
    });
    expect(result.allocations.length).toBe(1);
    expect(result.allocations[0]!.sourceId).toBe("s1");
    expect(result.allocations[0]!.allocatedAmount).toBe("100");
    expect(result.allocations[0]!.remainingAmount).toBe("400");
    expect(result.totalAllocated).toBe("100");
    expect(result.shortfallAmount).toBe("0");
    expect(result.explanation).toContain("Fully funded");
  });

  it("descriptor fields are correct", () => {
    const result = prioritySequentialFundWaterfallPolicyV1.allocate({
      caseId,
      requestedAmount: "10",
      availableSources: [{ sourceId: "s1", sourceType: "reserve", availableAmount: "100", priority: 1 }]
    });
    expect(result.policyName).toBe("priority-sequential");
    expect(result.policyVersion).toBe("1.0.0");
  });
});

describe("PrioritySequentialFundWaterfallPolicyV1: multi-source cascade", () => {
  it("consumes sources sequentially by priority", () => {
    const result = prioritySequentialFundWaterfallPolicyV1.allocate({
      caseId,
      requestedAmount: "250",
      availableSources: [
        { sourceId: "s2", sourceType: "reserve", availableAmount: "100", priority: 2 },
        { sourceId: "s1", sourceType: "insurance", availableAmount: "200", priority: 1 },
        { sourceId: "s3", sourceType: "margin", availableAmount: "300", priority: 3 }
      ]
    });
    expect(result.allocations.length).toBe(2);
    expect(result.allocations[0]!.sourceId).toBe("s1");
    expect(result.allocations[0]!.allocatedAmount).toBe("200");
    expect(result.allocations[0]!.remainingAmount).toBe("0");
    expect(result.allocations[1]!.sourceId).toBe("s2");
    expect(result.allocations[1]!.allocatedAmount).toBe("50");
    expect(result.allocations[1]!.remainingAmount).toBe("50");
    expect(result.totalAllocated).toBe("250");
    expect(result.shortfallAmount).toBe("0");
  });
});

describe("PrioritySequentialFundWaterfallPolicyV1: shortfall", () => {
  it("reports shortfall when total funds insufficient", () => {
    const result = prioritySequentialFundWaterfallPolicyV1.allocate({
      caseId,
      requestedAmount: "500",
      availableSources: [
        { sourceId: "s1", sourceType: "insurance", availableAmount: "200", priority: 1 },
        { sourceId: "s2", sourceType: "reserve", availableAmount: "100", priority: 2 }
      ]
    });
    expect(result.allocations.length).toBe(2);
    expect(result.totalAllocated).toBe("300");
    expect(result.shortfallAmount).toBe("200");
    expect(result.explanation).toContain("Shortfall");
    expect(result.explanation).toContain("200");
    expect(result.decisionSummary).toContain("shortfall");
  });

  it("handles no sources available", () => {
    const result = prioritySequentialFundWaterfallPolicyV1.allocate({
      caseId,
      requestedAmount: "100",
      availableSources: []
    });
    expect(result.allocations.length).toBe(0);
    expect(result.totalAllocated).toBe("0");
    expect(result.shortfallAmount).toBe("100");
  });
});

describe("PrioritySequentialFundWaterfallPolicyV1: explanation", () => {
  it("explanation lists used sources", () => {
    const result = prioritySequentialFundWaterfallPolicyV1.allocate({
      caseId,
      requestedAmount: "150",
      availableSources: [
        { sourceId: "primary", sourceType: "insurance", availableAmount: "100", priority: 1 },
        { sourceId: "backup", sourceType: "reserve", availableAmount: "200", priority: 2 }
      ]
    });
    expect(result.explanation).toContain("primary");
    expect(result.explanation).toContain("backup");
    expect(result.explanation).toContain("Sequential waterfall");
  });
});
