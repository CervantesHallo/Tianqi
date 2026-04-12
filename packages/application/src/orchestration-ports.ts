import type { Result } from "@tianqi/shared";
import type { OrchestrationError } from "./orchestration-error.js";

// Ports consumed by the orchestrator. Each port is a contract boundary;
// no infra implementation exists in this layer.

export type RiskCaseView = {
  readonly caseId: string;
  readonly caseType: string;
  readonly state: string;
  readonly stage: string;
  readonly configVersion: string;
  readonly createdAt: string;
};

export type ActivePolicyConfigView = {
  readonly configVersion: string;
  readonly rankingPolicyName: string;
  readonly rankingPolicyVersion: string;
  readonly fundWaterfallPolicyName: string;
  readonly fundWaterfallPolicyVersion: string;
  readonly candidateSelectionPolicyName: string;
  readonly candidateSelectionPolicyVersion: string;
};

export type PolicyBundleExecutionInput = {
  readonly caseId: string;
  readonly caseType: string;
  readonly configVersion: string;
};

export type CandidateSelectionOutcome = {
  readonly selectedCount: number;
  readonly rejectedCount: number;
  readonly summary: string;
};

export type RankingOutcome = {
  readonly rankedCount: number;
  readonly summary: string;
};

export type FundWaterfallOutcome = {
  readonly allocatedCount: number;
  readonly shortfall: boolean;
  readonly summary: string;
};

export type LiquidationCaseView = {
  readonly caseId: string;
  readonly parentRiskCaseId: string;
  readonly state: string;
  readonly stage: string;
  readonly configVersion: string;
  readonly createdAt: string;
};

export type RiskCaseRepositoryPort = {
  loadCase(caseId: string): Result<RiskCaseView | null, OrchestrationError>;
};

export type LiquidationCaseRepositoryPort = {
  loadCase(caseId: string): Result<LiquidationCaseView | null, OrchestrationError>;
};

export type PolicyConfigPort = {
  getActivePolicyConfig(): Result<ActivePolicyConfigView | null, OrchestrationError>;
};

export type PolicyBundlePort = {
  resolveAndDryRun(config: ActivePolicyConfigView): Result<{ readonly bundleSummary: string }, OrchestrationError>;
};

export type StrategyExecutionPort = {
  executeCandidateSelection(input: PolicyBundleExecutionInput): Result<CandidateSelectionOutcome, OrchestrationError>;
  executeRanking(input: PolicyBundleExecutionInput): Result<RankingOutcome, OrchestrationError>;
  executeFundWaterfall(input: PolicyBundleExecutionInput): Result<FundWaterfallOutcome, OrchestrationError>;
};

export type OrchestrationAuditPort = {
  publishAuditEvent(event: import("./risk-case-orchestration-audit-event.js").RiskCaseOrchestrationAuditEvent): Result<void, OrchestrationError>;
};

export type OrchestrationPorts = {
  readonly caseRepository: RiskCaseRepositoryPort;
  readonly liquidationCaseRepository: LiquidationCaseRepositoryPort;
  readonly policyConfig: PolicyConfigPort;
  readonly policyBundle: PolicyBundlePort;
  readonly strategyExecution: StrategyExecutionPort;
  readonly audit: OrchestrationAuditPort;
};
