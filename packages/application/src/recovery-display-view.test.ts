import { createCommandResultReference, createSinkRecoveryReferenceId } from "@tianqi/shared";
import { describe, expect, it } from "vitest";

import type { MarkSinkFailureManuallyResolvedResult } from "./sink-failure-recovery-record-model.js";
import type { SinkFailureRecoveryQueryResultWithDiagnostics } from "./sink-failure-recovery-record-model.js";
import type { SinkFailureRecoveryView } from "./sink-failure-recovery.js";
import {
  RECOVERY_DISPLAY_COMPATIBILITY_POLICY,
  RECOVERY_DISPLAY_CORE_FIELDS,
  RECOVERY_DISPLAY_MAIN_OUTCOMES,
  RECOVERY_DISPLAY_VIEW_VERSION,
  assertRecoveryDisplayViewCompatibility,
  evaluateRecoveryNeedsAttention,
  mapManualResolveToDisplayView,
  mapRecoveryAppendToDisplayView,
  mapRecoveryQueryToDisplayView
} from "./recovery-display-view.js";

describe("recovery display view mapping", () => {
  it("maps append success to unified display view", () => {
    const recoveryReference = createSinkRecoveryReferenceId("recovery-display-append-success");
    const appendView: SinkFailureRecoveryView = {
      sinkKind: "audit",
      retryEligibility: "eligible_for_retry",
      recoveryReference: {
        sinkKind: "audit",
        recoveryId: recoveryReference,
        sourceCommandName: "ResolveCompensationCommand",
        caseId: "case-display-001",
        resultReference: createCommandResultReference("result-display-append-001"),
        failedAt: "2026-03-25T00:00:00.000Z",
        traceId: "trace-display-append-001",
        failureCategory: "sink_dependency_failure",
        retryEligibility: "eligible_for_retry"
      },
      recoveryRecord: { status: "persisted" },
      auditEvents: [],
      auditSink: { status: "succeeded" }
    };

    const display = mapRecoveryAppendToDisplayView(appendView);
    assertRecoveryDisplayViewCompatibility(display);
    expect(display.viewVersion).toBe(RECOVERY_DISPLAY_VIEW_VERSION);
    expect(display.mainOutcome).toBe("append_success");
    expect(display.sinkKind).toBe("audit");
    expect(display.recordStatus).toBe("open");
    expect(display.retryEligibility).toBe("eligible_for_retry");
    expect(display.diagnosticsSummary.hasRecoveryRecord).toBe(true);
    expect(display.diagnosticsSummary.needsAttention).toBe(true);
  });

  it("maps append failure to unified display view", () => {
    const recoveryReference = createSinkRecoveryReferenceId("recovery-display-append-failed");
    const appendView: SinkFailureRecoveryView = {
      sinkKind: "metrics",
      retryEligibility: "eligible_for_retry",
      recoveryReference: {
        sinkKind: "metrics",
        recoveryId: recoveryReference,
        sourceQueryName: "CommandResultQueryHandler.getCommandResultByReference",
        resultReference: createCommandResultReference("result-display-append-failed-001"),
        failedAt: "2026-03-25T00:00:00.000Z",
        traceId: "query:result-display-append-failed-001",
        failureCategory: "sink_dependency_failure",
        retryEligibility: "eligible_for_retry"
      },
      recoveryRecord: { status: "persist_failed", errorSummary: "append dependency failed" },
      auditEvents: [],
      auditSink: { status: "not_attempted" }
    };

    const display = mapRecoveryAppendToDisplayView(appendView);
    assertRecoveryDisplayViewCompatibility(display);
    expect(display.viewVersion).toBe(RECOVERY_DISPLAY_VIEW_VERSION);
    expect(display.mainOutcome).toBe("append_failed");
    expect(display.recordStatus).toBe("none");
    expect(display.retryEligibility).toBe("not_applicable");
    expect(display.diagnosticsSummary.hasRecoveryRecord).toBe(false);
    expect(display.diagnosticsSummary.needsAttention).toBe(true);
  });

  it("maps manual resolve success to unified display view", () => {
    const recoveryReference = createSinkRecoveryReferenceId("recovery-display-manual-resolved");
    const manualResult: MarkSinkFailureManuallyResolvedResult = {
      success: true,
      record: {
        recoveryReference,
        sinkKind: "audit",
        retryEligibility: "eligible_for_retry",
        failureCategory: "sink_dependency_failure",
        resultReference: createCommandResultReference("result-display-manual-resolved-001"),
        sourceCommandName: "ResolveCompensationCommand",
        caseId: "case-display-manual-001",
        traceId: "trace-display-manual-001",
        createdAt: "2026-03-25T00:00:00.000Z",
        status: "manually_resolved"
      },
      auditEvents: [
        {
          eventType: "RecoveryRecordChanged",
          eventKind: "RecoveryRecordManuallyResolved",
          recoveryReference,
          beforeStatus: "open",
          afterStatus: "manually_resolved",
          sinkKind: "audit",
          resultReference: createCommandResultReference("result-display-manual-resolved-001"),
          caseId: "case-display-manual-001",
          traceId: "trace-display-manual-001",
          occurredAt: "2026-03-25T00:10:00.000Z"
        }
      ],
      auditSink: { status: "succeeded" }
    };

    const display = mapManualResolveToDisplayView({
      recoveryReference,
      result: manualResult
    });
    assertRecoveryDisplayViewCompatibility(display);
    expect(display.viewVersion).toBe(RECOVERY_DISPLAY_VIEW_VERSION);
    expect(display.mainOutcome).toBe("manual_resolved");
    expect(display.recordStatus).toBe("manually_resolved");
    expect(display.diagnosticsSummary.needsAttention).toBe(false);
    expect("auditEvents" in display).toBe(false);
    expect("error" in display).toBe(false);
  });

  it("maps query found/missing/unavailable to unified display view", () => {
    const foundReference = createSinkRecoveryReferenceId("recovery-display-query-found");
    const foundResult: SinkFailureRecoveryQueryResultWithDiagnostics = {
      status: "found",
      record: {
        recoveryReference: foundReference,
        sinkKind: "metrics",
        retryEligibility: "eligible_for_retry",
        failureCategory: "sink_dependency_failure",
        resultReference: createCommandResultReference("result-display-query-found-001"),
        sourceQueryName: "CommandResultQueryHandler.getCommandResultByReference",
        traceId: "query:result-display-query-found-001",
        createdAt: "2026-03-25T00:00:00.000Z",
        status: "open",
        note: "follow up required"
      },
      diagnostics: {
        outcome: "found",
        statusCategory: "open",
        retryEligibilityCategory: "eligible_for_retry",
        hasNote: true,
        storeAccessed: true,
        fallbackApplied: false
      },
      metricsSink: { status: "succeeded" }
    };
    const missingReference = createSinkRecoveryReferenceId("recovery-display-query-missing");
    const missingResult: SinkFailureRecoveryQueryResultWithDiagnostics = {
      status: "missing",
      recoveryReference: missingReference,
      diagnostics: {
        outcome: "missing",
        statusCategory: "none",
        retryEligibilityCategory: "not_applicable",
        hasNote: false,
        storeAccessed: true,
        fallbackApplied: false
      },
      metricsSink: { status: "succeeded" }
    };
    const unavailableReference = createSinkRecoveryReferenceId(
      "recovery-display-query-unavailable"
    );
    const unavailableResult: SinkFailureRecoveryQueryResultWithDiagnostics = {
      status: "unavailable",
      recoveryReference: unavailableReference,
      diagnostics: {
        outcome: "unavailable",
        statusCategory: "none",
        retryEligibilityCategory: "not_applicable",
        hasNote: false,
        storeAccessed: true,
        fallbackApplied: false
      },
      metricsSink: { status: "failed", errorSummary: "metrics sink failed" },
      error: {
        code: "TQ-APP-004",
        source: "application",
        reason: "dependency_failure",
        message: "query unavailable"
      }
    };

    const foundDisplay = mapRecoveryQueryToDisplayView(foundResult);
    const missingDisplay = mapRecoveryQueryToDisplayView(missingResult);
    const unavailableDisplay = mapRecoveryQueryToDisplayView(unavailableResult);

    assertRecoveryDisplayViewCompatibility(foundDisplay);
    assertRecoveryDisplayViewCompatibility(missingDisplay);
    assertRecoveryDisplayViewCompatibility(unavailableDisplay);
    expect(foundDisplay.viewVersion).toBe(RECOVERY_DISPLAY_VIEW_VERSION);
    expect(missingDisplay.viewVersion).toBe(RECOVERY_DISPLAY_VIEW_VERSION);
    expect(unavailableDisplay.viewVersion).toBe(RECOVERY_DISPLAY_VIEW_VERSION);

    expect(foundDisplay.mainOutcome).toBe("query_found");
    expect(foundDisplay.diagnosticsSummary.hasNote).toBe(true);
    expect(missingDisplay.mainOutcome).toBe("query_missing");
    expect(missingDisplay.recordStatus).toBe("none");
    expect(unavailableDisplay.mainOutcome).toBe("query_unavailable");
    expect(unavailableDisplay.diagnosticsSummary.needsAttention).toBe(true);
  });

  it("keeps core fields present across append/manual/query mappings", () => {
    const recoveryReference = createSinkRecoveryReferenceId("recovery-display-core-fields");
    const appendDisplay = mapRecoveryAppendToDisplayView({
      sinkKind: "audit",
      retryEligibility: "eligible_for_retry",
      recoveryReference: {
        sinkKind: "audit",
        recoveryId: recoveryReference,
        sourceCommandName: "ResolveCompensationCommand",
        caseId: "case-core-fields-001",
        resultReference: createCommandResultReference("result-core-fields-append"),
        failedAt: "2026-03-25T00:00:00.000Z",
        traceId: "trace-core-fields-append",
        failureCategory: "sink_dependency_failure",
        retryEligibility: "eligible_for_retry"
      },
      recoveryRecord: { status: "persisted" },
      auditEvents: [],
      auditSink: { status: "succeeded" }
    });
    const manualDisplay = mapManualResolveToDisplayView({
      recoveryReference,
      result: {
        success: false,
        state: "missing",
        error: {
          code: "TQ-APP-003",
          source: "application",
          reason: "resource_not_found",
          message: "missing"
        },
        auditEvents: [],
        auditSink: { status: "not_attempted" }
      }
    });
    const queryDisplay = mapRecoveryQueryToDisplayView({
      status: "missing",
      recoveryReference,
      diagnostics: {
        outcome: "missing",
        statusCategory: "none",
        retryEligibilityCategory: "not_applicable",
        hasNote: false,
        storeAccessed: true,
        fallbackApplied: false
      },
      metricsSink: { status: "succeeded" }
    });

    for (const view of [appendDisplay, manualDisplay, queryDisplay]) {
      for (const field of RECOVERY_DISPLAY_CORE_FIELDS) {
        expect(view[field]).not.toBeUndefined();
      }
      expect(RECOVERY_DISPLAY_MAIN_OUTCOMES).toContain(view.mainOutcome);
      expect(view.diagnosticsSummary).toMatchObject({
        hasRecoveryRecord: expect.any(Boolean),
        recordStatus: expect.any(String),
        retryEligibility: expect.any(String),
        hasNote: expect.any(Boolean),
        latestSinkStatus: expect.any(String),
        queryOutcome: expect.any(String),
        manualInterventionRequired: expect.any(Boolean),
        needsAttention: expect.any(Boolean)
      });
    }
  });

  it("freezes display compatibility policy baseline", () => {
    expect(RECOVERY_DISPLAY_COMPATIBILITY_POLICY).toEqual({
      addField: "allowed_if_optional_or_defaulted",
      removeField: "forbidden_in_phase1",
      renameField: "forbidden_in_phase1",
      semanticChange: "requires_view_version_bump"
    });
  });
});

describe("recovery needsAttention rules", () => {
  it("returns true for open record with retry eligibility", () => {
    expect(
      evaluateRecoveryNeedsAttention({
        mainOutcome: "append_success",
        hasRecoveryRecord: true,
        recordStatus: "open",
        retryEligibility: "eligible_for_retry",
        queryOutcome: "not_applicable",
        manualInterventionRequired: false
      })
    ).toBe(true);
  });

  it("returns true for query unavailable", () => {
    expect(
      evaluateRecoveryNeedsAttention({
        mainOutcome: "query_unavailable",
        hasRecoveryRecord: false,
        recordStatus: "none",
        retryEligibility: "not_applicable",
        queryOutcome: "unavailable",
        manualInterventionRequired: false
      })
    ).toBe(true);
  });

  it("returns true for manual intervention required source", () => {
    expect(
      evaluateRecoveryNeedsAttention({
        mainOutcome: "append_success",
        hasRecoveryRecord: true,
        recordStatus: "open",
        retryEligibility: "eligible_for_retry",
        queryOutcome: "not_applicable",
        manualInterventionRequired: true
      })
    ).toBe(true);
  });

  it("returns false for manually resolved stable state", () => {
    expect(
      evaluateRecoveryNeedsAttention({
        mainOutcome: "manual_resolved",
        hasRecoveryRecord: true,
        recordStatus: "manually_resolved",
        retryEligibility: "eligible_for_retry",
        queryOutcome: "not_applicable",
        manualInterventionRequired: false
      })
    ).toBe(false);
  });
});
