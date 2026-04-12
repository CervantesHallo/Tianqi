import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";
import type { StoredRiskCaseCoordinationResult } from "@tianqi/ports";

import { invalidApplicationCommandError } from "./application-error.js";
import type { ApplicationError } from "./application-error.js";
import {
  buildCoordinationResultFactKey,
  mapStoredCoordinationResultToReadView
} from "./coordination-result-persistence-mapper.js";
import { validateCoordinationResultStoreSchemaVersion } from "./coordination-result-store-schema.js";
import type { CoordinationAuditRecordSummaryView } from "./risk-case-coordination-result-read-view.js";

const mismatchError = (reason: string, details: Record<string, string>): ApplicationError =>
  invalidApplicationCommandError(reason, details);

export const validateCoordinationResultReplayCompatibility = (input: {
  readonly storedRecord: StoredRiskCaseCoordinationResult;
  readonly currentAuditSummary?: CoordinationAuditRecordSummaryView;
}): Result<StoredRiskCaseCoordinationResult, ApplicationError> => {
  const schema = validateCoordinationResultStoreSchemaVersion(input.storedRecord.schemaVersion);
  if (!schema.ok) {
    return err(schema.error);
  }

  const expectedFactKey = buildCoordinationResultFactKey({
    riskCaseId: input.storedRecord.riskCaseId,
    subcaseType: input.storedRecord.subcaseType,
    subcaseId: input.storedRecord.subcaseId,
    occurredAt: input.storedRecord.occurredAt
  });
  if (expectedFactKey !== input.storedRecord.factKey) {
    return err(
      mismatchError("Replay validation failed because stored coordination factKey is inconsistent", {
        expectedFactKey,
        storedFactKey: input.storedRecord.factKey
      })
    );
  }

  const storedView = mapStoredCoordinationResultToReadView(input.storedRecord);
  const storedAuditSummary = storedView.auditRecordSummary;
  if (storedAuditSummary.relatedCaseType && storedAuditSummary.relatedCaseType !== storedView.subcaseType) {
    return err(
      mismatchError("Replay validation failed because stored audit summary relatedCaseType mismatches subcaseType", {
        relatedCaseType: storedAuditSummary.relatedCaseType,
        subcaseType: storedView.subcaseType
      })
    );
  }
  if (storedAuditSummary.relatedCaseId && storedAuditSummary.relatedCaseId !== storedView.subcaseId) {
    return err(
      mismatchError("Replay validation failed because stored audit summary relatedCaseId mismatches subcaseId", {
        relatedCaseId: storedAuditSummary.relatedCaseId,
        subcaseId: storedView.subcaseId
      })
    );
  }
  if (
    storedAuditSummary.context?.arbitration_decision &&
    storedAuditSummary.context.arbitration_decision !== storedView.decision
  ) {
    return err(
      mismatchError(
        "Replay validation failed because stored audit summary arbitration_decision mismatches decision",
        {
          arbitrationDecision: storedAuditSummary.context.arbitration_decision,
          decision: storedView.decision
        }
      )
    );
  }
  if (storedAuditSummary.context?.signal_category && storedAuditSummary.context.signal_category !== storedView.signalCategory) {
    return err(
      mismatchError("Replay validation failed because stored audit summary signal_category mismatches signalCategory", {
        signalCategoryInAudit: storedAuditSummary.context.signal_category,
        signalCategoryInResult: storedView.signalCategory
      })
    );
  }

  const currentAuditSummary = input.currentAuditSummary;
  if (!currentAuditSummary) {
    return ok(input.storedRecord);
  }
  if (
    currentAuditSummary.action !== storedAuditSummary.action ||
    currentAuditSummary.occurredAt !== storedAuditSummary.occurredAt
  ) {
    return err(
      mismatchError("Replay validation failed because stored result conflicts with current audit summary", {
        storedAction: storedAuditSummary.action,
        currentAction: currentAuditSummary.action
      })
    );
  }
  if (
    currentAuditSummary.relatedCaseType !== storedAuditSummary.relatedCaseType ||
    currentAuditSummary.relatedCaseId !== storedAuditSummary.relatedCaseId
  ) {
    return err(
      mismatchError("Replay validation failed because stored/current audit summary related-case fields mismatch", {
        storedRelatedCase: `${storedAuditSummary.relatedCaseType ?? "undefined"}:${storedAuditSummary.relatedCaseId ?? "undefined"}`,
        currentRelatedCase: `${currentAuditSummary.relatedCaseType ?? "undefined"}:${currentAuditSummary.relatedCaseId ?? "undefined"}`
      })
    );
  }
  return ok(input.storedRecord);
};
