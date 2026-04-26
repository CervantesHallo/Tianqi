export type {
  AdapterFoundation,
  AdapterHealthCheck,
  AdapterHealthDetails,
  AdapterHealthDetailValue,
  AdapterHealthStatus,
  AdapterIdentity,
  AdapterLifecycle
} from "./adapter-foundation.js";
export type { ADLCaseRepositoryError, ADLCaseRepositoryPort } from "./adl-case-repository-port.js";
export type {
  AuditEventRecord,
  AuditEventSinkError,
  AuditEventSinkPort
} from "./audit-event-sink-port.js";
export type {
  CompensationRecordLookup,
  CompensationRecordQuery,
  CompensationRecordStoreError,
  CompensationRecordStorePort,
  StoredCompensationRecord
} from "./compensation-record-store-port.js";
export type {
  CompensationMutationOutcome,
  CompensationMutationRequest,
  CompensationMutationStoreError,
  CompensationRecordMutationPort,
  MutatedCompensationRecord
} from "./compensation-record-mutation-port.js";
export type {
  CommandResultLookup,
  CommandResultStoreError,
  CommandResultStorePort,
  StoredApplicationEventRecord,
  StoredApplicationProcessingStatus,
  StoredApplicationRiskCaseView,
  StoredApplicationTransitionView,
  StoredCommandResultSnapshot,
  StoredCompensationMarker
} from "./command-result-store-port.js";
export type { ConfigPort, ConfigPortError, RuntimeConfig } from "./config-port.js";
export type {
  DiagnosticAlertSuppressionRepairCommandOutcome,
  DiagnosticAlertSuppressionRepairCommandRecordStoreError,
  DiagnosticAlertSuppressionRepairCommandRecordStoreLookup,
  DiagnosticAlertSuppressionRepairCommandRecordStorePort,
  DiagnosticAlertSuppressionRepairCommandType,
  StoredDiagnosticAlertSuppressionRepairCommandRecord
} from "./diagnostic-alert-suppression-repair-command-record-store-port.js";
export type {
  DiagnosticAlertSuppressionStateRepairLifecycleStoreError,
  DiagnosticAlertSuppressionStateRepairLifecycleStoreLookup,
  DiagnosticAlertSuppressionStateRepairLifecycleStorePort,
  StoredDiagnosticAlertSuppressionStateRepairLifecycle,
  StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot
} from "./diagnostic-alert-suppression-repair-lifecycle-store-port.js";
export type {
  DiagnosticAlertSuppressionStoreError,
  DiagnosticAlertSuppressionStoreLookup,
  DiagnosticAlertSuppressionStorePort,
  StoredDiagnosticAlertSuppressionState
} from "./diagnostic-alert-suppression-store-port.js";
export type {
  DomainEventPublisherError,
  DomainEventPublisherPort
} from "./domain-event-publisher-port.js";
export type { EventStorePort, EventStoreWriteError } from "./event-store-port.js";
export type {
  CoordinationDiagnosticHistoryStoreError,
  CoordinationDiagnosticHistoryStoreLookup,
  CoordinationDiagnosticHistoryStorePort,
  StoredCoordinationDiagnosticHistorySlot,
  StoredCoordinationDiagnosticResultSnapshot
} from "./coordination-diagnostic-history-store-port.js";
export type {
  CoordinationMetricsObservationRecord,
  CoordinationMetricsSinkError,
  CoordinationMetricsSinkPort
} from "./coordination-metrics-sink-port.js";
export type {
  CoordinationResultStoreError,
  CoordinationResultStoreLookup,
  CoordinationResultStorePort,
  StoredCoordinationAuditRecordSummary,
  StoredRiskCaseCoordinationResult
} from "./coordination-result-store-port.js";
export type {
  IdempotencyPort,
  IdempotencyPortError,
  IdempotencyReservation
} from "./idempotency-port.js";
export type {
  LiquidationCaseRepositoryError,
  LiquidationCaseRepositoryPort
} from "./liquidation-case-repository-port.js";
export type {
  CalculateMarginRequest,
  CalculateMarginResponse,
  LockMarginRequest,
  LockMarginResponse,
  MarginAccountId,
  MarginAmount,
  MarginCurrency,
  MarginEnginePort,
  MarginEnginePortError,
  MarginEnginePortErrorCode,
  MarginLockId,
  QueryMarginBalanceRequest,
  QueryMarginBalanceResponse,
  ReleaseMarginRequest,
  ReleaseMarginResponse
} from "./margin-engine-port.js";
export {
  createMarginAccountId,
  createMarginAmount,
  createMarginCurrency,
  createMarginLockId
} from "./margin-engine-port.js";
export type {
  FundAccountId,
  FundAmount,
  FundCurrency,
  FundEnginePort,
  FundEnginePortError,
  FundEnginePortErrorCode,
  LedgerEntry,
  LedgerEntryType,
  QueryFundBalanceRequest,
  QueryFundBalanceResponse,
  QueryFundLedgerRequest,
  QueryFundLedgerResponse,
  QueryTransferStatusRequest,
  QueryTransferStatusResponse,
  TransferFundRequest,
  TransferFundResponse,
  TransferId,
  TransferStatus
} from "./fund-engine-port.js";
export {
  createFundAccountId,
  createFundAmount,
  createFundCurrency,
  createTransferId
} from "./fund-engine-port.js";
export type {
  FundingRateValue,
  MarkPriceEnginePort,
  MarkPriceEnginePortError,
  MarkPriceEnginePortErrorCode,
  MarkPriceQuote,
  MarkPriceValue,
  QueryFundingRateRequest,
  QueryFundingRateResponse,
  QueryMarkPriceBatchRequest,
  QueryMarkPriceBatchResponse,
  QueryMarkPriceRequest,
  QueryMarkPriceResponse
} from "./mark-price-engine-port.js";
export { createFundingRateValue, createMarkPriceValue } from "./mark-price-engine-port.js";
export type {
  ActiveOrderSummary,
  CancelOrderRequest,
  CancelOrderResponse,
  ListActiveOrdersRequest,
  ListActiveOrdersResponse,
  MatchAccountId,
  MatchEnginePort,
  MatchEnginePortError,
  MatchEnginePortErrorCode,
  OrderId,
  OrderSide,
  OrderStatus,
  OrderType,
  PlaceOrderRequest,
  PlaceOrderResponse,
  QueryOrderRequest,
  QueryOrderResponse,
  QueryTradesRequest,
  QueryTradesResponse,
  TradeId,
  TradeRecord
} from "./match-engine-port.js";
export { createMatchAccountId, createOrderId, createTradeId } from "./match-engine-port.js";
export type {
  AdjustPositionRequest,
  AdjustPositionResponse,
  ClosePositionRequest,
  ClosePositionResponse,
  ListOpenPositionsRequest,
  ListOpenPositionsResponse,
  OpenPositionRequest,
  OpenPositionResponse,
  OpenPositionSummary,
  PositionAccountId,
  PositionEnginePort,
  PositionEnginePortError,
  PositionEnginePortErrorCode,
  PositionId,
  PositionSide,
  PositionSize,
  QueryPositionRequest,
  QueryPositionResponse
} from "./position-engine-port.js";
export {
  createPositionAccountId,
  createPositionId,
  createPositionSize
} from "./position-engine-port.js";
export type {
  MetricsProjectionRecord,
  MetricsSinkError,
  MetricsSinkPort
} from "./metrics-sink-port.js";
export type {
  SinkFailureRecoveryAppendOutcome,
  SinkFailureRecoveryLookup,
  SinkFailureRecoveryRecord,
  SinkFailureRecoveryRecordStatus,
  SinkFailureRecoveryStoreError,
  SinkFailureRecoveryStorePort
} from "./sink-failure-recovery-store-port.js";
export type {
  NotificationMessage,
  NotificationPort,
  NotificationPortError
} from "./notification-port.js";
export type {
  RiskCaseRepositoryError,
  RiskCaseRepositoryPort
} from "./risk-case-repository-port.js";
// Phase 9 / Step 1 — SagaPort 类型契约（Saga 编排骨架的"输入端"）。
// 本 Step 仅引入类型与 Brand 工厂；不引入运行能力（Step 6 起在 application 层落地）。
export type {
  CorrelationId,
  SagaCompensationContext,
  SagaContext,
  SagaId,
  SagaInvocation,
  SagaPortError,
  SagaResult,
  SagaResultStatus,
  SagaStep,
  SagaStepExecution,
  SagaStepStatus,
  SagaStepStatusSnapshot
} from "./saga-port.js";
export { createCorrelationId, createSagaId } from "./saga-port.js";
// Phase 9 / Step 3 — SagaStateStorePort 持久化契约（Saga 状态崩溃恢复用）。
// 本 Step 仅引入类型；运行能力由 saga-state-store-memory + saga-state-store-postgres
// Adapter 落地。
export type {
  PersistedCompensationEntry,
  PersistedSagaState,
  PersistedSagaStateOverallStatus,
  SagaStateStoreError,
  SagaStateStorePort
} from "./saga-state-store-port.js";
