import { createCommandResultReference, createSinkRecoveryReferenceId } from "@tianqi/shared";
import { describe, expect, it } from "vitest";

import {
  RECOVERY_DISPLAY_VIEW_VERSION,
  mapManualResolveToDisplayView,
  mapRecoveryAppendToDisplayView,
  mapRecoveryQueryToDisplayView,
  type RecoveryDisplayView
} from "./recovery-display-view.js";
import {
  RECOVERY_ADAPTER_CHANGE_CLASSIFICATIONS,
  RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY,
  RECOVERY_ADAPTER_CHANGE_REVIEW_ACTIONS,
  RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS,
  RECOVERY_BASELINE_AFFECTED_PATHS,
  RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE,
  RECOVERY_CADENCE_GUIDANCE_ALIGNMENT,
  RECOVERY_CADENCE_GUIDANCE_EXAMPLES,
  RECOVERY_CADENCE_LEVELS,
  RECOVERY_REVIEW_PHRASE_EXAMPLES,
  RECOVERY_REVIEW_PHRASE_GUIDANCE,
  RECOVERY_REVIEW_PHRASE_GUIDANCE_ALIGNMENT,
  RECOVERY_DRIFT_SIGNAL_RESPONSE_EXAMPLES,
  RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES,
  RECOVERY_RETROSPECTIVE_ARCHIVE_AND_COMPARISON_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_ARCHIVE_CHANGE_NOTE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_ARCHIVE_CHANGE_NOTE_TEMPLATE,
  RECOVERY_RETROSPECTIVE_ARCHIVE_FIELD_STABILITY_POLICY,
  RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_EXAMPLES,
  RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_TEMPLATE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_TEMPLATE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_REVIEW_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_GUIDANCE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DRIFT_EXAMPLE_REVIEW_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DRIFT_EXAMPLE_REVIEW_GUIDANCE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_CHECKLIST,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_GUIDANCE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_TEMPLATE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_GUIDANCE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_TEMPLATE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_GUIDANCE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_GUIDANCE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_CHECKLIST,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_TEMPLATE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_TEMPLATE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_GUIDANCE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_TEMPLATE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_CHECKLIST,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_TEMPLATE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_CHECKLIST,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_TEMPLATE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_TEMPLATE,
  RECOVERY_RETROSPECTIVE_CHANGE_NOTE_PHRASE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_CHANGE_NOTE_PHRASES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_AND_CHANGE_NOTE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_REVIEW_CADENCE_GUIDANCE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_TEMPLATE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_ALIGNMENT,
  RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_GUIDANCE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_EXAMPLES,
  RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE,
  RECOVERY_RETROSPECTIVE_EXAMPLE_STATUSES,
  RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_EXAMPLES,
  RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE,
  RECOVERY_RETROSPECTIVE_COMPARISON_FIELD_STABILITY_POLICY,
  RECOVERY_RETROSPECTIVE_CONTROLLED_SUMMARY_EXAMPLES,
  RECOVERY_RETROSPECTIVE_CONTROLLED_SUMMARY_WRITING_GUIDANCE,
  RECOVERY_RETROSPECTIVE_COMPARISON_EXAMPLES,
  RECOVERY_RETROSPECTIVE_COMPARISON_SEMANTICS,
  RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE,
  RECOVERY_RETROSPECTIVE_OUTCOME_AND_RESPONSE_ALIGNMENT,
  RECOVERY_TERMINOLOGY_DRIFT_SIGNAL_KEYS,
  RECOVERY_TERMINOLOGY_DRIFT_SIGNALS,
  RECOVERY_TRACE_CLOSURE_RETROSPECTIVE_CHECKLIST,
  RECOVERY_TRACE_CLOSURE_RETROSPECTIVE_CHECKLIST_ITEMS,
  RECOVERY_TRACE_CLOSURE_REVIEW_CADENCE_GUIDANCE,
  RECOVERY_TRACE_CLOSURE_REVIEW_EXAMPLES,
  RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_EXAMPLES,
  RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE,
  RECOVERY_TRACE_REVIEW_CADENCE_AND_MAINTENANCE_RELATION,
  RECOVERY_TRACE_CLOSURE_MAINTENANCE_GUIDANCE,
  RECOVERY_TRACE_CLOSURE_MAINTENANCE_TRIGGERS,
  RECOVERY_TRACE_CONSISTENCY_ALIGNMENT,
  RECOVERY_TRACE_CONSISTENCY_CHECKLIST,
  RECOVERY_TRACE_CONSISTENCY_CHECKLIST_EXAMPLES,
  RECOVERY_TRACE_CONSISTENCY_CHECKLIST_ITEMS,
  RECOVERY_TRACE_DOCUMENT_REFERENCE_ALIGNMENT,
  RECOVERY_TRACE_DOCUMENT_REFERENCE_EXAMPLES,
  RECOVERY_TRACE_DOCUMENT_REFERENCE_SOURCE_OPTIONS,
  RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE,
  RECOVERY_DTO_BASELINE_HISTORY_ARCHIVE_FIELDS,
  RECOVERY_CLASSIFICATION_ALIGNMENT,
  RECOVERY_DTO_BASELINE_HISTORY_ENTRY_EXAMPLES,
  RECOVERY_DTO_BASELINE_HISTORY_ENTRY_FIELDS,
  RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE,
  RECOVERY_DTO_BASELINE_HISTORY_TO_REASON_ALIGNMENT,
  RECOVERY_DISPLAY_CHANGE_IMPACT_CHECKLIST_ITEMS,
  RECOVERY_DTO_BASELINE_UPDATE_RULES,
  RECOVERY_DTO_BASELINE_UPDATE_REASON_EXAMPLES,
  RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE,
  RECOVERY_DTO_FORK_POLICY,
  RECOVERY_EXTERNAL_DTO_FIELDS,
  RECOVERY_EXTERNAL_SHARED_CORE_FIELDS,
  RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE,
  RECOVERY_REVIEW_TRACE_ALIGNMENT,
  RECOVERY_REVIEW_TRACE_EXAMPLES,
  RECOVERY_REVIEW_TRACE_FIELDS,
  RECOVERY_REVIEW_TRACE_TEMPLATE,
  RECOVERY_SHARED_CORE_FIELD_CHANGE_WARNING_TEMPLATE,
  RECOVERY_WARNING_TO_IMPACT_CHECKLIST_ALIGNMENT,
  createRecoveryDisplayChangeImpactChecklistTemplate,
  mapRecoveryExternalDtoToApiDto,
  mapRecoveryExternalDtoToConsoleDto,
  mapRecoveryDisplayViewToExternalDto
} from "./recovery-display-adapter.js";
import type { MarkSinkFailureManuallyResolvedResult } from "./sink-failure-recovery-record-model.js";
import type { SinkFailureRecoveryQueryResultWithDiagnostics } from "./sink-failure-recovery-record-model.js";
import type { SinkFailureRecoveryView } from "./sink-failure-recovery.js";

const buildAppendDisplay = (): RecoveryDisplayView => {
  const recoveryReference = createSinkRecoveryReferenceId("adapter-append-display-001");
  const appendView: SinkFailureRecoveryView = {
    sinkKind: "audit",
    retryEligibility: "eligible_for_retry",
    recoveryReference: {
      sinkKind: "audit",
      recoveryId: recoveryReference,
      sourceCommandName: "ResolveCompensationCommand",
      caseId: "case-adapter-append-001",
      resultReference: createCommandResultReference("result-adapter-append-001"),
      failedAt: "2026-03-25T00:00:00.000Z",
      traceId: "trace-adapter-append-001",
      failureCategory: "sink_dependency_failure",
      retryEligibility: "eligible_for_retry"
    },
    recoveryRecord: { status: "persisted" },
    auditEvents: [],
    auditSink: { status: "succeeded" }
  };
  return mapRecoveryAppendToDisplayView(appendView);
};

const buildManualDisplay = (): RecoveryDisplayView => {
  const recoveryReference = createSinkRecoveryReferenceId("adapter-manual-display-001");
  const manualResult: MarkSinkFailureManuallyResolvedResult = {
    success: true,
    record: {
      recoveryReference,
      sinkKind: "audit",
      retryEligibility: "eligible_for_retry",
      failureCategory: "sink_dependency_failure",
      resultReference: createCommandResultReference("result-adapter-manual-001"),
      sourceCommandName: "ResolveCompensationCommand",
      caseId: "case-adapter-manual-001",
      traceId: "trace-adapter-manual-001",
      createdAt: "2026-03-25T00:00:00.000Z",
      status: "manually_resolved",
      note: "manual done"
    },
    auditEvents: [
      {
        eventType: "RecoveryRecordChanged",
        eventKind: "RecoveryRecordManuallyResolved",
        recoveryReference,
        beforeStatus: "open",
        afterStatus: "manually_resolved",
        sinkKind: "audit",
        resultReference: createCommandResultReference("result-adapter-manual-001"),
        caseId: "case-adapter-manual-001",
        traceId: "trace-adapter-manual-001",
        occurredAt: "2026-03-25T00:10:00.000Z"
      }
    ],
    auditSink: { status: "succeeded" }
  };
  return mapManualResolveToDisplayView({
    recoveryReference,
    result: manualResult
  });
};

const buildQueryDisplay = (): RecoveryDisplayView => {
  const recoveryReference = createSinkRecoveryReferenceId("adapter-query-display-001");
  const queryResult: SinkFailureRecoveryQueryResultWithDiagnostics = {
    status: "found",
    record: {
      recoveryReference,
      sinkKind: "metrics",
      retryEligibility: "eligible_for_retry",
      failureCategory: "sink_dependency_failure",
      resultReference: createCommandResultReference("result-adapter-query-001"),
      sourceQueryName: "CommandResultQueryHandler.getCommandResultByReference",
      traceId: "query:result-adapter-query-001",
      createdAt: "2026-03-25T00:00:00.000Z",
      status: "open"
    },
    diagnostics: {
      outcome: "found",
      statusCategory: "open",
      retryEligibilityCategory: "eligible_for_retry",
      hasNote: false,
      storeAccessed: true,
      fallbackApplied: false
    },
    metricsSink: { status: "succeeded" }
  };
  return mapRecoveryQueryToDisplayView(queryResult);
};

describe("recovery display adapter", () => {
  it("maps RecoveryDisplayView 1.0.0 to external dto", () => {
    const dto = mapRecoveryDisplayViewToExternalDto(buildAppendDisplay());
    expect(dto.viewVersion).toBe(RECOVERY_DISPLAY_VIEW_VERSION);
    expect(dto.mainOutcome).toBe("append_success");
    expect(dto.needsAttention).toBe(true);
    expect(dto.summary.hasRecoveryRecord).toBe(true);
  });

  it("keeps shared dto fields consistent across append/manual/query sources", () => {
    const dtos = [
      mapRecoveryDisplayViewToExternalDto(buildAppendDisplay()),
      mapRecoveryDisplayViewToExternalDto(buildManualDisplay()),
      mapRecoveryDisplayViewToExternalDto(buildQueryDisplay())
    ];

    for (const dto of dtos) {
      for (const field of RECOVERY_EXTERNAL_DTO_FIELDS) {
        expect(dto[field]).not.toBeUndefined();
      }
      for (const field of RECOVERY_EXTERNAL_SHARED_CORE_FIELDS) {
        expect(dto[field]).not.toBeUndefined();
      }
      expect(dto.viewVersion).toBe(RECOVERY_DISPLAY_VIEW_VERSION);
    }
  });

  it("fails adapter mapping when compatibility assertion fails", () => {
    const invalidDisplay = {
      ...buildAppendDisplay(),
      viewVersion: "9.9.9"
    } as unknown as RecoveryDisplayView;

    expect(() => mapRecoveryDisplayViewToExternalDto(invalidDisplay)).toThrow(
      "RecoveryDisplayView viewVersion mismatch"
    );
  });

  it("does not expose internal-only display fields in dto", () => {
    const dto = mapRecoveryDisplayViewToExternalDto(buildManualDisplay());
    expect("diagnosticsSummary" in dto).toBe(false);
    expect("timestamps" in dto).toBe(false);
    expect("manualInterventionRequired" in dto).toBe(false);
  });

  it("keeps console/api lightweight fork placeholders aligned on shared core fields", () => {
    const external = mapRecoveryDisplayViewToExternalDto(buildAppendDisplay());
    const consoleDto = mapRecoveryExternalDtoToConsoleDto(external, { consoleBadge: "attention" });
    const apiDto = mapRecoveryExternalDtoToApiDto(external, { apiContractTag: "stable" });

    for (const field of RECOVERY_EXTERNAL_SHARED_CORE_FIELDS) {
      expect(consoleDto[field]).toEqual(external[field]);
      expect(apiDto[field]).toEqual(external[field]);
    }
    expect(consoleDto.consoleBadge).toBe("attention");
    expect(apiDto.apiContractTag).toBe("stable");
  });

  it("freezes dto fork policy baseline", () => {
    expect(RECOVERY_DTO_FORK_POLICY).toEqual({
      defaultModel: "single_external_dto",
      forkMode: "lightweight_extension_only",
      sharedCoreFieldSemantics: "must_not_diverge",
      compatibilityGate: "must_use_display_compatibility_assertion",
      splitLocation: "external_adapter_layer_only"
    });
  });

  it("keeps append external dto baseline stable", () => {
    const dto = mapRecoveryDisplayViewToExternalDto(buildAppendDisplay());
    expect(dto).toEqual({
      viewVersion: "1.0.0",
      recoveryReference: "adapter-append-display-001",
      sinkKind: "audit",
      mainOutcome: "append_success",
      recordStatus: "open",
      retryEligibility: "eligible_for_retry",
      hasNote: false,
      needsAttention: true,
      sinkStatus: { audit: "succeeded" },
      summary: {
        hasRecoveryRecord: true,
        latestSinkStatus: "succeeded",
        queryOutcome: "not_applicable"
      },
      observedAt: "2026-03-25T00:00:00.000Z"
    });
  });

  it("keeps manual resolve external dto baseline stable", () => {
    const dto = mapRecoveryDisplayViewToExternalDto(buildManualDisplay());
    expect(dto).toEqual({
      viewVersion: "1.0.0",
      recoveryReference: "adapter-manual-display-001",
      sinkKind: "audit",
      mainOutcome: "manual_resolved",
      recordStatus: "manually_resolved",
      retryEligibility: "eligible_for_retry",
      hasNote: true,
      needsAttention: false,
      sinkStatus: { audit: "succeeded" },
      summary: {
        hasRecoveryRecord: true,
        latestSinkStatus: "succeeded",
        queryOutcome: "not_applicable"
      },
      observedAt: "2026-03-25T00:10:00.000Z"
    });
  });

  it("keeps query external dto baseline stable", () => {
    const dto = mapRecoveryDisplayViewToExternalDto(buildQueryDisplay());
    expect(dto).toEqual({
      viewVersion: "1.0.0",
      recoveryReference: "adapter-query-display-001",
      sinkKind: "metrics",
      mainOutcome: "query_found",
      recordStatus: "open",
      retryEligibility: "eligible_for_retry",
      hasNote: false,
      needsAttention: true,
      sinkStatus: { metrics: "succeeded" },
      summary: {
        hasRecoveryRecord: true,
        latestSinkStatus: "succeeded",
        queryOutcome: "found"
      },
      observedAt: "2026-03-25T00:00:00.000Z"
    });
  });
});

describe("recovery adapter change classification", () => {
  it("exposes minimal classification labels", () => {
    expect(RECOVERY_ADAPTER_CHANGE_CLASSIFICATIONS).toEqual([
      "internal_only",
      "non_breaking_external",
      "breaking_external"
    ]);
  });

  it("provides review hints for all classifications", () => {
    expect(Object.keys(RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS)).toEqual(
      RECOVERY_ADAPTER_CHANGE_CLASSIFICATIONS
    );
    for (const classification of RECOVERY_ADAPTER_CHANGE_CLASSIFICATIONS) {
      const hint = RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS[classification];
      expect(hint.classification).toBe(classification);
      expect(hint.reviewer_actions.length).toBeGreaterThan(0);
      for (const action of hint.reviewer_actions) {
        expect(RECOVERY_ADAPTER_CHANGE_REVIEW_ACTIONS).toContain(action);
      }
    }
  });

  it("keeps review hints aligned with classification policy", () => {
    for (const classification of RECOVERY_ADAPTER_CHANGE_CLASSIFICATIONS) {
      expect(RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS[classification].aligns_with_policy).toEqual(
        RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY[classification]
      );
    }
  });

  it("keeps review hints consistent with baseline/warning/checklist gates", () => {
    const checklist = createRecoveryDisplayChangeImpactChecklistTemplate();
    const checklistKeys = Object.keys(checklist);

    expect(RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS.internal_only.reviewer_actions).toContain(
      "confirm_baseline_update_not_required"
    );
    expect(RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS.non_breaking_external.reviewer_actions).toContain(
      "review_baseline_update_need"
    );
    expect(RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS.non_breaking_external.reviewer_actions).toContain(
      "review_rehearsal_update_need"
    );
    expect(RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS.non_breaking_external.reviewer_actions).toContain(
      "review_docs_update_need"
    );

    for (const alignedItem of Object.values(RECOVERY_WARNING_TO_IMPACT_CHECKLIST_ALIGNMENT)) {
      expect(checklistKeys).toContain(alignedItem);
    }

    expect(RECOVERY_CLASSIFICATION_ALIGNMENT.non_breaking_external.checklist_defaults).toEqual({
      touches_shared_core_fields: false,
      touches_external_dto_fields: true,
      requires_version_rehearsal_update: true,
      requires_adapter_test_updates: true,
      requires_docs_update: true
    });
  });

  it("covers baseline update reason examples across three classifications", () => {
    expect(Object.keys(RECOVERY_DTO_BASELINE_UPDATE_REASON_EXAMPLES)).toEqual(
      RECOVERY_ADAPTER_CHANGE_CLASSIFICATIONS
    );

    const internalExample = RECOVERY_DTO_BASELINE_UPDATE_REASON_EXAMPLES.internal_only;
    expect(internalExample.classification).toBe("internal_only");
    expect(internalExample.touched_external_dto_fields).toBe(false);
    expect(internalExample.updated_baseline).toBe(false);
    expect(internalExample.requires_view_version_bump).toBe(false);

    const nonBreakingExample = RECOVERY_DTO_BASELINE_UPDATE_REASON_EXAMPLES.non_breaking_external;
    expect(nonBreakingExample.classification).toBe("non_breaking_external");
    expect(nonBreakingExample.touched_shared_core_fields).toBe(false);
    expect(nonBreakingExample.updated_baseline).toBe(true);
    expect(nonBreakingExample.updated_rehearsal).toBe(true);
    expect(nonBreakingExample.updated_docs).toBe(true);
    expect(nonBreakingExample.requires_view_version_bump).toBe(false);

    const breakingExample = RECOVERY_DTO_BASELINE_UPDATE_REASON_EXAMPLES.breaking_external;
    expect(breakingExample.classification).toBe("breaking_external");
    expect(breakingExample.touched_shared_core_fields).toBe(true);
    expect(breakingExample.updated_baseline).toBe(true);
    expect(breakingExample.requires_view_version_bump).toBe(true);
  });

  it("aligns internal_only with baseline and checklist defaults", () => {
    expect(RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.internal_only).toEqual({
      touches_external_dto: false,
      touches_shared_core_fields: false,
      baseline_update: "not_required_by_default",
      view_version_bump: "not_required_by_default"
    });
    expect(RECOVERY_CLASSIFICATION_ALIGNMENT.internal_only.checklist_defaults).toEqual({
      touches_shared_core_fields: false,
      touches_external_dto_fields: false,
      requires_view_version_bump: false
    });
    expect(
      RECOVERY_DTO_BASELINE_UPDATE_RULES.optional_additive_field_without_dto_exposure
    ).toBe("baseline_update_not_required_by_default");
  });

  it("aligns non_breaking_external with baseline/rehearsal/docs update expectation", () => {
    expect(RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.non_breaking_external).toEqual({
      touches_external_dto: true,
      touches_shared_core_fields: false,
      baseline_update: "review_required",
      view_version_bump: "case_by_case"
    });
    expect(RECOVERY_CLASSIFICATION_ALIGNMENT.non_breaking_external.checklist_defaults).toEqual({
      touches_shared_core_fields: false,
      touches_external_dto_fields: true,
      requires_version_rehearsal_update: true,
      requires_adapter_test_updates: true,
      requires_docs_update: true
    });
  });

  it("marks breaking_external as restricted high risk in phase1", () => {
    expect(RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.breaking_external).toEqual({
      touches_external_dto: true,
      touches_shared_core_fields: true,
      baseline_update: "required",
      view_version_bump: "required",
      phase1_policy: "restricted_high_risk"
    });
    expect(RECOVERY_CLASSIFICATION_ALIGNMENT.breaking_external.warning_focus).toBe(
      "phase1_restricted_high_risk_change"
    );
    expect(RECOVERY_DTO_BASELINE_UPDATE_RULES.shared_core_field_remove_or_rename).toBe(
      "forbidden_in_phase1"
    );
  });

  it("keeps breaking_external review hints as restricted high risk guidance", () => {
    const breakingHints = RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS.breaking_external;
    expect(breakingHints.aligns_with_policy.phase1_policy).toBe("restricted_high_risk");
    expect(breakingHints.reviewer_actions).toContain("mark_restricted_high_risk");
    expect(breakingHints.reviewer_actions).toContain("require_explicit_breaking_reason");
    expect(breakingHints.reviewer_actions).toContain("require_phase1_exception_rationale");
    expect(breakingHints.reviewer_actions).toContain("require_view_version_bump");
    expect(breakingHints.reviewer_actions).toContain(
      "recommend_escalated_review_or_reject_in_phase1"
    );
  });

  it("covers baseline rationale template fields", () => {
    expect(RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE).toEqual({
      change_classification: "internal_only | non_breaking_external | breaking_external",
      baseline_rationale:
        "shared_core_field_domain_change | view_version_change | external_dto_exposure_added | docs_and_rehearsal_alignment",
      touched_shared_core_fields: false,
      touched_external_dto_fields: false,
      updated_adapter_tests: false,
      updated_version_rehearsal: false,
      updated_docs: false,
      requires_view_version_bump: false
    });
  });

  it("keeps classification aligned with warning and checklist language", () => {
    const checklist = createRecoveryDisplayChangeImpactChecklistTemplate();
    const checklistKeys = Object.keys(checklist);
    expect(RECOVERY_SHARED_CORE_FIELD_CHANGE_WARNING_TEMPLATE.length).toBeGreaterThan(0);
    expect(Object.keys(RECOVERY_WARNING_TO_IMPACT_CHECKLIST_ALIGNMENT)).toEqual([
      "shared_core_fields",
      "compatibility_policy",
      "adapter_tests_and_baseline",
      "version_rehearsal",
      "docs_and_checklist",
      "view_version_bump"
    ]);
    for (const alignedItem of Object.values(RECOVERY_WARNING_TO_IMPACT_CHECKLIST_ALIGNMENT)) {
      expect(checklistKeys).toContain(alignedItem);
    }
  });
});

describe("recovery baseline history and review trace templates", () => {
  it("provides baseline history template with required fields", () => {
    expect(RECOVERY_DTO_BASELINE_HISTORY_ENTRY_FIELDS).toEqual([
      "change_date",
      "change_summary",
      "classification",
      "affected_paths",
      "shared_core_fields_touched",
      "baseline_updated",
      "rehearsal_updated",
      "docs_updated",
      "view_version_bumped",
      "rationale",
      "review_notes"
    ]);
    expect(Object.keys(RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE)).toEqual(
      RECOVERY_DTO_BASELINE_HISTORY_ENTRY_FIELDS
    );
    expect(RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE.affected_paths.length).toBeGreaterThan(0);
  });

  it("keeps baseline history affected path values within frozen scope", () => {
    for (const path of RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE.affected_paths) {
      expect(RECOVERY_BASELINE_AFFECTED_PATHS).toContain(path);
    }
    for (const path of RECOVERY_DTO_BASELINE_HISTORY_ENTRY_EXAMPLES.non_breaking_external
      .affected_paths) {
      expect(RECOVERY_BASELINE_AFFECTED_PATHS).toContain(path);
    }
  });

  it("provides review trace template with minimal fields", () => {
    expect(RECOVERY_REVIEW_TRACE_FIELDS).toEqual([
      "review_scope",
      "rule_basis",
      "compatibility_checked",
      "baseline_checked",
      "rehearsal_checked",
      "docs_checked",
      "risk_note",
      "follow_up_needed"
    ]);
    expect(Object.keys(RECOVERY_REVIEW_TRACE_TEMPLATE)).toEqual(RECOVERY_REVIEW_TRACE_FIELDS);
  });

  it("aligns baseline history template with baseline reason template", () => {
    const reasonTemplateKeys = Object.keys(RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE);
    for (const field of Object.values(RECOVERY_DTO_BASELINE_HISTORY_TO_REASON_ALIGNMENT)) {
      expect(reasonTemplateKeys).toContain(field);
    }
    expect(RECOVERY_DTO_BASELINE_HISTORY_ARCHIVE_FIELDS).toEqual([
      "change_date",
      "change_summary",
      "affected_paths",
      "baseline_updated",
      "review_notes"
    ]);
  });

  it("aligns review trace fields with checklist and review hints", () => {
    const rationaleFields = Object.keys(RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE);
    for (const field of RECOVERY_REVIEW_TRACE_FIELDS) {
      const alignment = RECOVERY_REVIEW_TRACE_ALIGNMENT[field];
      expect(alignment.checklist_items.length).toBeGreaterThan(0);
      expect(alignment.hint_actions.length).toBeGreaterThan(0);
      expect(alignment.rationale_fields.length).toBeGreaterThan(0);

      for (const checklistItem of alignment.checklist_items) {
        expect(RECOVERY_DISPLAY_CHANGE_IMPACT_CHECKLIST_ITEMS).toContain(checklistItem);
      }
      for (const hintAction of alignment.hint_actions) {
        expect(RECOVERY_ADAPTER_CHANGE_REVIEW_ACTIONS).toContain(hintAction);
      }
      for (const rationaleField of alignment.rationale_fields) {
        expect(rationaleFields).toContain(rationaleField);
      }
    }
  });

  it("provides minimal examples for baseline history and review trace", () => {
    const nonBreakingHistory = RECOVERY_DTO_BASELINE_HISTORY_ENTRY_EXAMPLES.non_breaking_external;
    expect(nonBreakingHistory.classification).toBe("non_breaking_external");
    expect(nonBreakingHistory.baseline_updated).toBe(true);
    expect(nonBreakingHistory.rehearsal_updated).toBe(true);
    expect(nonBreakingHistory.docs_updated).toBe(true);
    expect(nonBreakingHistory.view_version_bumped).toBe(false);
    expect(nonBreakingHistory.review_notes.length).toBeGreaterThan(0);

    const internalTrace = RECOVERY_REVIEW_TRACE_EXAMPLES.internal_only;
    expect(internalTrace.compatibility_checked).toBe(true);
    expect(internalTrace.baseline_checked).toBe(true);
    expect(internalTrace.rehearsal_checked).toBe(true);
    expect(internalTrace.docs_checked).toBe(true);
    expect(internalTrace.follow_up_needed).toBe(false);
  });

  it("keeps theoretical breaking examples restricted and high risk", () => {
    expect(RECOVERY_DTO_BASELINE_HISTORY_ENTRY_EXAMPLES.breaking_external_theoretical.classification).toBe(
      "breaking_external"
    );
    expect(RECOVERY_DTO_BASELINE_HISTORY_ENTRY_EXAMPLES.breaking_external_theoretical.view_version_bumped).toBe(
      true
    );
    expect(RECOVERY_REVIEW_TRACE_EXAMPLES.breaking_external_theoretical.follow_up_needed).toBe(
      true
    );
    expect(RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.breaking_external.phase1_policy).toBe(
      "restricted_high_risk"
    );
  });
});

describe("recovery cadence guidance", () => {
  it("freezes minimal cadence levels", () => {
    expect(RECOVERY_CADENCE_LEVELS).toEqual(["required", "recommended", "optional"]);
  });

  it("covers review trace cadence guidance for all classifications", () => {
    expect(Object.keys(RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE)).toEqual(
      RECOVERY_ADAPTER_CHANGE_CLASSIFICATIONS
    );
    for (const classification of RECOVERY_ADAPTER_CHANGE_CLASSIFICATIONS) {
      const guidance = RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE[classification];
      expect(RECOVERY_CADENCE_LEVELS).toContain(guidance.cadence);
      expect(guidance.must_write_when.length).toBeGreaterThan(0);
      expect(guidance.linked_hint_actions.length).toBeGreaterThan(0);
      expect(guidance.linked_checklist_items.length).toBeGreaterThan(0);
      expect(guidance.linked_rationale_fields.length).toBeGreaterThan(0);
    }
  });

  it("covers baseline history cadence guidance for all classifications", () => {
    expect(RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE.global_required_when).toEqual([
      "baseline_updated_true",
      "view_version_bumped_true"
    ]);
    expect(Object.keys(RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE.by_classification)).toEqual(
      RECOVERY_ADAPTER_CHANGE_CLASSIFICATIONS
    );

    for (const classification of RECOVERY_ADAPTER_CHANGE_CLASSIFICATIONS) {
      const guidance =
        RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE.by_classification[classification];
      expect(RECOVERY_CADENCE_LEVELS).toContain(guidance.cadence);
      expect(guidance.archive_when.length).toBeGreaterThan(0);
      expect(guidance.linked_baseline_rules.length).toBeGreaterThan(0);
    }
  });

  it("keeps cadence guidance aligned with classification, rules, checklist, and hints", () => {
    const baselineRuleKeys = Object.keys(RECOVERY_DTO_BASELINE_UPDATE_RULES);
    const rationaleKeys = Object.keys(RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE);

    for (const classification of RECOVERY_ADAPTER_CHANGE_CLASSIFICATIONS) {
      const traceGuidance = RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE[classification];
      const historyGuidance =
        RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE.by_classification[classification];

      expect(traceGuidance.aligns_with_policy).toEqual(
        RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY[classification]
      );
      expect(historyGuidance.aligns_with_policy).toEqual(
        RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY[classification]
      );

      for (const hintAction of traceGuidance.linked_hint_actions) {
        expect(RECOVERY_ADAPTER_CHANGE_REVIEW_ACTIONS).toContain(hintAction);
      }
      for (const checklistItem of traceGuidance.linked_checklist_items) {
        expect(RECOVERY_DISPLAY_CHANGE_IMPACT_CHECKLIST_ITEMS).toContain(checklistItem);
      }
      for (const rationaleField of traceGuidance.linked_rationale_fields) {
        expect(rationaleKeys).toContain(rationaleField);
      }

      for (const baselineRule of historyGuidance.linked_baseline_rules) {
        expect(baselineRuleKeys).toContain(baselineRule);
      }
      for (const checklistItem of historyGuidance.linked_checklist_items) {
        expect(RECOVERY_DISPLAY_CHANGE_IMPACT_CHECKLIST_ITEMS).toContain(checklistItem);
      }
      for (const rationaleField of historyGuidance.linked_reason_fields) {
        expect(rationaleKeys).toContain(rationaleField);
      }
    }

    expect(RECOVERY_CADENCE_GUIDANCE_ALIGNMENT).toEqual({
      purpose: "execution_timing_guidance_only",
      does_not_replace: [
        "RECOVERY_DISPLAY_CHANGE_IMPACT_CHECKLIST_ITEMS",
        "RECOVERY_DTO_BASELINE_UPDATE_RULES",
        "RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS"
      ],
      review_trace_guidance_links: [
        "RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE",
        "RECOVERY_REVIEW_TRACE_ALIGNMENT",
        "RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE"
      ],
      baseline_history_guidance_links: [
        "RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE",
        "RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE",
        "RECOVERY_DTO_BASELINE_HISTORY_TO_REASON_ALIGNMENT"
      ]
    });
  });

  it("provides direct cadence examples for non_breaking_external and internal_only", () => {
    const nonBreaking = RECOVERY_CADENCE_GUIDANCE_EXAMPLES.non_breaking_external_required_pair;
    expect(nonBreaking.classification).toBe("non_breaking_external");
    expect(nonBreaking.review_trace_cadence).toBe("required");
    expect(nonBreaking.baseline_history_cadence).toBe("required");

    const internalOnly = RECOVERY_CADENCE_GUIDANCE_EXAMPLES.internal_only_optional_lightweight;
    expect(internalOnly.classification).toBe("internal_only");
    expect(internalOnly.review_trace_cadence).toBe("optional");
    expect(internalOnly.baseline_history_cadence).toBe("optional");
    expect(internalOnly.note.length).toBeGreaterThan(0);
  });

  it("keeps breaking_external cadence as restricted high risk", () => {
    const traceBreaking = RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE.breaking_external;
    const historyBreaking =
      RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE.by_classification.breaking_external;
    const breakingExample = RECOVERY_CADENCE_GUIDANCE_EXAMPLES.breaking_external_theoretical_required;

    expect(traceBreaking.cadence).toBe("required");
    expect(traceBreaking.requires_restricted_high_risk_label).toBe(true);
    expect(historyBreaking.cadence).toBe("required");
    expect(historyBreaking.requires_restricted_high_risk_label).toBe(true);
    expect(breakingExample.classification).toBe("breaking_external");
    expect(breakingExample.review_trace_cadence).toBe("required");
    expect(breakingExample.baseline_history_cadence).toBe("required");
    expect(RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.breaking_external.phase1_policy).toBe(
      "restricted_high_risk"
    );
  });
});

describe("recovery trace consistency convergence layer", () => {
  it("covers key gates in lightweight consistency checklist", () => {
    expect(RECOVERY_TRACE_CONSISTENCY_CHECKLIST_ITEMS).toEqual([
      "classification_declared",
      "warning_template_checked",
      "impact_checklist_checked",
      "pr_checklist_completed",
      "baseline_reason_filled_or_not_required_explained",
      "review_trace_filled_or_cadence_explained",
      "baseline_history_archived_or_cadence_explained",
      "docs_synced",
      "view_version_bump_decision_recorded",
      "rehearsal_and_baseline_tests_updated_or_not_required_explained"
    ]);
    expect(Object.keys(RECOVERY_TRACE_CONSISTENCY_CHECKLIST)).toEqual([
      ...RECOVERY_TRACE_CONSISTENCY_CHECKLIST_ITEMS,
      "consistency_summary"
    ]);
  });

  it("provides document reference template fields and source options", () => {
    expect(RECOVERY_TRACE_DOCUMENT_REFERENCE_SOURCE_OPTIONS).toEqual([
      "classification_policy",
      "warning_template",
      "impact_checklist",
      "pr_checklist",
      "baseline_rationale_template",
      "review_hints",
      "cadence_guidance",
      "baseline_history_and_review_trace_docs"
    ]);
    expect(Object.keys(RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE)).toEqual([
      "change_classification",
      "used_sources",
      "not_used_sources_with_reason",
      "reference_summary"
    ]);
  });

  it("keeps consistency checklist and document references aligned with existing templates", () => {
    const checklistItemLinks = RECOVERY_TRACE_CONSISTENCY_ALIGNMENT.checklist_item_links;
    const baselineRuleKeys = Object.keys(RECOVERY_DTO_BASELINE_UPDATE_RULES);

    expect(RECOVERY_TRACE_CONSISTENCY_ALIGNMENT.does_not_replace).toContain(
      "RECOVERY_DISPLAY_CHANGE_IMPACT_CHECKLIST_ITEMS"
    );
    expect(RECOVERY_TRACE_CONSISTENCY_ALIGNMENT.does_not_replace).toContain(
      "RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE"
    );
    expect(RECOVERY_TRACE_CONSISTENCY_ALIGNMENT.does_not_replace).toContain(
      "RECOVERY_REVIEW_TRACE_TEMPLATE"
    );

    expect(checklistItemLinks.classification_declared).toContain(
      "RECOVERY_ADAPTER_CHANGE_CLASSIFICATIONS"
    );
    expect(checklistItemLinks.warning_template_checked).toContain(
      "RECOVERY_SHARED_CORE_FIELD_CHANGE_WARNING_TEMPLATE"
    );
    expect(checklistItemLinks.impact_checklist_checked).toContain(
      "RECOVERY_DISPLAY_CHANGE_IMPACT_CHECKLIST_ITEMS"
    );
    expect(checklistItemLinks.baseline_reason_filled_or_not_required_explained).toContain(
      "RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE"
    );
    expect(checklistItemLinks.review_trace_filled_or_cadence_explained).toContain(
      "RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE"
    );
    expect(checklistItemLinks.baseline_history_archived_or_cadence_explained).toContain(
      "RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE"
    );

    expect(RECOVERY_TRACE_DOCUMENT_REFERENCE_ALIGNMENT.source_to_rule_or_doc.cadence_guidance).toContain(
      "RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE"
    );
    expect(
      RECOVERY_TRACE_DOCUMENT_REFERENCE_ALIGNMENT.source_to_rule_or_doc.baseline_rationale_template
    ).toBe("RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE");
    expect(
      RECOVERY_TRACE_DOCUMENT_REFERENCE_ALIGNMENT.source_to_rule_or_doc.review_hints
    ).toBe("RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS");

    for (const baselineRule of Object.values(
      RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE.by_classification.non_breaking_external
        .linked_baseline_rules
    )) {
      expect(baselineRuleKeys).toContain(baselineRule);
    }
  });

  it("provides minimal direct examples for checklist and document references", () => {
    const nonBreakingChecklist =
      RECOVERY_TRACE_CONSISTENCY_CHECKLIST_EXAMPLES.non_breaking_external;
    expect(nonBreakingChecklist.classification_declared).toBe(true);
    expect(nonBreakingChecklist.review_trace_filled_or_cadence_explained).toBe(true);
    expect(nonBreakingChecklist.baseline_history_archived_or_cadence_explained).toBe(true);
    expect(nonBreakingChecklist.consistency_summary).toContain("non_breaking_external");

    const internalOnlyReference = RECOVERY_TRACE_DOCUMENT_REFERENCE_EXAMPLES.internal_only;
    expect(internalOnlyReference.change_classification).toBe("internal_only");
    expect(internalOnlyReference.used_sources).toContain("classification_policy");
    expect(internalOnlyReference.used_sources).toContain("cadence_guidance");
    expect(internalOnlyReference.not_used_sources_with_reason.length).toBeGreaterThan(0);
  });

  it("keeps breaking_external convergence semantics restricted and high risk", () => {
    expect(
      RECOVERY_TRACE_CONSISTENCY_CHECKLIST_EXAMPLES.breaking_external_theoretical.consistency_summary
    ).toContain("restricted_high_risk");
    expect(
      RECOVERY_TRACE_DOCUMENT_REFERENCE_EXAMPLES.breaking_external_theoretical.change_classification
    ).toBe("breaking_external");
    expect(
      RECOVERY_TRACE_DOCUMENT_REFERENCE_EXAMPLES.breaking_external_theoretical.used_sources
    ).toContain("review_hints");
    expect(
      RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE.by_classification.breaking_external
        .requires_restricted_high_risk_label
    ).toBe(true);
    expect(RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.breaking_external.phase1_policy).toBe(
      "restricted_high_risk"
    );
  });
});

describe("recovery trace closure maintenance and phrase guidance", () => {
  it("covers closure maintenance key triggers", () => {
    expect(RECOVERY_TRACE_CLOSURE_MAINTENANCE_TRIGGERS).toEqual([
      "classification_policy_changed",
      "warning_template_changed",
      "impact_checklist_changed",
      "cadence_guidance_changed",
      "baseline_history_or_review_trace_fields_changed",
      "document_reference_source_options_changed",
      "rule_source_document_added",
      "shared_core_fields_changed"
    ]);

    for (const trigger of RECOVERY_TRACE_CLOSURE_MAINTENANCE_TRIGGERS) {
      const entry = RECOVERY_TRACE_CLOSURE_MAINTENANCE_GUIDANCE.required_trigger_checks[trigger];
      expect(entry.must_review_targets.length).toBeGreaterThan(0);
      expect(entry.why.length).toBeGreaterThan(0);
      expect(entry.related_rules.length).toBeGreaterThan(0);
    }
  });

  it("covers recommended phrases for key review expressions", () => {
    expect(Object.keys(RECOVERY_REVIEW_PHRASE_GUIDANCE)).toEqual([
      "baseline_not_updated",
      "view_version_not_bumped",
      "classification_internal_only",
      "classification_non_breaking_external",
      "classification_breaking_external_restricted",
      "unused_source_with_reason",
      "cadence_optional_skip_explanation"
    ]);
    expect(RECOVERY_REVIEW_PHRASE_GUIDANCE.baseline_not_updated).toContain("No baseline update");
    expect(RECOVERY_REVIEW_PHRASE_GUIDANCE.view_version_not_bumped).toContain(
      "No viewVersion bump"
    );
    expect(RECOVERY_REVIEW_PHRASE_GUIDANCE.classification_internal_only).toContain(
      "internal_only"
    );
    expect(RECOVERY_REVIEW_PHRASE_GUIDANCE.classification_non_breaking_external).toContain(
      "non_breaking_external"
    );
    expect(RECOVERY_REVIEW_PHRASE_GUIDANCE.unused_source_with_reason).toContain("<source>");
  });

  it("keeps phrase guidance aligned with checklist/hints/rationale/reference templates", () => {
    expect(RECOVERY_REVIEW_PHRASE_GUIDANCE_ALIGNMENT.serves_templates).toContain(
      "RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS"
    );
    expect(RECOVERY_REVIEW_PHRASE_GUIDANCE_ALIGNMENT.serves_templates).toContain(
      "RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE"
    );
    expect(RECOVERY_REVIEW_PHRASE_GUIDANCE_ALIGNMENT.serves_templates).toContain(
      "RECOVERY_REVIEW_TRACE_TEMPLATE"
    );
    expect(RECOVERY_REVIEW_PHRASE_GUIDANCE_ALIGNMENT.serves_templates).toContain(
      "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE"
    );
    expect(RECOVERY_REVIEW_PHRASE_GUIDANCE_ALIGNMENT.does_not_replace).toContain(
      "RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS"
    );
    expect(RECOVERY_REVIEW_PHRASE_GUIDANCE_ALIGNMENT.intent).toBe(
      "reduce_description_variance_without_changing_decision_logic"
    );
  });

  it("provides minimal phrase examples for non_breaking and unused-source rationale", () => {
    const nonBreaking = RECOVERY_REVIEW_PHRASE_EXAMPLES.non_breaking_external;
    expect(nonBreaking.classification_sentence).toContain("non_breaking_external");
    expect(nonBreaking.baseline_sentence).toContain("No baseline update");
    expect(nonBreaking.view_version_sentence).toContain("No viewVersion bump");

    const unusedSource = RECOVERY_REVIEW_PHRASE_EXAMPLES.unused_source_reason;
    expect(unusedSource.source).toBe("warning_template");
    expect(unusedSource.sentence).toContain("was not used because");
    expect(unusedSource.note.length).toBeGreaterThan(0);
  });

  it("keeps breaking_external phrase semantics restricted high risk", () => {
    expect(RECOVERY_REVIEW_PHRASE_GUIDANCE.classification_breaking_external_restricted).toContain(
      "restricted_high_risk"
    );
    expect(RECOVERY_REVIEW_PHRASE_EXAMPLES.breaking_external_theoretical.sentence).toContain(
      "restricted_high_risk"
    );
    expect(
      RECOVERY_TRACE_CLOSURE_MAINTENANCE_GUIDANCE.required_trigger_checks
        .classification_policy_changed.must_review_targets
    ).toContain("review_phrase_guidance");
    expect(RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.breaking_external.phase1_policy).toBe(
      "restricted_high_risk"
    );
  });
});

describe("recovery closure review cadence and terminology drift semantics", () => {
  it("covers key triggers in closure review cadence guidance", () => {
    expect(RECOVERY_TRACE_CLOSURE_REVIEW_CADENCE_GUIDANCE.suggested_review_when).toEqual([
      "after_multiple_adapter_or_display_related_changes",
      "after_classification_or_cadence_or_warning_or_impact_rule_change",
      "after_new_rule_source_document_or_new_template_layer_added"
    ]);
    expect(
      RECOVERY_TRACE_CLOSURE_REVIEW_CADENCE_GUIDANCE.trigger_details
        .after_classification_or_cadence_or_warning_or_impact_rule_change
    ).toContain("classification/cadence/warning/impact");
    expect(RECOVERY_TRACE_CLOSURE_REVIEW_CADENCE_GUIDANCE.related_assets).toContain(
      "RECOVERY_TRACE_CONSISTENCY_CHECKLIST"
    );
    expect(RECOVERY_TRACE_CLOSURE_REVIEW_CADENCE_GUIDANCE.related_assets).toContain(
      "RECOVERY_TRACE_CLOSURE_MAINTENANCE_GUIDANCE"
    );
  });

  it("covers key terminology drift signals", () => {
    expect(RECOVERY_TERMINOLOGY_DRIFT_SIGNAL_KEYS).toEqual([
      "classification_phrase_divergence",
      "baseline_not_updated_phrase_divergence",
      "view_version_not_bumped_phrase_divergence",
      "unused_source_reason_granularity_split",
      "breaking_external_restricted_phrase_softening",
      "cadence_level_term_replacement"
    ]);
    expect(RECOVERY_TERMINOLOGY_DRIFT_SIGNALS.classification_phrase_divergence.watch_for).toContain(
      "classification"
    );
    expect(
      RECOVERY_TERMINOLOGY_DRIFT_SIGNALS.baseline_not_updated_phrase_divergence.aligned_phrase_key
    ).toBe("baseline_not_updated");
    expect(
      RECOVERY_TERMINOLOGY_DRIFT_SIGNALS.view_version_not_bumped_phrase_divergence.aligned_phrase_key
    ).toBe("view_version_not_bumped");
    expect(
      RECOVERY_TERMINOLOGY_DRIFT_SIGNALS.unused_source_reason_granularity_split.aligned_phrase_key
    ).toBe("unused_source_with_reason");
    expect(RECOVERY_TERMINOLOGY_DRIFT_SIGNALS.cadence_level_term_replacement.aligned_phrase_key).toBe(
      "cadence_levels"
    );
  });

  it("covers key retrospective checklist items", () => {
    expect(RECOVERY_TRACE_CLOSURE_RETROSPECTIVE_CHECKLIST_ITEMS).toEqual([
      "phrase_guidance_matches_actual_writing",
      "consistency_checklist_still_covers_key_gates",
      "document_reference_sources_still_current",
      "baseline_history_and_review_trace_examples_still_representative",
      "classification_hints_and_cadence_still_aligned",
      "terminology_drift_signals_reviewed"
    ]);
    expect(Object.keys(RECOVERY_TRACE_CLOSURE_RETROSPECTIVE_CHECKLIST)).toEqual([
      ...RECOVERY_TRACE_CLOSURE_RETROSPECTIVE_CHECKLIST_ITEMS,
      "retrospective_summary"
    ]);
  });

  it("keeps review cadence distinct from maintenance guidance", () => {
    expect(RECOVERY_TRACE_REVIEW_CADENCE_AND_MAINTENANCE_RELATION).toEqual({
      maintenance_guidance_answers: "when_to_update_closure_templates",
      review_cadence_answers: "when_to_review_overall_closure_layer_health",
      relation: "related_but_not_equivalent",
      does_not_replace_each_other: true
    });
    expect(RECOVERY_TRACE_CLOSURE_MAINTENANCE_GUIDANCE.purpose).toBe(
      "minimal_manual_closure_layer_maintenance"
    );
    expect(RECOVERY_TRACE_CLOSURE_REVIEW_CADENCE_GUIDANCE.purpose).toBe(
      "manual_closure_layer_health_review_cadence"
    );
  });

  it("keeps review cadence, drift signals, and retrospective aligned with existing rules", () => {
    expect(RECOVERY_TERMINOLOGY_DRIFT_SIGNALS.classification_phrase_divergence.affected_assets).toContain(
      "RECOVERY_TRACE_CONSISTENCY_CHECKLIST"
    );
    expect(RECOVERY_TERMINOLOGY_DRIFT_SIGNALS.baseline_not_updated_phrase_divergence.affected_assets).toContain(
      "RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE"
    );
    expect(RECOVERY_TERMINOLOGY_DRIFT_SIGNALS.cadence_level_term_replacement.affected_assets).toContain(
      "RECOVERY_CADENCE_LEVELS"
    );
    expect(RECOVERY_REVIEW_PHRASE_GUIDANCE_ALIGNMENT.serves_templates).toContain(
      "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE"
    );
    expect(
      RECOVERY_TRACE_CLOSURE_REVIEW_CADENCE_GUIDANCE.related_assets.includes(
        "RECOVERY_REVIEW_PHRASE_GUIDANCE"
      )
    ).toBe(true);
  });

  it("provides direct examples for rule-change and terminology-drift triggered review", () => {
    const ruleChange = RECOVERY_TRACE_CLOSURE_REVIEW_EXAMPLES.rule_change_triggered_review;
    expect(ruleChange.trigger).toBe("classification_or_cadence_rule_changed");
    expect(ruleChange.action).toContain("closure health review");

    const drift = RECOVERY_TRACE_CLOSURE_REVIEW_EXAMPLES.terminology_drift_triggered_retrospective;
    expect(drift.trigger).toBe("baseline_or_viewVersion_phrase_divergence_observed");
    expect(drift.action).toContain("retrospective checklist");
  });

  it("preserves restricted_high_risk wording in breaking_external drift signals", () => {
    expect(
      RECOVERY_TERMINOLOGY_DRIFT_SIGNALS.breaking_external_restricted_phrase_softening.watch_for
    ).toContain("restricted_high_risk");
    expect(RECOVERY_TRACE_CLOSURE_REVIEW_EXAMPLES.breaking_external_theoretical.action).toContain(
      "restricted_high_risk"
    );
    expect(RECOVERY_REVIEW_PHRASE_GUIDANCE.classification_breaking_external_restricted).toContain(
      "restricted_high_risk"
    );
    expect(RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.breaking_external.phase1_policy).toBe(
      "restricted_high_risk"
    );
  });
});

describe("recovery retrospective outcome and drift response semantics", () => {
  it("provides retrospective outcome template with required fields", () => {
    expect(Object.keys(RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE)).toEqual([
      "retrospective_scope",
      "signals_observed",
      "consistency_status",
      "actions_recommended",
      "template_updates_needed",
      "follow_up_needed",
      "notes"
    ]);
    expect(RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE.signals_observed).toEqual([]);
  });

  it("covers drift response phrases for key drift handling scenarios", () => {
    expect(Object.keys(RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES)).toEqual([
      "minor_drift_no_template_update",
      "multi_drift_update_phrase_guidance",
      "outdated_reference_sources_update_options",
      "checklist_gap_update_consistency_checklist",
      "classification_hints_cadence_inconsistent_trigger_linked_check",
      "breaking_external_restricted_phrase_softened_restore_immediately"
    ]);
    expect(RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES.minor_drift_no_template_update).toContain(
      "Minor terminology drift observed"
    );
    expect(RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES.outdated_reference_sources_update_options).toContain(
      "RECOVERY_TRACE_DOCUMENT_REFERENCE_SOURCE_OPTIONS"
    );
  });

  it("keeps outcome and response aligned with checklist, drift signals, and phrase guidance", () => {
    expect(RECOVERY_RETROSPECTIVE_OUTCOME_AND_RESPONSE_ALIGNMENT).toEqual({
      outcome_references_checklist: "RECOVERY_TRACE_CLOSURE_RETROSPECTIVE_CHECKLIST",
      response_references_drift_signals: "RECOVERY_TERMINOLOGY_DRIFT_SIGNALS",
      template_updates_needed_links: [
        "RECOVERY_TRACE_CLOSURE_MAINTENANCE_GUIDANCE",
        "RECOVERY_TRACE_CLOSURE_REVIEW_CADENCE_GUIDANCE"
      ],
      follow_up_links: [
        "RECOVERY_REVIEW_TRACE_TEMPLATE",
        "RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE",
        "RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE",
        "RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE"
      ],
      does_not_replace: [
        "RECOVERY_TRACE_CLOSURE_RETROSPECTIVE_CHECKLIST",
        "RECOVERY_TERMINOLOGY_DRIFT_SIGNALS",
        "RECOVERY_REVIEW_PHRASE_GUIDANCE"
      ]
    });
    expect(RECOVERY_REVIEW_PHRASE_GUIDANCE_ALIGNMENT.serves_templates).toContain(
      "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE"
    );
    expect(RECOVERY_TERMINOLOGY_DRIFT_SIGNAL_KEYS).toContain(
      "unused_source_reason_granularity_split"
    );
  });

  it("provides minimal direct examples for outcome and drift response", () => {
    const minorOutcome = RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_EXAMPLES.minor_drift_no_template_update;
    expect(minorOutcome.consistency_status).toBe("minor_drift_observed");
    expect(minorOutcome.template_updates_needed).toEqual(["none"]);
    expect(minorOutcome.follow_up_needed).toBe(false);

    const outdatedSourceResponse =
      RECOVERY_DRIFT_SIGNAL_RESPONSE_EXAMPLES.outdated_document_reference_sources;
    expect(outdatedSourceResponse.signal).toBe("unused_source_reason_granularity_split");
    expect(outdatedSourceResponse.template_updates_needed).toEqual(["document_reference_template"]);
    expect(outdatedSourceResponse.phrase).toContain("Document reference sources appear outdated");
  });

  it("preserves restricted_high_risk wording in drift response for breaking_external", () => {
    expect(
      RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES.breaking_external_restricted_phrase_softened_restore_immediately
    ).toContain("restricted_high_risk");
    expect(RECOVERY_DRIFT_SIGNAL_RESPONSE_EXAMPLES.breaking_external_theoretical.signal).toBe(
      "breaking_external_restricted_phrase_softening"
    );
    expect(RECOVERY_DRIFT_SIGNAL_RESPONSE_EXAMPLES.breaking_external_theoretical.phrase).toContain(
      "restricted_high_risk"
    );
    expect(RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.breaking_external.phase1_policy).toBe(
      "restricted_high_risk"
    );
  });
});

describe("recovery retrospective archive index and comparison semantics", () => {
  it("provides archive index template with required fields", () => {
    expect(Object.keys(RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE)).toEqual([
      "retrospective_id",
      "retrospective_scope",
      "change_window_summary",
      "signals_observed_count",
      "consistency_status",
      "template_updates_needed",
      "follow_up_needed",
      "archived_at",
      "comparison_note"
    ]);
    expect(RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE.signals_observed_count).toBe(0);
  });

  it("provides comparison template with required fields", () => {
    expect(Object.keys(RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE)).toEqual([
      "previous_reference",
      "current_reference",
      "signals_changed",
      "consistency_changed",
      "template_update_need_changed",
      "follow_up_changed",
      "notable_summary"
    ]);
  });

  it("freezes minimal comparison semantics without adding new judgement logic", () => {
    expect(RECOVERY_RETROSPECTIVE_COMPARISON_SEMANTICS).toEqual({
      signals_changed:
        "True when observed signal set/count differs from the previous retrospective outcome.",
      consistency_changed:
        "True when consistency_status differs from the previous retrospective outcome.",
      template_update_need_changed:
        "True when template_updates_needed differs from the previous retrospective outcome.",
      follow_up_changed:
        "True when follow_up_needed differs from the previous retrospective outcome.",
      judgement_mode: "manual_reporting_only"
    });
    expect(RECOVERY_RETROSPECTIVE_ARCHIVE_AND_COMPARISON_ALIGNMENT.decision_logic_source).toBe(
      "existing_retrospective_judgement_only"
    );
  });

  it("keeps archive and comparison aligned with existing retrospective system", () => {
    expect(RECOVERY_RETROSPECTIVE_ARCHIVE_AND_COMPARISON_ALIGNMENT.archive_based_on).toBe(
      "RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE"
    );
    expect(RECOVERY_RETROSPECTIVE_ARCHIVE_AND_COMPARISON_ALIGNMENT.comparison_based_on).toBe(
      "retrospective_outcome_minimal_summary"
    );
    expect(RECOVERY_RETROSPECTIVE_ARCHIVE_AND_COMPARISON_ALIGNMENT.links_to_checklist).toBe(
      "RECOVERY_TRACE_CLOSURE_RETROSPECTIVE_CHECKLIST"
    );
    expect(RECOVERY_RETROSPECTIVE_ARCHIVE_AND_COMPARISON_ALIGNMENT.links_to_drift_signals).toBe(
      "RECOVERY_TERMINOLOGY_DRIFT_SIGNALS"
    );
    expect(
      RECOVERY_RETROSPECTIVE_ARCHIVE_AND_COMPARISON_ALIGNMENT.links_to_maintenance_and_cadence
    ).toEqual([
      "RECOVERY_TRACE_CLOSURE_MAINTENANCE_GUIDANCE",
      "RECOVERY_TRACE_CLOSURE_REVIEW_CADENCE_GUIDANCE"
    ]);
    expect(RECOVERY_RETROSPECTIVE_ARCHIVE_AND_COMPARISON_ALIGNMENT.links_to_follow_up_templates).toContain(
      "RECOVERY_REVIEW_TRACE_TEMPLATE"
    );
    expect(RECOVERY_RETROSPECTIVE_ARCHIVE_AND_COMPARISON_ALIGNMENT.links_to_follow_up_templates).toContain(
      "RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE"
    );
  });

  it("provides comparison examples for no-change and new-update scenarios", () => {
    const noChange = RECOVERY_RETROSPECTIVE_COMPARISON_EXAMPLES.no_significant_change;
    expect(noChange.signals_changed).toBe(false);
    expect(noChange.consistency_changed).toBe(false);
    expect(noChange.template_update_need_changed).toBe(false);
    expect(noChange.follow_up_changed).toBe(false);

    const changed = RECOVERY_RETROSPECTIVE_COMPARISON_EXAMPLES.new_update_need_and_follow_up;
    expect(changed.signals_changed).toBe(true);
    expect(changed.template_update_need_changed).toBe(true);
    expect(changed.follow_up_changed).toBe(true);
  });

  it("keeps breaking_external theoretical high-risk wording in archive/comparison examples", () => {
    expect(
      RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_EXAMPLES.breaking_external_theoretical.comparison_note
    ).toContain("restricted_high_risk");
    expect(
      RECOVERY_RETROSPECTIVE_COMPARISON_EXAMPLES.breaking_external_theoretical.notable_summary
    ).toContain("restricted_high_risk");
    expect(RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.breaking_external.phase1_policy).toBe(
      "restricted_high_risk"
    );
  });
});

describe("recovery archive/comparison field stability and change note semantics", () => {
  it("covers archive field stability policy tiers", () => {
    expect(RECOVERY_RETROSPECTIVE_ARCHIVE_FIELD_STABILITY_POLICY.stable_core_fields).toEqual([
      "retrospective_id",
      "retrospective_scope",
      "consistency_status",
      "template_updates_needed",
      "follow_up_needed",
      "archived_at",
      "signals_observed_count"
    ]);
    expect(RECOVERY_RETROSPECTIVE_ARCHIVE_FIELD_STABILITY_POLICY.controlled_summary_fields).toEqual(
      ["change_window_summary", "comparison_note"]
    );
    expect(RECOVERY_RETROSPECTIVE_ARCHIVE_FIELD_STABILITY_POLICY.free_text_fields).toEqual([]);
  });

  it("covers comparison field stability policy tiers", () => {
    expect(RECOVERY_RETROSPECTIVE_COMPARISON_FIELD_STABILITY_POLICY.stable_core_fields).toEqual([
      "previous_reference",
      "current_reference",
      "signals_changed",
      "consistency_changed",
      "template_update_need_changed",
      "follow_up_changed"
    ]);
    expect(
      RECOVERY_RETROSPECTIVE_COMPARISON_FIELD_STABILITY_POLICY.controlled_summary_fields
    ).toEqual(["notable_summary"]);
    expect(RECOVERY_RETROSPECTIVE_COMPARISON_FIELD_STABILITY_POLICY.free_text_fields).toEqual([]);
  });

  it("freezes controlled summary writing guidance for key fields", () => {
    expect(Object.keys(RECOVERY_RETROSPECTIVE_CONTROLLED_SUMMARY_WRITING_GUIDANCE)).toEqual([
      "change_window_summary",
      "comparison_note",
      "notable_summary",
      "avoid"
    ]);
    expect(
      RECOVERY_RETROSPECTIVE_CONTROLLED_SUMMARY_WRITING_GUIDANCE.change_window_summary
        .sentence_recommendation
    ).toBe("1-2_sentences");
    expect(
      RECOVERY_RETROSPECTIVE_CONTROLLED_SUMMARY_WRITING_GUIDANCE.comparison_note.structure
    ).toContain("state_if_significant_delta_exists");
    expect(
      RECOVERY_RETROSPECTIVE_CONTROLLED_SUMMARY_WRITING_GUIDANCE.notable_summary.phrase_source_preference
    ).toEqual(["RECOVERY_REVIEW_PHRASE_GUIDANCE", "RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES"]);
  });

  it("provides archive/comparison change note template with required fields", () => {
    expect(Object.keys(RECOVERY_RETROSPECTIVE_ARCHIVE_CHANGE_NOTE_TEMPLATE)).toEqual([
      "touched_fields",
      "touched_stability_tier",
      "affects_existing_examples",
      "requires_docs_update",
      "requires_tests_update",
      "affects_manual_comparison_readability",
      "note"
    ]);
    expect(RECOVERY_RETROSPECTIVE_ARCHIVE_CHANGE_NOTE_TEMPLATE.touched_stability_tier).toBe(
      "stable_core_fields | controlled_summary_fields | free_text_fields"
    );
  });

  it("keeps field stability and change note aligned with archive/comparison templates", () => {
    const archiveKeys = Object.keys(RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE);
    const comparisonKeys = Object.keys(RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE);

    for (const field of RECOVERY_RETROSPECTIVE_ARCHIVE_FIELD_STABILITY_POLICY.stable_core_fields) {
      expect(archiveKeys).toContain(field);
    }
    for (const field of RECOVERY_RETROSPECTIVE_ARCHIVE_FIELD_STABILITY_POLICY.controlled_summary_fields) {
      expect(archiveKeys).toContain(field);
    }
    for (const field of RECOVERY_RETROSPECTIVE_COMPARISON_FIELD_STABILITY_POLICY.stable_core_fields) {
      expect(comparisonKeys).toContain(field);
    }
    for (const field of RECOVERY_RETROSPECTIVE_COMPARISON_FIELD_STABILITY_POLICY.controlled_summary_fields) {
      expect(comparisonKeys).toContain(field);
    }

    expect(RECOVERY_RETROSPECTIVE_ARCHIVE_CHANGE_NOTE_ALIGNMENT.related_templates).toEqual([
      "RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE"
    ]);
    expect(RECOVERY_RETROSPECTIVE_ARCHIVE_CHANGE_NOTE_ALIGNMENT.related_phrase_sources).toEqual([
      "RECOVERY_REVIEW_PHRASE_GUIDANCE",
      "RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES"
    ]);
  });

  it("provides minimal controlled summary examples for key scenarios", () => {
    expect(RECOVERY_RETROSPECTIVE_CONTROLLED_SUMMARY_EXAMPLES.comparison_note_no_significant_change).toContain(
      "No significant delta"
    );
    expect(
      RECOVERY_RETROSPECTIVE_CONTROLLED_SUMMARY_EXAMPLES.notable_summary_new_update_and_follow_up
    ).toContain("Template update need and follow-up requirement");
  });

  it("keeps stable core changes high-sensitive and boundary non-replacement explicit", () => {
    expect(RECOVERY_RETROSPECTIVE_ARCHIVE_FIELD_STABILITY_POLICY.stable_core_change_sensitivity).toBe(
      "high_sensitive"
    );
    expect(
      RECOVERY_RETROSPECTIVE_COMPARISON_FIELD_STABILITY_POLICY.stable_core_change_sensitivity
    ).toBe("high_sensitive");
    expect(RECOVERY_RETROSPECTIVE_ARCHIVE_CHANGE_NOTE_ALIGNMENT.does_not_replace).toContain(
      "RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE"
    );
    expect(RECOVERY_RETROSPECTIVE_ARCHIVE_CHANGE_NOTE_ALIGNMENT.does_not_replace).toContain(
      "RECOVERY_TRACE_CLOSURE_RETROSPECTIVE_CHECKLIST"
    );
    expect(
      RECOVERY_RETROSPECTIVE_CONTROLLED_SUMMARY_EXAMPLES.breaking_external_theoretical
    ).toContain("restricted_high_risk");
  });
});

describe("recovery archive/comparison example maintenance and change note phrases", () => {
  it("covers key triggers in example maintenance guidance", () => {
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE.suggested_review_when).toEqual([
      "field_stability_policy_changed",
      "controlled_summary_writing_guidance_changed",
      "phrase_guidance_or_drift_response_changed",
      "mainstream_scenario_not_covered_by_existing_examples"
    ]);
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE.trigger_details
        .field_stability_policy_changed
    ).toContain("field stability tiers");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE.related_assets).toContain(
      "RECOVERY_RETROSPECTIVE_ARCHIVE_FIELD_STABILITY_POLICY"
    );
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE.related_assets).toContain(
      "RECOVERY_REVIEW_PHRASE_GUIDANCE"
    );
  });

  it("covers change note phrases for high-frequency scenarios", () => {
    expect(Object.keys(RECOVERY_RETROSPECTIVE_CHANGE_NOTE_PHRASES)).toEqual([
      "stable_core_untouched",
      "controlled_summary_touched_core_semantics_unchanged",
      "example_update_required",
      "docs_update_required",
      "tests_update_required",
      "manual_comparison_readability_not_affected",
      "manual_comparison_readability_affected_add_note",
      "breaking_restricted_theoretical"
    ]);
    expect(RECOVERY_RETROSPECTIVE_CHANGE_NOTE_PHRASES.stable_core_untouched).toContain(
      "No stable core fields are touched"
    );
    expect(
      RECOVERY_RETROSPECTIVE_CHANGE_NOTE_PHRASES
        .controlled_summary_touched_core_semantics_unchanged
    ).toContain("Only controlled summary fields are touched");
  });

  it("keeps example maintenance aligned with field stability and phrase guidance", () => {
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_AND_CHANGE_NOTE_ALIGNMENT.example_maintenance_does_not_replace).toContain(
      "RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE"
    );
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_AND_CHANGE_NOTE_ALIGNMENT.example_maintenance_does_not_replace).toContain(
      "RECOVERY_REVIEW_TRACE_TEMPLATE"
    );
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_AND_CHANGE_NOTE_ALIGNMENT.phrase_sources).toEqual([
      "RECOVERY_REVIEW_PHRASE_GUIDANCE",
      "RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES"
    ]);
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE.related_assets).toContain(
      "RECOVERY_RETROSPECTIVE_CONTROLLED_SUMMARY_WRITING_GUIDANCE"
    );
  });

  it("keeps change note phrases aligned with change note template", () => {
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_AND_CHANGE_NOTE_ALIGNMENT.template_alignment).toBe(
      "RECOVERY_RETROSPECTIVE_ARCHIVE_CHANGE_NOTE_TEMPLATE"
    );
    expect(Object.keys(RECOVERY_RETROSPECTIVE_ARCHIVE_CHANGE_NOTE_TEMPLATE)).toContain(
      "touched_stability_tier"
    );
    expect(Object.keys(RECOVERY_RETROSPECTIVE_ARCHIVE_CHANGE_NOTE_TEMPLATE)).toContain(
      "affects_manual_comparison_readability"
    );
  });

  it("provides minimal examples for controlled-summary-only and mainstream-scenario updates", () => {
    const controlledOnly =
      RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_EXAMPLES.controlled_summary_only_no_example_update;
    expect(controlledOnly.trigger).toBe("controlled_summary_writing_guidance_changed");
    expect(controlledOnly.decision).toBe("no_example_update_needed");

    const mainstream =
      RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_EXAMPLES.mainstream_scenario_requires_example_update;
    expect(mainstream.trigger).toBe("mainstream_scenario_not_covered_by_existing_examples");
    expect(mainstream.decision).toBe("add_minimal_example");

    expect(
      RECOVERY_RETROSPECTIVE_CHANGE_NOTE_PHRASE_EXAMPLES.controlled_summary_only_no_example_update
    ).toContain("Only controlled summary fields are touched");
    expect(
      RECOVERY_RETROSPECTIVE_CHANGE_NOTE_PHRASE_EXAMPLES.mainstream_scenario_requires_example_update
    ).toContain("add one minimal example");
  });

  it("preserves restricted_high_risk semantics in breaking theoretical phrases", () => {
    expect(RECOVERY_RETROSPECTIVE_CHANGE_NOTE_PHRASES.breaking_restricted_theoretical).toContain(
      "restricted_high_risk"
    );
    expect(RECOVERY_RETROSPECTIVE_CHANGE_NOTE_PHRASE_EXAMPLES.breaking_external_theoretical).toContain(
      "restricted_high_risk"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_EXAMPLES.breaking_external_theoretical.note
    ).toContain("restricted_high_risk");
    expect(RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.breaking_external.phase1_policy).toBe(
      "restricted_high_risk"
    );
  });
});

describe("recovery example lifecycle and historical note semantics", () => {
  it("covers key retire/replace triggers in lifecycle guidance", () => {
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_GUIDANCE.retire_or_replace_when).toEqual([
      "field_stability_change_makes_example_non_representative",
      "controlled_summary_guidance_change_makes_wording_non_recommended",
      "new_mainstream_example_replaces_old_primary_example"
    ]);
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_GUIDANCE.keep_as_historical_when).toEqual([
      "old_example_still_explains_context_but_is_not_preferred",
      "theoretical_or_restricted_example_needed_for_boundary_explanation"
    ]);
  });

  it("freezes minimal lifecycle status set", () => {
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUSES).toEqual([
      "active",
      "historical_reference",
      "retired"
    ]);
  });

  it("provides historical/retired note template with required fields", () => {
    expect(Object.keys(RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE)).toEqual([
      "example_status",
      "reason",
      "recommended_replacement",
      "still_useful_for",
      "not_recommended_for"
    ]);
    expect(RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE.example_status).toBe(
      "active | historical_reference | retired"
    );
  });

  it("keeps lifecycle guidance aligned with maintenance guidance and field stability policies", () => {
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_ALIGNMENT.lifecycle_does_not_replace).toBe(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE"
    );
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_ALIGNMENT.related_assets).toContain(
      "RECOVERY_RETROSPECTIVE_ARCHIVE_FIELD_STABILITY_POLICY"
    );
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_ALIGNMENT.related_assets).toContain(
      "RECOVERY_RETROSPECTIVE_COMPARISON_FIELD_STABILITY_POLICY"
    );
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE.suggested_review_when).toContain(
      "field_stability_policy_changed"
    );
  });

  it("provides minimal historical_reference and retired examples", () => {
    const historical = RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_EXAMPLES.historical_reference_example;
    expect(historical.example_status).toBe("historical_reference");
    expect(historical.reason).toContain("no longer the preferred");

    const retired = RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_EXAMPLES.retired_example;
    expect(retired.example_status).toBe("retired");
    expect(retired.recommended_replacement.length).toBeGreaterThan(0);
    expect(retired.not_recommended_for).toContain("Current");
  });

  it("preserves theoretical restricted semantics via note without extra status", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_ALIGNMENT.theoretical_restricted_note_rule
    ).toContain("without adding extra lifecycle status");
    expect(
      RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_EXAMPLES.breaking_external_theoretical.example_status
    ).toBe("historical_reference");
    expect(
      RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_EXAMPLES.breaking_external_theoretical.reason
    ).toContain("restricted_high_risk");
    expect(RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.breaking_external.phase1_policy).toBe(
      "restricted_high_risk"
    );
  });
});

describe("recovery example lifecycle change note and review cadence semantics", () => {
  it("provides lifecycle change note template with required fields", () => {
    expect(Object.keys(RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_TEMPLATE)).toEqual([
      "from_status",
      "to_status",
      "reason",
      "recommended_replacement",
      "still_useful_for",
      "review_after",
      "notes"
    ]);
  });

  it("covers lifecycle review cadence guidance for historical and retired states", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_REVIEW_CADENCE_GUIDANCE.historical_reference_review_when
    ).toEqual([
      "field_stability_or_controlled_summary_guidance_changed",
      "phrase_guidance_or_drift_response_changed",
      "mainstream_scenario_shifted"
    ]);
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_REVIEW_CADENCE_GUIDANCE.retired_review_when
    ).toEqual([
      "recommended_replacement_changed",
      "restricted_or_theoretical_boundary_semantics_changed"
    ]);
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_REVIEW_CADENCE_GUIDANCE.active_review_source
    ).toBe("RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE");
  });

  it("keeps lifecycle change note and historical note / maintenance guidance non-conflicting", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_ALIGNMENT.lifecycle_change_note_answers
    ).toBe("why_status_changed_now");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_ALIGNMENT.historical_note_answers
    ).toBe("why_current_status_is_kept");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_ALIGNMENT.lifecycle_change_note_does_not_replace
    ).toBe("RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_ALIGNMENT.lifecycle_review_cadence_does_not_replace
    ).toBe("RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE");
  });

  it("freezes minimal status transition semantics with conservative boundaries", () => {
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.active_to_historical_reference).toEqual(
      {
        guidance: "recommended_when_old_example_is_useful_for_context_but_not_preferred",
        allowed: true
      }
    );
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.active_to_retired).toEqual({
      guidance: "recommended_when_rule_or_writing_guidance_change_makes_example_non_representative",
      allowed: true
    });
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.historical_reference_to_retired
    ).toEqual({
      guidance: "recommended_when_example_no_longer_has_context_or_teaching_value",
      allowed: true
    });
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.historical_reference_to_active
    ).toEqual({
      guidance: "restricted_case_by_case_only_with_explicit_reason_and_alignment_review",
      allowed: true
    });
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.retired_to_active).toEqual({
      guidance: "not_recommended_theoretical_only_with_explicit_reactivation_rationale",
      allowed: false
    });
  });

  it("provides minimal lifecycle change note examples for required transitions", () => {
    const activeToHistorical =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_EXAMPLES.active_to_historical_reference;
    expect(activeToHistorical.from_status).toBe("active");
    expect(activeToHistorical.to_status).toBe("historical_reference");
    expect(activeToHistorical.notes.length).toBeGreaterThan(0);

    const historicalToRetired =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_EXAMPLES.historical_reference_to_retired;
    expect(historicalToRetired.from_status).toBe("historical_reference");
    expect(historicalToRetired.to_status).toBe("retired");
    expect(historicalToRetired.recommended_replacement.length).toBeGreaterThan(0);
  });

  it("preserves restricted semantics in theoretical lifecycle transition example", () => {
    const theoretical =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_EXAMPLES.retired_to_active_theoretical;
    expect(theoretical.from_status).toBe("retired");
    expect(theoretical.to_status).toBe("active");
    expect(theoretical.reason).toContain("restricted_high_risk");
    expect(theoretical.notes).toContain("Theoretical-only");
    expect(RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.breaking_external.phase1_policy).toBe(
      "restricted_high_risk"
    );
  });
});

describe("recovery lifecycle change note phrases and regression template semantics", () => {
  it("covers key lifecycle transition phrases", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASES.transition_recommended
        .active_to_historical_reference
    ).toContain("historical_reference");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASES.transition_recommended
        .active_to_retired
    ).toContain("retired");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASES.transition_recommended
        .historical_reference_to_retired
    ).toContain("historical");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASES.transition_restricted
        .historical_reference_to_active
    ).toContain("Restricted");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASES.transition_restricted
        .retired_to_active_theoretical
    ).toContain("restricted_high_risk");
  });

  it("keeps phrases aligned with lifecycle change note template fields", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASE_ALIGNMENT.serves_template
    ).toBe("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASE_ALIGNMENT.field_alignment
        .recommended_replacement
    ).toEqual(["replacement_provided"]);
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASE_ALIGNMENT.field_alignment
        .still_useful_for
    ).toEqual(["still_context_valuable"]);
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASE_ALIGNMENT.field_alignment
        .review_after
    ).toEqual(["review_after_rule_or_phrase_change"]);
  });

  it("keeps phrase list non-conflicting with lifecycle guidance and maintenance/historical templates", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASE_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASE_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASE_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE");
  });

  it("provides minimal regression assertion template for lifecycle transitions", () => {
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_TEMPLATE.assertion_slots).toEqual(
      [
        "transition_pair_allowed",
        "reason_provided",
        "replacement_or_none_provided",
        "still_useful_for_or_notes_provided",
        "boundary_semantics_checked"
      ]
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_TEMPLATE.transition_cases
        .active_to_historical_reference
    ).toEqual({
      from_status: "active",
      to_status: "historical_reference",
      boundary: "recommended"
    });
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_TEMPLATE.transition_cases
        .retired_to_active.boundary
    ).toBe("theoretical_not_recommended");
  });

  it("keeps regression template aligned with step33 transition semantics only", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_ALIGNMENT.source_semantics
    ).toBe("RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_ALIGNMENT.source_template
    ).toBe("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_ALIGNMENT.does_not_add_rules
    ).toBe("regression_template_reuses_existing_semantics_only");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.retired_to_active.allowed).toBe(
      false
    );
  });

  it("provides minimal phrase and regression examples for direct reuse", () => {
    const phraseExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASE_EXAMPLES.active_to_historical_reference_reuse;
    expect(phraseExample.from_status).toBe("active");
    expect(phraseExample.to_status).toBe("historical_reference");
    expect(phraseExample.notes_phrase).toContain("no longer recommended");

    const regressionExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_EXAMPLES.historical_reference_to_retired_minimal;
    expect(regressionExample.transition_key).toBe("historical_reference_to_retired");
    expect(regressionExample.boundary).toBe("recommended");
    expect(regressionExample.boundary_semantics_checked).toBe(true);
  });

  it("preserves retired to active as theoretical and not recommended in regression examples", () => {
    const theoretical =
      RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_EXAMPLES.retired_to_active_theoretical;
    expect(theoretical.transition_key).toBe("retired_to_active");
    expect(theoretical.boundary).toBe("theoretical_not_recommended");
    expect(theoretical.boundary_semantics_checked).toBe(true);
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASES.transition_restricted
        .retired_to_active_theoretical
    ).toContain("not recommended");
  });
});

describe("recovery lifecycle completion checklist and cross-template reference semantics", () => {
  it("covers key manual completion checklist items", () => {
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST.checks).toEqual([
      "from_status_and_to_status_explicit",
      "reason_provided",
      "recommended_replacement_or_none_explicit",
      "still_useful_for_or_notes_semantics_provided",
      "aligned_with_transition_semantics",
      "historical_note_reference_checked",
      "maintenance_guidance_reference_checked",
      "regression_example_update_need_checked",
      "restricted_or_theoretical_boundary_marked"
    ]);
  });

  it("keeps completion checklist aligned with step33 and step34 lifecycle semantics", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST_ALIGNMENT.serves_templates
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST_ALIGNMENT.serves_templates
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST_ALIGNMENT.reuses_existing_rules
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.retired_to_active.allowed).toBe(
      false
    );
  });

  it("provides cross-template reference template with required fields", () => {
    expect(Object.keys(RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE)).toEqual([
      "transition_key",
      "lifecycle_change_note_reference",
      "historical_note_reference",
      "maintenance_guidance_reference",
      "regression_template_reference",
      "omitted_references_reason",
      "theoretical_or_restricted_boundary"
    ]);
  });

  it("keeps cross-template reference bounded to lifecycle family and not document reference template", () => {
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_ALIGNMENT.local_scope).toBe(
      "lifecycle_template_family_only"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_ALIGNMENT.local_scope_templates
    ).toContain("RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_ALIGNMENT.local_scope_templates
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_ALIGNMENT.local_scope_templates
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_ALIGNMENT
        .does_not_replace_document_reference_template
    ).toBe("RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE");
  });

  it("provides minimal checklist and cross-template examples for key transitions", () => {
    const checklistExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST_EXAMPLES.active_to_historical_reference;
    expect(checklistExample.from_status).toBe("active");
    expect(checklistExample.to_status).toBe("historical_reference");
    expect(checklistExample.recommended_replacement_or_none_explicit).toBe(true);
    expect(checklistExample.restricted_or_theoretical_boundary_marked).toBe(false);

    const crossTemplateExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_EXAMPLES.historical_reference_to_retired;
    expect(crossTemplateExample.transition_key).toBe("historical_reference_to_retired");
    expect(crossTemplateExample.historical_note_reference).toBe("retired_example");
    expect(crossTemplateExample.regression_template_reference).toBe(
      "historical_reference_to_retired"
    );
  });

  it("preserves retired to active as theoretical restricted path in checklist and cross-template examples", () => {
    const checklistTheoretical =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST_EXAMPLES.retired_to_active_theoretical;
    expect(checklistTheoretical.from_status).toBe("retired");
    expect(checklistTheoretical.to_status).toBe("active");
    expect(checklistTheoretical.restricted_or_theoretical_boundary_marked).toBe(true);

    const referenceTheoretical =
      RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_EXAMPLES.retired_to_active_theoretical;
    expect(referenceTheoretical.transition_key).toBe("retired_to_active");
    expect(referenceTheoretical.theoretical_or_restricted_boundary).toContain(
      "restricted_high_risk"
    );
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.retired_to_active.allowed).toBe(
      false
    );
  });
});

describe("recovery lifecycle closure review cadence and filling drift semantics", () => {
  it("covers key lifecycle closure review cadence triggers", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_GUIDANCE.suggested_review_when
    ).toEqual([
      "lifecycle_transition_semantics_boundary_changed",
      "historical_note_template_semantics_changed",
      "maintenance_guidance_semantics_changed",
      "regression_template_semantics_changed",
      "repeated_semantics_same_but_field_style_divergence_feedback",
      "theoretical_or_restricted_boundary_wording_changed"
    ]);
  });

  it("keeps cadence guidance non-conflicting with existing review guidances", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_ALIGNMENT.scope_answers
    ).toBe("when_to_revisit_lifecycle_checklist_and_cross_template_reference");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_REVIEW_CADENCE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_TRACE_CLOSURE_REVIEW_CADENCE_GUIDANCE");
  });

  it("covers key filling drift reminder phrases", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES.reason_too_generic
    ).toContain("too generic");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES
        .replacement_missing_or_none_not_explicit
    ).toContain("recommended_replacement");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES
        .still_useful_for_or_notes_too_empty
    ).toContain("still_useful_for/notes");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES
        .historical_note_reference_missing
    ).toContain("historical_note_reference");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES
        .maintenance_guidance_reference_missing
    ).toContain("maintenance_guidance_reference");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES
        .theoretical_or_restricted_boundary_missing
    ).toContain("boundary");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES
        .omitted_references_reason_too_vague
    ).toContain("omitted_references_reason");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES.lifecycle_phrase_not_reused
    ).toContain("phrase reuse");
  });

  it("keeps drift phrases aligned with checklist and cross-template reference only", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_ALIGNMENT.aligned_with_checklist
    ).toBe("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_ALIGNMENT.aligned_with_cross_template_reference
    ).toBe("RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_ALIGNMENT.does_not_replace).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASES"
    );
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_ALIGNMENT.does_not_replace).toContain(
      "RECOVERY_REVIEW_PHRASE_GUIDANCE"
    );
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_ALIGNMENT.does_not_replace).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_TEMPLATE"
    );
  });

  it("provides minimal review cadence and drift reminder examples", () => {
    const cadenceExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_EXAMPLES
        .checklist_review_trigger;
    expect(cadenceExample.trigger).toBe("repeated_semantics_same_but_field_style_divergence_feedback");
    expect(cadenceExample.scope).toBe("lifecycle_closure_layers_only");

    const driftExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_EXAMPLES
        .cross_template_reference_missing_historical_note;
    expect(driftExample.transition_key).toBe("historical_reference_to_retired");
    expect(driftExample.drift_phrase).toContain("historical_note_reference");
  });

  it("preserves retired_to_active as theoretical restricted semantics in drift examples", () => {
    const theoreticalDrift =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_EXAMPLES
        .retired_to_active_theoretical_boundary_missing;
    expect(theoreticalDrift.transition_key).toBe("retired_to_active");
    expect(theoreticalDrift.recommended_fix).toContain("restricted_high_risk");

    const theoreticalCadence =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_EXAMPLES
        .theoretical_boundary_trigger;
    expect(theoreticalCadence.trigger).toBe("theoretical_or_restricted_boundary_wording_changed");
    expect(theoreticalCadence.action).toContain("retired_to_active_theoretical");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.retired_to_active.allowed).toBe(
      false
    );
  });
});

describe("recovery lifecycle cadence/drift record and drift example review semantics", () => {
  it("provides cadence/drift record template with required fields", () => {
    expect(Object.keys(RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_TEMPLATE)).toEqual(
      [
        "record_scope",
        "record_type",
        "trigger_reason",
        "signals_observed",
        "impact_on_templates",
        "follow_up_needed",
        "recommended_action",
        "archived_note"
      ]
    );
  });

  it("keeps record template aligned with step36 cadence and drift semantics", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_ALIGNMENT.serves_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_ALIGNMENT.serves_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST");
  });

  it("covers key drift example review guidance triggers", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DRIFT_EXAMPLE_REVIEW_GUIDANCE.suggested_review_when
    ).toEqual([
      "filling_drift_phrases_changed",
      "checklist_or_cross_template_fields_changed",
      "theoretical_or_restricted_boundary_wording_changed",
      "same_drift_intent_expressed_with_multiple_phrases"
    ]);
  });

  it("keeps drift example review guidance aligned with filling drift phrases", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_REVIEW_ALIGNMENT.related_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_REVIEW_ALIGNMENT.related_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DRIFT_EXAMPLE_REVIEW_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_REVIEW_ALIGNMENT.record_template_answers
    ).toBe("what_happened_in_this_cadence_or_drift_review");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_REVIEW_ALIGNMENT
        .example_review_guidance_answers
    ).toBe("which_drift_reuse_examples_should_be_revisited");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_REVIEW_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES");
  });

  it("provides minimal cadence record and drift review examples", () => {
    const cadenceRecord =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_EXAMPLES.cadence_review_record;
    expect(cadenceRecord.record_type).toBe("cadence_review");
    expect(cadenceRecord.trigger_reason).toBe("lifecycle_transition_semantics_boundary_changed");

    const driftTrigger =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DRIFT_EXAMPLE_REVIEW_EXAMPLES
        .cross_template_reference_drift_trigger;
    expect(driftTrigger.trigger).toBe("checklist_or_cross_template_fields_changed");
    expect(driftTrigger.scope).toBe("cross_template_reference_examples");
  });

  it("preserves theoretical restricted semantics in cadence/drift records and review examples", () => {
    const theoreticalRecord =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_EXAMPLES
        .retired_to_active_mixed_record;
    expect(theoreticalRecord.record_type).toBe("mixed");
    expect(theoreticalRecord.signals_observed).toContain("restricted_high_risk");

    const theoreticalTrigger =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DRIFT_EXAMPLE_REVIEW_EXAMPLES
        .retired_to_active_theoretical_trigger;
    expect(theoreticalTrigger.trigger).toBe("theoretical_or_restricted_boundary_wording_changed");
    expect(theoreticalTrigger.action).toContain("restricted_high_risk");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.retired_to_active.allowed).toBe(
      false
    );
  });
});

describe("recovery lifecycle cadence/drift record classification and doc index patch semantics", () => {
  it("covers four minimal cadence/drift record classifications", () => {
    expect(
      Object.keys(
        RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_TEMPLATE.classifications
      )
    ).toEqual(["cadence_only", "drift_only", "mixed", "theoretical_restricted"]);
  });

  it("keeps classification template aligned with step37 record template and cadence/drift semantics", () => {
    const classificationTemplate =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_TEMPLATE;
    const supportedRecordTypes =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_TEMPLATE.record_type;

    for (const classification of Object.values(classificationTemplate.classifications)) {
      expect(supportedRecordTypes).toContain(classification.recommended_record_type);
      expect(classification.recommended_trigger_reason_style.length).toBeGreaterThan(0);
    }

    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_ALIGNMENT
        .step37_record_template_answers
    ).toBe("record_structure_for_single_cadence_or_drift_entry");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_ALIGNMENT
        .classification_template_answers
    ).toBe("which_local_record_class_to_use_and_how_to_write_it");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES");
  });

  it("provides lifecycle doc index patch with required minimal entries", () => {
    expect(Object.keys(RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH)).toEqual([
      "index_scope",
      "entries",
      "execution_note"
    ]);
    expect(Object.keys(RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH.entries)).toEqual([
      "lifecycle_change_note",
      "lifecycle_review_cadence",
      "lifecycle_phrases",
      "regression_template",
      "lifecycle_completion_checklist",
      "cross_template_reference",
      "cadence_drift_record",
      "drift_example_review_guidance",
      "lifecycle_examples_and_theoretical_restricted"
    ]);
  });

  it("keeps doc index patch aligned with lifecycle template family and document reference boundary", () => {
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH.entries.lifecycle_change_note.constants).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_TEMPLATE"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH.entries
        .lifecycle_completion_checklist.constants
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH.entries
        .cross_template_reference.constants
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH.entries.cadence_drift_record.constants).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_TEMPLATE"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_ALIGNMENT
        .does_not_replace_document_reference_template
    ).toBe("RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_ALIGNMENT.doc_index_patch_scope
    ).toBe("lifecycle_closure_layer_overview_navigation");
  });

  it("provides minimal classification and doc index patch examples for direct reuse", () => {
    const driftOnlyExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_EXAMPLES
        .drift_only;
    expect(driftOnlyExample.classification).toBe("drift_only");
    expect(driftOnlyExample.recommended_record_type).toBe("filling_drift");

    const docIndexExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_EXAMPLES.minimal_reference;
    expect(docIndexExample.start_entry).toBe("cadence_drift_record");
    expect(docIndexExample.linked_entries).toContain("cross_template_reference");
  });

  it("preserves theoretical_restricted high-risk semantics in classification and examples", () => {
    const theoreticalClassification =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_TEMPLATE
        .classifications.theoretical_restricted;
    expect(theoreticalClassification.recommended_trigger_reason_style).toContain(
      "restricted_high_risk"
    );
    expect(theoreticalClassification.recommended_record_type).toBe("mixed");

    const theoreticalExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_EXAMPLES
        .theoretical_restricted;
    expect(theoreticalExample.trigger_reason_style).toContain("restricted_high_risk");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.retired_to_active.allowed).toBe(
      false
    );
  });
});

describe("recovery lifecycle doc index maintenance and classification phrase semantics", () => {
  it("covers key maintenance triggers for lifecycle doc index patch", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_CHECKLIST.triggers
    ).toEqual([
      "new_lifecycle_closure_template_or_constant_added",
      "lifecycle_docs_renamed_split_or_merged",
      "lifecycle_template_family_relationship_changed",
      "theoretical_or_restricted_example_location_changed",
      "indexed_item_becomes_historical_or_restricted_only"
    ]);
  });

  it("keeps maintenance checklist aligned with step38 doc index patch boundaries", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_ALIGNMENT
        .step38_doc_index_patch_answers
    ).toBe("what_lifecycle_closure_assets_are_currently_indexed");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_ALIGNMENT
        .maintenance_checklist_answers
    ).toBe("when_doc_index_patch_should_be_reviewed_or_updated");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_ALIGNMENT
        .related_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE");
  });

  it("covers four classification phrase groups", () => {
    expect(Object.keys(RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASES)).toEqual(
      ["cadence_only", "drift_only", "mixed", "theoretical_restricted"]
    );
  });

  it("keeps classification phrases aligned with classification template and existing phrase/template boundaries", () => {
    expect(
      Object.keys(RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASES)
    ).toEqual(
      Object.keys(
        RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_TEMPLATE
          .classifications
      )
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASE_ALIGNMENT.serves_template
    ).toBe("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_REVIEW_PHRASE_GUIDANCE");
  });

  it("provides minimal maintenance and mixed classification phrase examples", () => {
    const maintenanceExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_EXAMPLES
        .doc_rename_trigger;
    expect(maintenanceExample.trigger).toBe("lifecycle_docs_renamed_split_or_merged");
    expect(maintenanceExample.scope).toBe("lifecycle_closure_navigation_patch");

    const mixedPhraseExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASE_EXAMPLES.mixed_reuse;
    expect(mixedPhraseExample.classification).toBe("mixed");
    expect(mixedPhraseExample.trigger_reason_phrase).toContain("cadence boundary");
  });

  it("preserves theoretical_restricted semantics in classification phrases", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASES.theoretical_restricted.trigger_reason_phrase
    ).toContain("restricted_high_risk");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASE_EXAMPLES
        .theoretical_restricted_reuse.trigger_reason_phrase
    ).toContain("restricted_high_risk");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.retired_to_active.allowed).toBe(
      false
    );
  });
});

describe("recovery lifecycle navigation review record and phrase retrospective semantics", () => {
  it("provides navigation review record template with required fields", () => {
    expect(Object.keys(RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_TEMPLATE)).toEqual(
      [
        "review_scope",
        "review_focus",
        "signals_observed",
        "consistency_status",
        "template_or_phrase_updates_needed",
        "follow_up_needed",
        "review_note"
      ]
    );
  });

  it("keeps navigation review record aligned with step39 maintenance checklist and classification phrases", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_ALIGNMENT.serves_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_CHECKLIST");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_ALIGNMENT.serves_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_TEMPLATE");
  });

  it("covers key navigation phrase retrospective triggers", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_GUIDANCE
        .suggested_review_when
    ).toEqual([
      "doc_index_navigation_phrase_clarity_degraded",
      "classification_phrases_no_longer_match_current_record_writing",
      "maintenance_checklist_trigger_wording_became_ambiguous",
      "theoretical_or_restricted_navigation_wording_weakened",
      "multiple_near_synonym_navigation_phrases_coexist"
    ]);
  });

  it("keeps phrase retrospective guidance aligned with step39/38 and step26/27 boundaries", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_CHECKLIST");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_REVIEW_PHRASE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_TERMINOLOGY_DRIFT_SIGNALS");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_ALIGNMENT
        .related_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASES");
  });

  it("provides minimal navigation review and phrase retrospective examples", () => {
    const reviewRecord =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_EXAMPLES
        .doc_index_maintenance_review;
    expect(reviewRecord.review_focus).toBe("doc_index_maintenance");
    expect(reviewRecord.signals_observed).toContain("Doc path rename");

    const phraseReview =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_EXAMPLES
        .classification_phrases_review;
    expect(phraseReview.trigger).toBe("classification_phrases_no_longer_match_current_record_writing");
    expect(phraseReview.scope).toBe("classification_phrase_navigation_layer");
  });

  it("preserves theoretical_restricted semantics in navigation review and phrase retrospective examples", () => {
    const theoreticalReview =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_EXAMPLES
        .theoretical_restricted_navigation_review;
    expect(theoreticalReview.signals_observed).toContain("restricted_high_risk");

    const theoreticalPhraseReview =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_EXAMPLES
        .theoretical_restricted_phrase_review;
    expect(theoreticalPhraseReview.trigger).toBe("theoretical_or_restricted_navigation_wording_weakened");
    expect(theoreticalPhraseReview.action).toContain("restricted_high_risk");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.retired_to_active.allowed).toBe(
      false
    );
  });
});

describe("recovery lifecycle navigation archive index and phrase example maintenance semantics", () => {
  it("provides navigation archive index template with required fields", () => {
    expect(Object.keys(RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_TEMPLATE)).toEqual(
      [
        "archive_id",
        "review_scope",
        "review_focus",
        "signals_observed_count",
        "consistency_status",
        "template_or_phrase_updates_needed",
        "follow_up_needed",
        "archived_at",
        "archive_note"
      ]
    );
  });

  it("keeps archive index aligned with step40 navigation review and retrospective boundaries", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_ALIGNMENT
        .step40_review_record_answers
    ).toBe("what_the_navigation_review_record_contains");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_ALIGNMENT.archive_index_answers
    ).toBe("how_that_navigation_review_is_lightly_indexed_for_lookup");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE");
  });

  it("covers key phrase example maintenance guidance triggers", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_GUIDANCE
        .suggested_review_when
    ).toEqual([
      "navigation_phrase_retrospective_guidance_changed",
      "record_classification_phrases_changed",
      "doc_index_patch_entries_changed_affecting_navigation_wording",
      "theoretical_or_restricted_navigation_wording_changed",
      "same_navigation_intent_expressed_by_multiple_near_synonym_phrases"
    ]);
  });

  it("keeps phrase example maintenance aligned with step40 retrospective, step39 phrases, and step38 doc index patch", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_ALIGNMENT
        .related_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_ALIGNMENT
        .related_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_ALIGNMENT
        .related_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_GUIDANCE");
  });

  it("provides minimal navigation archive index and phrase maintenance examples", () => {
    const archiveExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_EXAMPLES
        .navigation_archive_entry;
    expect(archiveExample.review_focus).toBe("doc_index_maintenance");
    expect(archiveExample.signals_observed_count).toBe(2);

    const maintenanceExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_EXAMPLES
        .classification_phrase_change_trigger;
    expect(maintenanceExample.trigger).toBe("record_classification_phrases_changed");
    expect(maintenanceExample.scope).toBe("classification_phrase_navigation_examples");
  });

  it("preserves theoretical_restricted semantics in archive index and phrase maintenance examples", () => {
    const theoreticalArchive =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_EXAMPLES
        .theoretical_restricted_archive_entry;
    expect(theoreticalArchive.template_or_phrase_updates_needed).toContain("restricted_high_risk");

    const theoreticalMaintenance =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_EXAMPLES
        .theoretical_restricted_trigger;
    expect(theoreticalMaintenance.trigger).toBe("theoretical_or_restricted_navigation_wording_changed");
    expect(theoreticalMaintenance.action).toContain("restricted_high_risk");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.retired_to_active.allowed).toBe(
      false
    );
  });
});

describe("recovery navigation archive index update cadence and trigger phrase semantics", () => {
  it("covers key navigation archive index update cadence triggers", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_GUIDANCE
        .suggested_review_when
    ).toEqual([
      "navigation_review_record_fields_or_semantics_changed",
      "navigation_phrase_retrospective_focus_changed",
      "archive_index_examples_not_covering_mainstream_navigation_review_scenarios",
      "theoretical_or_restricted_navigation_entry_semantics_changed"
    ]);
  });

  it("keeps update cadence guidance non-conflicting with step41/40 templates and step27 closure cadence", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_ALIGNMENT
        .scope_answers
    ).toBe("when_navigation_archive_index_itself_should_be_revisited");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_TRACE_CLOSURE_REVIEW_CADENCE_GUIDANCE");
  });

  it("covers key navigation trigger phrase scenarios", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES
        .classification_phrases_changed
    ).toContain("Classification phrases changed");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES.doc_index_patch_changed
    ).toContain("Doc index patch entries changed");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES
        .navigation_retrospective_guidance_changed
    ).toContain("retrospective guidance changed");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES
        .theoretical_restricted_changed
    ).toContain("restricted_high_risk");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES
        .near_synonym_drift_detected
    ).toContain("near-synonym");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES.mainstream_scenario_not_covered
    ).toContain("mainstream");
  });

  it("keeps trigger phrases aligned with step41 maintenance guidance", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_ALIGNMENT
        .serves_guidance
    ).toBe("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_ALIGNMENT
        .aligned_with_triggers
    ).toEqual(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_GUIDANCE.suggested_review_when
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH");
  });

  it("provides minimal update cadence and trigger phrase examples", () => {
    const cadenceExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_EXAMPLES
        .archive_index_update_trigger;
    expect(cadenceExample.trigger).toBe("navigation_review_record_fields_or_semantics_changed");
    expect(cadenceExample.scope).toBe("navigation_archive_index_assets");

    const triggerPhraseExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_EXAMPLES
        .trigger_phrase_reuse;
    expect(triggerPhraseExample.trigger_key).toBe("record_classification_phrases_changed");
    expect(triggerPhraseExample.phrase).toContain("Classification phrases changed");
  });

  it("preserves theoretical_restricted semantics in cadence and trigger phrase examples", () => {
    const theoreticalCadence =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_EXAMPLES
        .theoretical_restricted_update_trigger;
    expect(theoreticalCadence.action).toContain("restricted_high_risk");

    const theoreticalTriggerPhrase =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_EXAMPLES
        .theoretical_restricted_trigger_phrase_reuse;
    expect(theoreticalTriggerPhrase.phrase).toContain("restricted_high_risk");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.retired_to_active.allowed).toBe(
      false
    );
  });
});

describe("recovery navigation cadence/trigger review note and phrase comparison semantics", () => {
  it("provides navigation cadence/trigger review note template with required fields", () => {
    expect(
      Object.keys(
        RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_TEMPLATE
      )
    ).toEqual([
      "review_scope",
      "review_subject",
      "observed_variation",
      "current_recommended_phrase_or_trigger",
      "reason_for_keep_or_adjust",
      "follow_up_needed",
      "note"
    ]);
  });

  it("keeps review note template aligned with step42 assets and bounded from broader retrospective templates", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_ALIGNMENT
        .serves_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_ALIGNMENT
        .serves_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE");
  });

  it("provides navigation trigger phrase comparison template with required fields", () => {
    expect(
      Object.keys(
        RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE
      )
    ).toEqual([
      "previous_phrase_reference",
      "current_phrase_reference",
      "meaning_changed",
      "scope_changed",
      "restricted_boundary_changed",
      "comparison_note"
    ]);
  });

  it("keeps phrase comparison template aligned with step42 trigger phrases and bounded from global comparison/guidance assets", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_ALIGNMENT
        .serves_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_REVIEW_PHRASE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_TERMINOLOGY_DRIFT_SIGNALS");
  });

  it("provides minimal update_cadence review note and trigger phrase comparison examples", () => {
    const reviewNoteExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_EXAMPLES
        .update_cadence_review;
    expect(reviewNoteExample.review_subject).toBe("update_cadence");
    expect(reviewNoteExample.current_recommended_phrase_or_trigger).toContain("mainstream");

    const comparisonExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLES
        .trigger_phrase_comparison;
    expect(comparisonExample.previous_phrase_reference).toBe("doc_index_patch_changed_v1");
    expect(comparisonExample.current_phrase_reference).toBe("doc_index_patch_changed");
    expect(comparisonExample.meaning_changed).toBe("no");
  });

  it("preserves theoretical_restricted semantics in review note and phrase comparison examples", () => {
    const theoreticalReviewNote =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_EXAMPLES
        .theoretical_restricted_review;
    expect(theoreticalReviewNote.current_recommended_phrase_or_trigger).toContain(
      "restricted_high_risk"
    );

    const theoreticalComparison =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLES
        .theoretical_restricted_comparison;
    expect(theoreticalComparison.restricted_boundary_changed).toBe("yes");
    expect(theoreticalComparison.comparison_note).toContain("restricted_high_risk");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.retired_to_active.allowed).toBe(
      false
    );
  });
});

describe("recovery navigation review-note/comparison maintenance and comparison phrases semantics", () => {
  it("covers key maintenance checklist triggers for review note and phrase comparison layers", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_CHECKLIST.triggers
    ).toEqual([
      "reason_for_keep_or_adjust_recommended_writing_changed",
      "comparison_note_recommended_writing_changed",
      "step42_trigger_phrases_changed",
      "step40_retrospective_guidance_focus_changed",
      "theoretical_or_restricted_boundary_wording_changed",
      "semantic_consistent_but_detail_level_diverged_feedback"
    ]);
  });

  it("keeps maintenance checklist aligned with step43 templates and bounded from global guidances", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_ALIGNMENT
        .step43_templates_answer
    ).toBe("what_the_review_note_and_comparison_entry_structure_looks_like");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_ALIGNMENT
        .maintenance_checklist_answers
    ).toBe("when_to_revisit_review_note_and_comparison_structures_and_examples");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_REVIEW_PHRASE_GUIDANCE");
  });

  it("covers key comparison phrase scenarios", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASES
        .meaning_unchanged
    ).toContain("meaning remains unchanged");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASES
        .scope_unchanged
    ).toContain("scope remains unchanged");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASES
        .restricted_boundary_unchanged
    ).toContain("restricted boundary remains unchanged");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASES
        .wording_converged_only
    ).toContain("wording convergence only");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASES
        .navigation_clarity_affected
    ).toContain("navigation clarity is affected");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASES
        .comparison_note_required
    ).toContain("comparison note");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASES
        .theoretical_restricted_only
    ).toContain("restricted_high_risk");
  });

  it("keeps comparison phrases aligned with comparison template and bounded from existing phrase systems", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASE_ALIGNMENT
        .serves_template
    ).toBe("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASE_ALIGNMENT
        .aligns_with_template_fields
    ).toEqual(["meaning_changed", "scope_changed", "restricted_boundary_changed", "comparison_note"]);
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_REVIEW_PHRASE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES");
  });

  it("provides minimal maintenance trigger and comparison phrase examples", () => {
    const maintenanceTriggerExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_EXAMPLES
        .review_note_trigger;
    expect(maintenanceTriggerExample.trigger).toBe("step40_retrospective_guidance_focus_changed");
    expect(maintenanceTriggerExample.scope).toBe("navigation_review_note_and_comparison_layers");

    const comparisonPhraseExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASE_EXAMPLES
        .comparison_phrase_reuse;
    expect(comparisonPhraseExample.scene).toBe("wording_converged_only");
    expect(comparisonPhraseExample.phrase).toContain("wording convergence only");
  });

  it("preserves theoretical_restricted semantics in maintenance and comparison phrase examples", () => {
    const theoreticalPhrase =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASE_EXAMPLES
        .theoretical_restricted_phrase_reuse;
    expect(theoreticalPhrase.phrase).toContain("restricted_high_risk");
    expect(theoreticalPhrase.note).toContain("never weaken restricted boundary");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.retired_to_active.allowed).toBe(
      false
    );
  });
});

describe("recovery navigation review-note/comparison example review cadence and comparison archive semantics", () => {
  it("covers key example review cadence triggers", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_GUIDANCE.suggested_review_when
    ).toEqual([
      "maintenance_checklist_triggers_changed",
      "comparison_phrase_recommended_writing_changed",
      "step43_review_note_or_comparison_template_semantics_changed",
      "theoretical_or_restricted_boundary_wording_changed",
      "same_semantics_but_example_detail_level_diverged_feedback"
    ]);
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_GUIDANCE.execution_note
    ).toContain("not an automated reminder or inspection system");
  });

  it("keeps example review cadence aligned with step44/43 and bounded from step37 guidance", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_ALIGNMENT.scope_answers
    ).toBe("when_review_note_and_comparison_examples_themselves_should_be_revisited");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_ALIGNMENT.does_not_replace
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_CHECKLIST"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DRIFT_EXAMPLE_REVIEW_GUIDANCE");
  });

  it("provides comparison phrase example archive template with required fields", () => {
    expect(
      Object.keys(
        RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_TEMPLATE
      )
    ).toEqual([
      "example_id",
      "comparison_scope",
      "phrase_category",
      "historical_status",
      "replacement_example",
      "archive_reason",
      "still_useful_for",
      "archived_note"
    ]);
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_TEMPLATE
        .comparison_scope
    ).toBe("navigation_trigger_phrase_comparison_examples_only");
  });

  it("keeps comparison example archive aligned with step32 lifecycle/historical note roots and step43 comparison template", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_ALIGNMENT.step32_semantic_roots
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_STATUSES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_ALIGNMENT.step32_semantic_roots
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_ALIGNMENT.step32_semantic_roots
    ).toContain("RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE");
  });

  it("provides minimal cadence and comparison archive examples", () => {
    const cadenceExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_EXAMPLES
        .maintenance_trigger_changed;
    expect(cadenceExample.trigger).toBe("maintenance_checklist_triggers_changed");
    expect(cadenceExample.scope).toBe("navigation_review_note_and_comparison_example_assets");

    const archiveExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_EXAMPLES
        .comparison_phrase_archive_entry;
    expect(archiveExample.historical_status).toBe("historical_reference");
    expect(archiveExample.replacement_example).toBe("nav-trigger-comparison-example-002");
  });

  it("preserves theoretical_restricted semantics in cadence and comparison archive examples", () => {
    const theoreticalCadence =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_EXAMPLES
        .theoretical_restricted_trigger;
    expect(theoreticalCadence.action).toContain("restricted_high_risk");

    const theoreticalArchive =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_EXAMPLES
        .theoretical_restricted_archive_entry;
    expect(theoreticalArchive.still_useful_for).toContain("restricted_high_risk");
    expect(theoreticalArchive.archived_note).toContain("Theoretical-only");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.retired_to_active.allowed).toBe(
      false
    );
  });
});

describe("recovery navigation example cadence/archive phrases and archive reference semantics", () => {
  it("covers key cadence/archive phrase scenarios", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASES
        .maintenance_checklist_changed_review_examples
    ).toContain("Maintenance checklist updated");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASES
        .comparison_phrase_changed_review_archived_examples
    ).toContain("Comparison phrase recommendation changed");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASES
        .keep_as_historical_reference
    ).toContain("historical_reference");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASES
        .retire_and_point_to_replacement
    ).toContain("replacement");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASES
        .archive_note_only_no_main_template_change
    ).toContain("no main template adjustment");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASES
        .continue_using_no_cadence_archive_adjustment
    ).toContain("no cadence/archive semantic adjustment");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASES
        .add_why_when_to_review_note
    ).toContain("why/when to review");
  });

  it("keeps phrases aligned with step45 cadence/archive and bounded from step44/32/43 templates", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_ALIGNMENT
        .serves_assets
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_GUIDANCE"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_ALIGNMENT
        .serves_assets
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_TEMPLATE"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_CHECKLIST"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE");
  });

  it("provides archive reference template with required fields", () => {
    expect(
      Object.keys(
        RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_TEMPLATE
      )
    ).toEqual([
      "example_reference",
      "related_phrase_reference",
      "related_lifecycle_status_reference",
      "related_replacement_reference",
      "omitted_reference_reason",
      "restricted_boundary_reference"
    ]);
  });

  it("keeps archive reference template aligned with step25/35/45 reference layers", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_ALIGNMENT
        .serves_asset
    ).toBe(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_TEMPLATE"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_ALIGNMENT
        .related_reference_roots
    ).toContain("RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_ALIGNMENT
        .related_reference_roots
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_ALIGNMENT
        .local_scope
    ).toBe("comparison_example_archive_local_reference_only");
  });

  it("provides minimal cadence/archive phrase example and archive reference example", () => {
    const phraseExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_EXAMPLES
        .cadence_phrase_reuse;
    expect(phraseExample.scene).toBe("maintenance_checklist_changed_review_examples");
    expect(phraseExample.phrase).toContain("revisit related example cadence/archive entries");

    const referenceExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_EXAMPLES
        .comparison_archive_reference_entry;
    expect(referenceExample.example_reference).toBe("nav-trigger-comparison-example-001");
    expect(referenceExample.related_lifecycle_status_reference).toBe("historical_reference");
  });

  it("preserves theoretical_restricted semantics in phrases and archive references", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASES
        .theoretical_restricted_keep_boundary_note
    ).toContain("restricted_high_risk");

    const theoreticalPhraseExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_EXAMPLES
        .theoretical_restricted_phrase_reuse;
    expect(theoreticalPhraseExample.phrase).toContain("restricted_high_risk");
    expect(theoreticalPhraseExample.note).toContain("Theoretical-only");

    const theoreticalReferenceExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_EXAMPLES
        .theoretical_restricted_reference_entry;
    expect(theoreticalReferenceExample.restricted_boundary_reference).toContain("restricted_high_risk");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.retired_to_active.allowed).toBe(
      false
    );
  });
});

describe("recovery navigation cadence/archive phrase maintenance and archive-reference filling drift semantics", () => {
  it("covers key trigger items in cadence/archive phrase maintenance checklist", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_CHECKLIST.suggested_review_when
    ).toEqual([
      "step45_example_review_cadence_guidance_changed",
      "step45_archive_template_field_semantics_changed",
      "step32_example_lifecycle_or_historical_note_semantics_changed",
      "step43_comparison_semantics_changed_and_affects_archive_description",
      "theoretical_or_restricted_boundary_wording_changed",
      "same_semantics_but_phrase_choice_diverged_feedback"
    ]);
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_CHECKLIST.execution_note
    ).toContain("not an automated reminder or phrase recommendation system");
  });

  it("keeps maintenance checklist aligned with step46/45/32/43 assets and boundaries", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_ALIGNMENT.scope_answers
    ).toBe("when_cadence_archive_phrase_assets_should_be_revisited");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_ALIGNMENT.related_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_ALIGNMENT.related_assets
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_GUIDANCE"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_ALIGNMENT.related_assets
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_TEMPLATE"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_ALIGNMENT.related_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_ALIGNMENT.related_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE");
  });

  it("covers key filling drift reminders for archive reference template", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES
        .missing_or_ambiguous_example_reference
    ).toContain("example_reference is missing or too ambiguous");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES
        .missing_related_phrase_reference
    ).toContain("related_phrase_reference should be added");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES
        .missing_related_lifecycle_status_reference
    ).toContain("related_lifecycle_status_reference should be explicit");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES
        .missing_replacement_without_none_reason
    ).toContain("add replacement reference or explicitly mark none");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES
        .vague_omitted_reference_reason
    ).toContain("too vague");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES
        .correct_semantics_but_phrase_not_reused
    ).toContain("reuse existing phrase patterns");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES
        .local_reference_style_diverged_from_step35_or_step25
    ).toContain("diverges from Step 35/25 reference style");
  });

  it("keeps drift phrases aligned with step46 archive reference template and bounded from broader systems", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASE_ALIGNMENT
        .serves_template
    ).toBe(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_TEMPLATE"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASE_ALIGNMENT
        .related_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASE_ALIGNMENT
        .related_assets
    ).toContain("RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_REVIEW_PHRASE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASE_ALIGNMENT
        .local_scope
    ).toBe("comparison_example_archive_reference_filling_only");
  });

  it("provides minimal maintenance trigger and filling drift phrase examples", () => {
    const maintenanceExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_EXAMPLES
        .cadence_guidance_changed_trigger;
    expect(maintenanceExample.trigger).toBe("step45_example_review_cadence_guidance_changed");
    expect(maintenanceExample.scope).toBe("navigation_example_cadence_archive_phrase_assets");

    const fillingDriftExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASE_EXAMPLES
        .missing_phrase_reference_reminder;
    expect(fillingDriftExample.scene).toBe("missing_related_phrase_reference");
    expect(fillingDriftExample.phrase).toContain("related_phrase_reference should be added");
  });

  it("preserves theoretical_restricted semantics in filling drift phrases and examples", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES
        .missing_restricted_boundary_reference_for_theoretical
    ).toContain("Theoretical_restricted");

    const theoreticalDriftExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASE_EXAMPLES
        .theoretical_restricted_boundary_reminder;
    expect(theoreticalDriftExample.phrase).toContain("restricted_boundary_reference");
    expect(theoreticalDriftExample.note).toContain("restricted_high_risk");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.retired_to_active.allowed).toBe(
      false
    );
  });
});

describe("recovery navigation phrase-maintenance/filling-drift review record and local drift example cadence semantics", () => {
  it("provides review record template with required fields", () => {
    expect(
      Object.keys(
        RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_TEMPLATE
      )
    ).toEqual([
      "review_scope",
      "review_subject",
      "observed_issue",
      "affected_asset",
      "recommended_phrase_or_fix",
      "follow_up_needed",
      "review_note"
    ]);
  });

  it("keeps review record template aligned with step47 assets and bounded from step40/43/46 templates", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_ALIGNMENT
        .serves_assets
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_CHECKLIST"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_ALIGNMENT
        .serves_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_ALIGNMENT
        .does_not_replace
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_TEMPLATE"
    );
  });

  it("covers key trigger conditions for local archive reference drift example review cadence guidance", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_GUIDANCE.suggested_review_when
    ).toEqual([
      "filling_drift_phrases_changed",
      "step46_archive_reference_template_field_semantics_changed",
      "step35_or_step25_reference_style_baseline_changed_and_affects_local_writing",
      "theoretical_or_restricted_boundary_reference_wording_changed",
      "same_drift_scenario_but_multiple_reminder_writings_diverged"
    ]);
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_GUIDANCE.execution_note
    ).toContain("not an automated reminder or inspection workflow");
  });

  it("keeps local drift example review cadence bounded from step47/46/35/25 main assets", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_ALIGNMENT.scope_answers
    ).toBe("when_local_archive_reference_filling_drift_examples_should_be_revisited");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_ALIGNMENT.related_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_ALIGNMENT.related_assets
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_TEMPLATE"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_ALIGNMENT.related_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_ALIGNMENT.related_assets
    ).toContain("RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_ALIGNMENT.does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_ALIGNMENT.does_not_replace
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_TEMPLATE"
    );
  });

  it("provides minimal review record and local drift example cadence examples", () => {
    const reviewRecordExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_EXAMPLES
        .filling_drift_review_record;
    expect(reviewRecordExample.review_subject).toBe("filling_drift");
    expect(reviewRecordExample.recommended_phrase_or_fix).toContain("missing_related_phrase_reference");

    const cadenceExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_EXAMPLES
        .drift_phrase_changed_trigger;
    expect(cadenceExample.trigger).toBe("filling_drift_phrases_changed");
    expect(cadenceExample.scope).toBe("local_archive_reference_filling_drift_examples");
  });

  it("preserves theoretical_restricted semantics in local drift example review cadence examples", () => {
    const theoreticalCadenceExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_EXAMPLES
        .theoretical_restricted_trigger;
    expect(theoreticalCadenceExample.action).toContain("restricted_high_risk");
    expect(theoreticalCadenceExample.scope).toContain("theoretical_restricted");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.retired_to_active.allowed).toBe(
      false
    );
  });
});

describe("recovery navigation review-record/example-cadence trigger phrases and local reference review archive index semantics", () => {
  it("covers key trigger scenarios for review-record/example-cadence maintenance phrases", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASES
        .review_record_field_semantics_changed_revisit_examples
    ).toContain("Review record field semantics changed");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASES
        .filling_drift_phrase_changed_revisit_review_record_examples
    ).toContain("Filling drift reminder wording changed");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASES
        .archive_reference_template_field_changed_revisit_local_drift_examples
    ).toContain("Archive reference template field semantics changed");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASES
        .cross_template_or_document_reference_baseline_changed_revisit_local_examples
    ).toContain("Cross-template/document reference style baseline changed");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASES
        .same_trigger_intent_multiple_near_synonym_writings_revisit_and_converge
    ).toContain("near-synonym writings");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASES
        .example_can_continue_without_review_record_or_example_cadence_adjustment
    ).toContain("no review-record/example-cadence wording adjustment");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASES
        .add_why_when_to_review_note_for_current_example
    ).toContain("why/when to review");
  });

  it("keeps trigger phrases aligned with step48 assets and bounded from step47/46/35/25 systems", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASE_ALIGNMENT
        .serves_assets
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_TEMPLATE"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASE_ALIGNMENT
        .serves_assets
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_GUIDANCE"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_CHECKLIST"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_TEMPLATE"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE");
  });

  it("provides local reference review archive index template with required fields", () => {
    expect(
      Object.keys(
        RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_TEMPLATE
      )
    ).toEqual([
      "archive_id",
      "review_scope",
      "review_subject",
      "affected_asset",
      "follow_up_needed",
      "archived_at",
      "archive_note"
    ]);
  });

  it("keeps local reference review archive index aligned with step48 review record and step41/29 archival systems", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_ALIGNMENT
        .serves_asset
    ).toBe(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_TEMPLATE"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_ALIGNMENT
        .related_archival_roots
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_ALIGNMENT
        .related_archival_roots
    ).toContain("RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_ALIGNMENT
        .related_archival_roots
    ).toContain("RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_TEMPLATE");
  });

  it("provides minimal trigger phrase and local archive index examples", () => {
    const triggerPhraseExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASE_EXAMPLES
        .trigger_phrase_reuse;
    expect(triggerPhraseExample.scene).toBe("review_record_field_semantics_changed_revisit_examples");
    expect(triggerPhraseExample.phrase).toContain("Review record field semantics changed");

    const archiveIndexExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_EXAMPLES
        .local_reference_review_archive_entry;
    expect(archiveIndexExample.archive_id).toBe("local-ref-review-archive-001");
    expect(archiveIndexExample.review_subject).toBe("filling_drift");
  });

  it("preserves theoretical_restricted semantics in trigger phrase and local archive index examples", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASES
        .theoretical_restricted_boundary_changed_revisit_high_risk_examples
    ).toContain("Theoretical_restricted");

    const theoreticalPhraseExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASE_EXAMPLES
        .theoretical_restricted_trigger_phrase_reuse;
    expect(theoreticalPhraseExample.phrase).toContain("Theoretical_restricted");
    expect(theoreticalPhraseExample.note).toContain("restricted_high_risk");

    const theoreticalArchiveIndexExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_EXAMPLES
        .theoretical_restricted_local_reference_review_archive_entry;
    expect(theoreticalArchiveIndexExample.archive_note).toContain("restricted_high_risk");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.retired_to_active.allowed).toBe(
      false
    );
  });
});

describe("recovery navigation trigger-phrases/local-archive-index maintenance and filling drift semantics", () => {
  it("covers key trigger items in trigger-phrases/local-archive-index maintenance checklist", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_CHECKLIST.suggested_review_when
    ).toEqual([
      "step48_review_record_or_example_review_cadence_semantics_changed",
      "step49_local_archive_index_field_or_field_semantics_changed",
      "step47_maintenance_checklist_or_filling_drift_phrases_changed",
      "step35_or_step25_reference_baseline_changed_and_affects_local_index_writing",
      "theoretical_or_restricted_boundary_wording_changed",
      "trigger_phrase_and_maintenance_semantics_overlap_reduces_readability_feedback"
    ]);
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_CHECKLIST.execution_note
    ).toContain("not an automated reminder or indexing governance system");
  });

  it("keeps maintenance checklist aligned with step49/48/47/35/25 assets and boundaries", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_ALIGNMENT.scope_answers
    ).toBe("when_trigger_phrases_and_local_archive_index_assets_should_be_revisited");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_ALIGNMENT.related_assets
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASES"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_ALIGNMENT.related_assets
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_TEMPLATE"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_ALIGNMENT.related_assets
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_TEMPLATE"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_ALIGNMENT.related_assets
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_GUIDANCE"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_ALIGNMENT.related_assets
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_CHECKLIST"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_ALIGNMENT.related_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_ALIGNMENT.related_assets
    ).toContain("RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_ALIGNMENT.does_not_replace
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASES"
    );
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_ALIGNMENT.does_not_replace
    ).toContain(
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_TEMPLATE"
    );
  });

  it("covers key filling drift reminders for local archive index entries", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASES
        .missing_or_unclear_archive_id
    ).toContain("archive_id is missing or unclear");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASES
        .vague_review_scope
    ).toContain("review_scope wording is too vague");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASES
        .review_subject_not_aligned_with_local_assets
    ).toContain("review_subject should align");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASES
        .missing_affected_asset
    ).toContain("affected_asset should be explicitly filled");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASES
        .empty_follow_up_needed_semantics
    ).toContain("follow_up_needed semantics are too empty");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASES
        .vague_archive_note
    ).toContain("archive_note is too vague");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASES
        .local_index_style_diverged_from_step41_or_step29
    ).toContain("diverges from Step 41/29 archival style");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASES
        .semantics_correct_but_local_phrase_not_reused
    ).toContain("reuse existing local phrases");
  });

  it("keeps local archive index filling drift phrases aligned with step49 index template and bounded from broader systems", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASE_ALIGNMENT
        .serves_template
    ).toBe("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASE_ALIGNMENT
        .related_assets
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASE_ALIGNMENT
        .related_assets
    ).toContain("RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASE_ALIGNMENT
        .related_assets
    ).toContain("RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_REVIEW_PHRASE_GUIDANCE");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASE_ALIGNMENT
        .does_not_replace
    ).toContain("RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES");
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASE_ALIGNMENT
        .local_scope
    ).toBe("local_archive_index_filling_only");
  });

  it("provides minimal maintenance trigger and local archive index filling drift examples", () => {
    const maintenanceExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_EXAMPLES
        .review_record_semantics_changed_trigger;
    expect(maintenanceExample.trigger).toBe("step48_review_record_or_example_review_cadence_semantics_changed");
    expect(maintenanceExample.scope).toBe("trigger_phrases_and_local_archive_index_assets");

    const fillingDriftExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASE_EXAMPLES
        .missing_archive_id_reminder;
    expect(fillingDriftExample.scene).toBe("missing_or_unclear_archive_id");
    expect(fillingDriftExample.phrase).toContain("archive_id is missing or unclear");
  });

  it("preserves theoretical_restricted semantics in local archive index filling drift phrases and examples", () => {
    expect(
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASES
        .missing_restricted_boundary_in_theoretical_case
    ).toContain("Theoretical_restricted");

    const theoreticalDriftExample =
      RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASE_EXAMPLES
        .theoretical_restricted_boundary_reminder;
    expect(theoreticalDriftExample.phrase).toContain("restricted_high_risk");
    expect(theoreticalDriftExample.note).toContain("Theoretical-only");
    expect(RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS.retired_to_active.allowed).toBe(
      false
    );
  });
});

describe("recovery display version rehearsal template", () => {
  const runVersionRehearsalTemplate = (candidate: RecoveryDisplayView) => {
    const dto = mapRecoveryDisplayViewToExternalDto(candidate);
    expect(dto.viewVersion).toBe(RECOVERY_DISPLAY_VIEW_VERSION);
    for (const field of RECOVERY_EXTERNAL_DTO_FIELDS) {
      expect(dto[field]).not.toBeUndefined();
    }
  };

  it("template passes for current 1.0.0 display fixtures", () => {
    runVersionRehearsalTemplate(buildAppendDisplay());
    runVersionRehearsalTemplate(buildManualDisplay());
    runVersionRehearsalTemplate(buildQueryDisplay());
  });

  it("template allows future optional/defaulted additions without breaking adapter", () => {
    const futureCompatibleCandidate = {
      ...buildAppendDisplay(),
      // future optional/additive display field rehearsal
      futureOptionalField: "reserved"
    } as RecoveryDisplayView & { futureOptionalField: string };

    runVersionRehearsalTemplate(futureCompatibleCandidate as RecoveryDisplayView);
  });

  it("template links to display change impact checklist coverage", () => {
    const checklist = createRecoveryDisplayChangeImpactChecklistTemplate();
    for (const item of RECOVERY_DISPLAY_CHANGE_IMPACT_CHECKLIST_ITEMS) {
      expect(item in checklist).toBe(true);
    }
    expect(checklist.requires_version_rehearsal_update).toBe(false);

    const futureSchemaChangeChecklist = {
      ...checklist,
      touches_shared_core_fields: true,
      requires_view_version_bump: true,
      requires_adapter_test_updates: true,
      requires_version_rehearsal_update: true,
      requires_docs_update: true
    };
    expect(futureSchemaChangeChecklist.requires_version_rehearsal_update).toBe(true);
  });

  it("aligns warning template items with impact checklist items", () => {
    const checklist = createRecoveryDisplayChangeImpactChecklistTemplate();
    const checklistKeys = Object.keys(checklist);

    expect(RECOVERY_SHARED_CORE_FIELD_CHANGE_WARNING_TEMPLATE).toHaveLength(6);
    for (const item of Object.values(RECOVERY_WARNING_TO_IMPACT_CHECKLIST_ALIGNMENT)) {
      expect(checklistKeys).toContain(item);
    }
  });

  it("freezes baseline update rules for regression governance", () => {
    expect(RECOVERY_DTO_BASELINE_UPDATE_RULES).toEqual({
      optional_additive_field_without_dto_exposure: "baseline_update_not_required_by_default",
      shared_core_field_value_domain_change: "baseline_update_required",
      shared_core_field_remove_or_rename: "forbidden_in_phase1",
      view_version_change: "baseline_update_required"
    });
    expect(RECOVERY_DTO_BASELINE_UPDATE_RULES.view_version_change).toBe(
      "baseline_update_required"
    );
  });
});
