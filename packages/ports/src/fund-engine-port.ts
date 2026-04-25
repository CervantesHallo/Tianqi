import type { Result, TraceId } from "@tianqi/shared";

// FundEnginePort — Tianqi 与外部 Fund 引擎的抽象接口。
//
// META-RULE A 处置留痕：Step 17 指令描述声称"FundEnginePort 在 Phase 1-7 已冻结"，
// 但实地零命中。按 META-RULE A "既有事实胜出"原则，本 Port 作为 Step 17 的一部分
// "首次引入"（连续第六次同病——见 mark-price-engine-port.ts 注释）。
// docs/phase8/17 §B 永久留痕。
//
// 设计要点（与 MarkPrice 纯读 Engine 的差异）：
// Fund 引擎以读为主，含一个弱写方法 `transferFund`（账户间资金划转，依赖幂等键）。
// 4 方法 = 3 读（queryFundBalance / queryFundLedger / queryTransferStatus）+ 1 写
// （transferFund）。这与 Step 15 / 16 操作型 Engine 的"多写多读"形态不同——Fund 引擎
// 只承担"账户余额视图 + 单一划转操作"，更复杂的资金流（如内部账户编排）应当落到
// Application 层，不归 Port 承担。

// -- 领域原语（Branded types） ---------------------------------------------------------
// 4 个 Brand 类型避免与既有 MarginAccountId / MarginCurrency / MarginAmount /
// MarginLockId 在使用层面混淆。Fund 域有自己的 ledger / balance 视图，不与
// Margin 的"已锁定保证金"概念共享标识。

type Brand<T, B> = T & { readonly __brand: B };

export type FundAccountId = Brand<string, "FundAccountId">;
export type FundCurrency = Brand<string, "FundCurrency">;
export type FundAmount = Brand<number, "FundAmount">;
export type TransferId = Brand<string, "TransferId">;

export const createFundAccountId = (value: string): FundAccountId => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("FundAccountId must be a non-empty string");
  }
  return value as FundAccountId;
};

export const createFundCurrency = (value: string): FundCurrency => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("FundCurrency must be a non-empty string");
  }
  return value as FundCurrency;
};

export const createFundAmount = (value: number): FundAmount => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("FundAmount must be a non-negative finite number");
  }
  return value as FundAmount;
};

export const createTransferId = (value: string): TransferId => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("TransferId must be a non-empty string");
  }
  return value as TransferId;
};

// -- 字面量枚举 --------------------------------------------------------------------
// LedgerEntryType 5 值覆盖 Phase 8 资金流水主要触发源。后续 Phase 若新增（如
// "interest" 或 "rebate"），parser 需更新 `LEDGER_ENTRY_TYPES` 数组——这是
// 显式扩展，不是 silent accept。
export type LedgerEntryType = "deposit" | "withdrawal" | "transfer" | "trade" | "fee";

// TransferStatus 3 值——划转的三态生命周期。pending → completed | failed 是
// 不可逆的二选一终态。
export type TransferStatus = "pending" | "completed" | "failed";

// -- 业务方法请求/响应类型 ------------------------------------------------------------

// queryFundBalance：余额三件套（total / available / frozen）一次性返回。**不再单独
// 提供 queryAvailableFund 方法**——已经在 balance 里返回 available 字段，单独方法
// 等于让上游做两次 HTTP 调用拿同一份信息。**克制 > 堆砌**。
export type QueryFundBalanceRequest = {
  readonly accountId: FundAccountId;
  readonly currency: FundCurrency;
  readonly traceId?: TraceId;
};

export type QueryFundBalanceResponse = {
  readonly accountId: FundAccountId;
  readonly currency: FundCurrency;
  readonly totalBalance: FundAmount;
  readonly availableBalance: FundAmount;
  readonly frozenBalance: FundAmount;
  readonly queriedAt: string; // ISO-8601
};

// queryFundLedger：资金流水。limit 可选——下游典型分页边界，默认由下游决定。
// 不引 cursor / since 等分页参数：Phase 8 内 Adapter 只承担"最近 N 条"语义，
// 完整分页查询是 Application 层组合多次 Adapter 调用的责任。
export type QueryFundLedgerRequest = {
  readonly accountId: FundAccountId;
  readonly currency: FundCurrency;
  readonly limit?: number;
  readonly traceId?: TraceId;
};

export type LedgerEntry = {
  readonly entryId: string;
  readonly type: LedgerEntryType;
  readonly amount: FundAmount;
  readonly balanceAfter: FundAmount;
  readonly entryAt: string; // ISO-8601
};

export type QueryFundLedgerResponse = {
  readonly accountId: FundAccountId;
  readonly currency: FundCurrency;
  readonly entries: readonly LedgerEntry[];
  readonly queriedAt: string;
};

// transferFund：账户间资金划转。**唯一的写方法**——依赖 idempotencyKey 防重复。
// 与 Margin / Position / Match 的写方法语义一致（idempotencyKey 必填）。
export type TransferFundRequest = {
  readonly fromAccountId: FundAccountId;
  readonly toAccountId: FundAccountId;
  readonly currency: FundCurrency;
  readonly amount: FundAmount;
  readonly idempotencyKey: string;
  readonly traceId?: TraceId;
};

export type TransferFundResponse = {
  readonly transferId: TransferId;
  readonly status: TransferStatus;
  readonly transferredAt: string; // ISO-8601
};

// queryTransferStatus：查询某次划转当前状态。读路径——天然幂等，调用方可用于
// 在收到 transferFund 不确定结果（超时 / 网络异常）后查清最终状态。
export type QueryTransferStatusRequest = {
  readonly transferId: TransferId;
  readonly traceId?: TraceId;
};

export type QueryTransferStatusResponse = {
  readonly transferId: TransferId;
  readonly status: TransferStatus;
  readonly transferredAt: string;
};

// -- Port 错误类型 --------------------------------------------------------------------

export type FundEnginePortErrorCode =
  | "TQ-INF-003"
  | "TQ-INF-004"
  | "TQ-INF-013"
  | "TQ-INF-014"
  | "TQ-INF-015"
  | "TQ-INF-016"
  | "TQ-INF-017"
  | "TQ-INF-018"
  | "TQ-CON-014";

export type FundEnginePortError = {
  readonly code: FundEnginePortErrorCode;
  readonly message: string;
  readonly context: Readonly<Record<string, unknown>>;
};

// -- Port 接口 ------------------------------------------------------------------------

export type FundEnginePort = {
  queryFundBalance(
    request: QueryFundBalanceRequest
  ): Promise<Result<QueryFundBalanceResponse, FundEnginePortError>>;
  queryFundLedger(
    request: QueryFundLedgerRequest
  ): Promise<Result<QueryFundLedgerResponse, FundEnginePortError>>;
  transferFund(
    request: TransferFundRequest
  ): Promise<Result<TransferFundResponse, FundEnginePortError>>;
  queryTransferStatus(
    request: QueryTransferStatusRequest
  ): Promise<Result<QueryTransferStatusResponse, FundEnginePortError>>;
};
