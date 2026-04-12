import type { CoordinationSignalCategory } from "./risk-case-coordination-signal-ordering.js";
import type { ApplicationError } from "./application-error.js";

export type CoreCaseKind = "RiskCase" | "LiquidationCase" | "ADLCase";
export type CoreSubcaseKind = Exclude<CoreCaseKind, "RiskCase">;

export type CoreCaseView = {
  readonly caseType: CoreCaseKind;
  readonly caseId: string;
  readonly state: string;
  readonly configVersion: number;
  readonly traceId: string;
  readonly sourceRiskCaseId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CoreCaseTransitionView = {
  readonly action: string;
  readonly beforeState: string;
  readonly afterState: string;
  readonly reason: string;
  readonly triggeredBy: "system" | "manual";
  readonly transitionedAt: string;
};

export type CoreCaseAuditRecordView = {
  readonly auditId: string;
  readonly caseType: CoreCaseKind;
  readonly caseId: string;
  readonly action: string;
  readonly beforeState: string;
  readonly afterState: string;
  readonly reason: string;
  readonly traceId: string;
  readonly occurredAt: string;
  readonly relatedCaseType?: CoreCaseKind;
  readonly relatedCaseId?: string;
  readonly context?: Readonly<Record<string, string>>;
};

export type CoreCaseConsistencyCheckView = {
  readonly passed: boolean;
  readonly rule: string;
  readonly detail: string;
};

export type CoreCaseLinkageView = {
  readonly riskCaseId: string;
  readonly derivedCaseId?: string;
  readonly consistencyChecks: readonly CoreCaseConsistencyCheckView[];
};

export type CoreCaseResolutionView = {
  readonly subcaseType: CoreSubcaseKind;
  readonly subcaseId: string;
  readonly subcaseTerminalState: string;
  readonly action: string;
  readonly riskCaseId: string;
  readonly beforeState: string;
  readonly afterState: string;
  readonly riskCaseTransitionApplied: boolean;
  readonly decision: "applied" | "deferred" | "rejected" | "ignored" | "duplicate";
  readonly hasOtherSubcases: boolean;
  readonly hasOtherActiveSubcases: boolean;
  readonly conflictDetected: boolean;
  readonly selectedPriority: number;
  readonly arbitrationRule: string;
  readonly signalCategory: CoordinationSignalCategory;
  readonly signalReason: string;
  readonly signalOccurredAt: string;
  readonly subcaseLastUpdatedAt: string;
  readonly riskCaseLastUpdatedAt: string;
};

type CoreCaseFlowSuccessResult = {
  readonly success: true;
  readonly caseView: CoreCaseView;
  readonly linkage: CoreCaseLinkageView;
  readonly transition?: CoreCaseTransitionView;
  readonly resolution?: CoreCaseResolutionView;
  readonly auditRecords: readonly CoreCaseAuditRecordView[];
};

type CoreCaseFlowFailureResult = {
  readonly success: false;
  readonly caseType: CoreCaseKind;
  readonly operation: "create" | "transition" | "coordinate";
  readonly error: ApplicationError;
};

export type CoreCaseFlowResult = CoreCaseFlowSuccessResult | CoreCaseFlowFailureResult;
