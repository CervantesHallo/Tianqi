import type { AuditId, Result, TraceId } from "@tianqi/shared";
import { createAuditId, err, ok } from "@tianqi/shared";

import { domainValidationError } from "./domain-error.js";
import type { DomainError } from "./domain-error.js";

export const CORE_CASE_AUDIT_TYPES = {
  RiskCase: "RiskCase",
  LiquidationCase: "LiquidationCase",
  ADLCase: "ADLCase"
} as const;

export type CoreCaseAuditType = (typeof CORE_CASE_AUDIT_TYPES)[keyof typeof CORE_CASE_AUDIT_TYPES];

export type CaseAuditRecord = {
  readonly auditId: AuditId;
  readonly caseType: CoreCaseAuditType;
  readonly caseId: string;
  readonly action: string;
  readonly beforeState: string;
  readonly afterState: string;
  readonly reason: string;
  readonly traceId: TraceId;
  readonly occurredAt: Date;
  readonly relatedCaseType?: CoreCaseAuditType;
  readonly relatedCaseId?: string;
  readonly context?: Readonly<Record<string, string>>;
};

export type CreateCaseAuditRecordInput = {
  readonly caseType: CoreCaseAuditType;
  readonly caseId: string;
  readonly action: string;
  readonly beforeState: string;
  readonly afterState: string;
  readonly reason: string;
  readonly traceId: TraceId;
  readonly occurredAt: Date;
  readonly relatedCaseType?: CoreCaseAuditType;
  readonly relatedCaseId?: string;
  readonly context?: Readonly<Record<string, string>>;
};

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

const cloneDate = (value: Date): Date => new Date(value.getTime());

const buildAuditId = (input: CreateCaseAuditRecordInput): AuditId =>
  createAuditId(`${input.caseType}:${input.caseId}:${input.action}:${input.occurredAt.toISOString()}`);

export const createCaseAuditRecord = (
  input: CreateCaseAuditRecordInput
): Result<CaseAuditRecord, DomainError> => {
  if (input.caseId.trim().length === 0) {
    return err(
      domainValidationError("CaseAuditRecord.caseId must be non-empty", {
        caseType: input.caseType
      })
    );
  }
  if (input.action.trim().length === 0) {
    return err(
      domainValidationError("CaseAuditRecord.action must be non-empty", {
        caseType: input.caseType,
        caseId: input.caseId
      })
    );
  }
  if (input.reason.trim().length === 0) {
    return err(
      domainValidationError("CaseAuditRecord.reason must be non-empty", {
        caseType: input.caseType,
        caseId: input.caseId,
        action: input.action
      })
    );
  }
  if (input.relatedCaseType && !input.relatedCaseId) {
    return err(
      domainValidationError("CaseAuditRecord.relatedCaseId is required with relatedCaseType", {
        caseType: input.caseType,
        caseId: input.caseId,
        action: input.action
      })
    );
  }
  if (input.relatedCaseId && input.relatedCaseId.trim().length === 0) {
    return err(
      domainValidationError("CaseAuditRecord.relatedCaseId must be non-empty when provided", {
        caseType: input.caseType,
        caseId: input.caseId,
        action: input.action
      })
    );
  }
  if (input.relatedCaseId && !input.relatedCaseType) {
    return err(
      domainValidationError("CaseAuditRecord.relatedCaseType is required with relatedCaseId", {
        caseType: input.caseType,
        caseId: input.caseId,
        action: input.action
      })
    );
  }
  if (!isValidDate(input.occurredAt)) {
    return err(
      domainValidationError("CaseAuditRecord.occurredAt must be a valid Date", {
        occurredAt: input.occurredAt.toString()
      })
    );
  }
  if (input.context) {
    for (const [key, value] of Object.entries(input.context)) {
      if (key.trim().length === 0) {
        return err(
          domainValidationError("CaseAuditRecord.context key must be non-empty", {
            caseType: input.caseType,
            caseId: input.caseId
          })
        );
      }
      if (value.trim().length === 0) {
        return err(
          domainValidationError("CaseAuditRecord.context value must be non-empty", {
            caseType: input.caseType,
            caseId: input.caseId,
            key
          })
        );
      }
    }
  }

  return ok({
    auditId: buildAuditId(input),
    caseType: input.caseType,
    caseId: input.caseId,
    action: input.action,
    beforeState: input.beforeState,
    afterState: input.afterState,
    reason: input.reason.trim(),
    traceId: input.traceId,
    occurredAt: cloneDate(input.occurredAt),
    ...(input.relatedCaseType ? { relatedCaseType: input.relatedCaseType } : {}),
    ...(input.relatedCaseId ? { relatedCaseId: input.relatedCaseId.trim() } : {}),
    ...(input.context ? { context: { ...input.context } } : {})
  });
};
