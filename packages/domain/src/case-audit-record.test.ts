import { createTraceId } from "@tianqi/shared";
import { describe, expect, it } from "vitest";

import { CORE_CASE_AUDIT_TYPES, createCaseAuditRecord } from "./case-audit-record.js";

describe("CaseAuditRecord", () => {
  it("creates minimal audit record for case transition", () => {
    const created = createCaseAuditRecord({
      caseType: CORE_CASE_AUDIT_TYPES.RiskCase,
      caseId: "risk-case-001",
      action: "StartValidation",
      beforeState: "Detected",
      afterState: "Validating",
      reason: "begin review",
      traceId: createTraceId("trace-audit-create"),
      occurredAt: new Date("2026-03-25T00:00:01.000Z")
    });

    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.caseType).toBe(CORE_CASE_AUDIT_TYPES.RiskCase);
      expect(created.value.auditId).toContain("RiskCase:risk-case-001:StartValidation");
    }
  });

  it("rejects empty reason", () => {
    const created = createCaseAuditRecord({
      caseType: CORE_CASE_AUDIT_TYPES.LiquidationCase,
      caseId: "liq-case-001",
      action: "StartProgress",
      beforeState: "Initiated",
      afterState: "InProgress",
      reason: "  ",
      traceId: createTraceId("trace-audit-invalid"),
      occurredAt: new Date("2026-03-25T00:00:01.000Z")
    });

    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.error.code).toBe("TQ-DOM-001");
    }
  });

  it("supports linkage context with related case", () => {
    const created = createCaseAuditRecord({
      caseType: CORE_CASE_AUDIT_TYPES.ADLCase,
      caseId: "adl-case-001",
      action: "Queue",
      beforeState: "Initiated",
      afterState: "Queued",
      reason: "linked to source risk case",
      traceId: createTraceId("trace-audit-linked"),
      occurredAt: new Date("2026-03-25T00:00:01.000Z"),
      relatedCaseType: CORE_CASE_AUDIT_TYPES.RiskCase,
      relatedCaseId: "risk-case-001"
    });

    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.relatedCaseType).toBe(CORE_CASE_AUDIT_TYPES.RiskCase);
      expect(created.value.relatedCaseId).toBe("risk-case-001");
    }
  });

  it("rejects relatedCaseType without relatedCaseId", () => {
    const created = createCaseAuditRecord({
      caseType: CORE_CASE_AUDIT_TYPES.LiquidationCase,
      caseId: "liq-case-002",
      action: "Complete",
      beforeState: "InProgress",
      afterState: "Completed",
      reason: "complete",
      traceId: createTraceId("trace-audit-related-missing-id"),
      occurredAt: new Date("2026-03-25T00:00:01.000Z"),
      relatedCaseType: CORE_CASE_AUDIT_TYPES.RiskCase
    });

    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.error.code).toBe("TQ-DOM-001");
    }
  });

  it("supports audit context metadata for coordination reasoning", () => {
    const created = createCaseAuditRecord({
      caseType: CORE_CASE_AUDIT_TYPES.RiskCase,
      caseId: "risk-case-200",
      action: "MarkRiskCaseUnderReviewAfterSubcaseCompletion",
      beforeState: "Liquidating",
      afterState: "Liquidating",
      reason: "other active subcase blocks close",
      traceId: createTraceId("trace-audit-context"),
      occurredAt: new Date("2026-03-25T00:00:02.000Z"),
      relatedCaseType: CORE_CASE_AUDIT_TYPES.LiquidationCase,
      relatedCaseId: "liq-case-200",
      context: {
        other_active_subcase_exists: "true",
        arbitration_rule: "active_subcase_blocks_close"
      }
    });

    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.context?.other_active_subcase_exists).toBe("true");
      expect(created.value.context?.arbitration_rule).toBe("active_subcase_blocks_close");
    }
  });
});
