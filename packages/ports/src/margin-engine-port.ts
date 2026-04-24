import type { Result, TraceId } from "@tianqi/shared";

// MarginEnginePort — Tianqi 与 Margin 外部引擎的抽象接口。
//
// META-RULE A 处置留痕：Step 15 指令描述声称"MarginEnginePort 在 Phase 1-7 已冻结"，
// 但实地 `ls packages/ports/src/` 零命中。按 META-RULE A "既有事实胜出"原则，本 Port
// 作为 Step 15 的一部分"首次引入"（不是"修改"），与 Step 13 的
// TestkitExternalEngineFoundation 精神一致——因为实际资产不存在，指令描述中"不得修改"
// 的对象事实上不存在，引入新的 Port 不违反"签名冻结"约束。docs/phase8/15 §C 永久留痕。
//
// Sprint E 剩余 Step（16-17）为 Position / Match / MarkPrice / Fund 引入各自 Port
// 时将遵循同样模式：各自新建 `<engine>-engine-port.ts` 于 `packages/ports/src/`。

// -- 领域原语（Branded types） ---------------------------------------------------------
// 这些 brand 类型限定在 Margin 语境，不与其他 Engine 复用。Step 16-17 的业务 Engine
// 定义各自品牌（PositionId / MatchId / MarkPrice 等）。

type Brand<T, B> = T & { readonly __brand: B };

export type MarginAccountId = Brand<string, "MarginAccountId">;
export type MarginCurrency = Brand<string, "MarginCurrency">;
export type MarginLockId = Brand<string, "MarginLockId">;
export type MarginAmount = Brand<number, "MarginAmount">;

// 非分支 brand 构造器：仅运行时基本校验，不承担业务规则。
export const createMarginAccountId = (value: string): MarginAccountId => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("MarginAccountId must be a non-empty string");
  }
  return value as MarginAccountId;
};

export const createMarginCurrency = (value: string): MarginCurrency => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("MarginCurrency must be a non-empty string");
  }
  return value as MarginCurrency;
};

export const createMarginLockId = (value: string): MarginLockId => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("MarginLockId must be a non-empty string");
  }
  return value as MarginLockId;
};

export const createMarginAmount = (value: number): MarginAmount => {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new Error("MarginAmount must be a non-negative finite number");
  }
  return value as MarginAmount;
};

// -- 业务方法请求/响应类型 ------------------------------------------------------------

export type CalculateMarginRequest = {
  readonly accountId: MarginAccountId;
  readonly symbol: string;
  readonly side: "buy" | "sell";
  readonly quantity: number;
  readonly price: number;
  readonly traceId?: TraceId;
};

export type CalculateMarginResponse = {
  readonly requiredMargin: MarginAmount;
  readonly currency: MarginCurrency;
  readonly calculatedAt: string; // ISO-8601
};

export type LockMarginRequest = {
  readonly accountId: MarginAccountId;
  readonly amount: MarginAmount;
  readonly currency: MarginCurrency;
  // 调用方必须保证幂等键唯一；Adapter 把它透传给下游——Adapter 不重试时不做幂等
  // 保护（基座重试是幂等假设下的行为；调用方保证幂等键则重试安全）。
  readonly idempotencyKey: string;
  readonly traceId?: TraceId;
};

export type LockMarginResponse = {
  readonly lockId: MarginLockId;
  readonly lockedAmount: MarginAmount;
  readonly currency: MarginCurrency;
  readonly lockedAt: string;
};

export type ReleaseMarginRequest = {
  readonly lockId: MarginLockId;
  readonly idempotencyKey: string;
  readonly traceId?: TraceId;
};

export type ReleaseMarginResponse = {
  readonly lockId: MarginLockId;
  readonly releasedAmount: MarginAmount;
  readonly releasedAt: string;
};

export type QueryMarginBalanceRequest = {
  readonly accountId: MarginAccountId;
  readonly currency: MarginCurrency;
  readonly traceId?: TraceId;
};

export type QueryMarginBalanceResponse = {
  readonly accountId: MarginAccountId;
  readonly currency: MarginCurrency;
  readonly availableMargin: MarginAmount;
  readonly lockedMargin: MarginAmount;
  readonly totalMargin: MarginAmount;
  readonly queriedAt: string;
};

// -- Port 错误类型 --------------------------------------------------------------------
// code 字段是领域 moniker 字符串（与 TQ-INF-013 至 018 的常量严格对齐），
// context 字段承载诊断字段（按 §6.5 领域摘要转译纪律，永不含 raw HTTP status 或
// 底层 socket error name）。

export type MarginEnginePortErrorCode =
  | "TQ-INF-003"
  | "TQ-INF-004"
  | "TQ-INF-013"
  | "TQ-INF-014"
  | "TQ-INF-015"
  | "TQ-INF-016"
  | "TQ-INF-017"
  | "TQ-INF-018"
  | "TQ-CON-010";

export type MarginEnginePortError = {
  readonly code: MarginEnginePortErrorCode;
  readonly message: string;
  readonly context: Readonly<Record<string, unknown>>;
};

// -- Port 接口 ------------------------------------------------------------------------

export type MarginEnginePort = {
  calculateMargin(
    request: CalculateMarginRequest
  ): Promise<Result<CalculateMarginResponse, MarginEnginePortError>>;
  lockMargin(
    request: LockMarginRequest
  ): Promise<Result<LockMarginResponse, MarginEnginePortError>>;
  releaseMargin(
    request: ReleaseMarginRequest
  ): Promise<Result<ReleaseMarginResponse, MarginEnginePortError>>;
  queryMarginBalance(
    request: QueryMarginBalanceRequest
  ): Promise<Result<QueryMarginBalanceResponse, MarginEnginePortError>>;
};
