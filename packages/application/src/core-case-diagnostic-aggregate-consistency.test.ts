import { describe, expect, it } from "vitest";

import { validateCoreCaseDiagnosticAggregateConsistency } from "./core-case-diagnostic-aggregate-consistency.js";

describe("validateCoreCaseDiagnosticAggregateConsistency", () => {
  it("passes on coherent aggregate state", () => {
    const result = validateCoreCaseDiagnosticAggregateConsistency({
      aggregate: {
        factKey: "risk|adl|1",
        currentReadViewStatus: "persisted",
        validationStatus: "passed",
        riskLevel: "low",
        manualActionHint: "no_action_needed",
        riskReason: "stable",
        actionHintReason: "stable",
        assessmentRulesVersion: "1.0.0",
        aggregateSummary: "stable",
        primaryReason: "stable",
        recommendedNextStep: "no_action_needed",
        requiresAttention: false,
        requiresRepairAction: false,
        requiresManualReview: false,
        isCrossSessionConsistent: true,
        explanationStatus: "fully_explained"
      }
    });
    expect(result.status).toBe("passed");
  });

  it("fails when command-link is inconsistent but cross-session flag is true", () => {
    const result = validateCoreCaseDiagnosticAggregateConsistency({
      aggregate: {
        factKey: "risk|adl|2",
        currentReadViewStatus: "fallback_only",
        validationStatus: "failed",
        riskLevel: "high",
        manualActionHint: "investigate_validation_conflict",
        riskReason: "conflict",
        actionHintReason: "manual inspect",
        assessmentRulesVersion: "1.0.0",
        suppressionStateRepairCommandLink: {
          commandLinkConsistencyStatus: "status_mismatch",
          commandLinkConsistencyReason: "mismatch"
        },
        aggregateSummary: "bad",
        primaryReason: "bad",
        recommendedNextStep: "investigate",
        requiresAttention: true,
        requiresRepairAction: true,
        requiresManualReview: true,
        isCrossSessionConsistent: true,
        explanationStatus: "attention_required"
      }
    });
    expect(result.status).toBe("failed");
    expect(result.reason).toContain("command-link");
  });
});

