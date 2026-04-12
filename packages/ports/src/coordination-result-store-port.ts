import type { Result } from "@tianqi/shared";

export type StoredCoordinationAuditRecordSummary = {
  readonly auditId: string;
  readonly caseType: "RiskCase";
  readonly action: string;
  readonly reason: string;
  readonly relatedCaseType?: "LiquidationCase" | "ADLCase";
  readonly relatedCaseId?: string;
  readonly context?: Readonly<Record<string, string>>;
  readonly occurredAt: string;
};

export type StoredRiskCaseCoordinationResult = {
  readonly schemaVersion: string;
  readonly factKey: string;
  readonly riskCaseId: string;
  readonly subcaseType: "LiquidationCase" | "ADLCase";
  readonly subcaseId: string;
  readonly signalCategory: "normal" | "duplicate" | "late" | "replayed";
  readonly decision: "applied" | "deferred" | "rejected" | "ignored" | "duplicate";
  readonly resolutionAction: string;
  readonly beforeState: string;
  readonly afterState: string;
  readonly conflictDetected: boolean;
  readonly hasOtherActiveSubcases: boolean;
  readonly selectedPriority: number;
  readonly auditRecordSummary: StoredCoordinationAuditRecordSummary;
  readonly occurredAt: string;
  readonly sourceCommandPath: "subcase_transition_auto_coordination" | "explicit_coordination_command";
};

export type CoordinationResultStoreLookup =
  | { readonly status: "found"; readonly record: StoredRiskCaseCoordinationResult }
  | { readonly status: "missing" };

export type CoordinationResultStoreError = {
  readonly message: string;
};

export type CoordinationResultStorePort = {
  put(record: StoredRiskCaseCoordinationResult): Promise<Result<void, CoordinationResultStoreError>>;
  getByFactKey(factKey: string): Promise<Result<CoordinationResultStoreLookup, CoordinationResultStoreError>>;
  getLatestByRiskCaseAndSubcase(input: {
    readonly riskCaseId: string;
    readonly subcaseType: "LiquidationCase" | "ADLCase";
    readonly subcaseId: string;
  }): Promise<Result<CoordinationResultStoreLookup, CoordinationResultStoreError>>;
};
