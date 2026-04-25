import type { Result, TraceId } from "@tianqi/shared";

// MarkPriceEnginePort — Tianqi 与外部 MarkPrice 引擎的抽象接口。
//
// META-RULE A 处置留痕：Step 17 指令描述声称"MarkPriceEnginePort 在 Phase 1-7
// 已冻结"，但实地 `ls packages/ports/src/` 零命中。按 META-RULE A "既有事实胜出"
// 原则，本 Port 作为 Step 17 的一部分"首次引入"——与 Step 13（无 ExternalEnginePort）
// / Step 15（无 MarginEnginePort）/ Step 16（无 PositionEnginePort / MatchEnginePort）
// 第五次同病；本仓库 packages/ports/src/ 在 Phase 1-7 内**完全没有任何 Engine Port**。
// 与前四次同样处置：实际资产不存在则首次引入，不触犯签名冻结约束。
// docs/phase8/17 §B 永久留痕。
//
// 设计要点（与 Step 15 / 16 操作型 Engine 的差异）：
// MarkPrice 是**纯读引擎**——无写方法、无幂等键。所有方法均为天然幂等读，
// 调用方无需提供 idempotencyKey。这是本 Step 与前两 Step 业务语义层面的关键差异。
// 读取型 Engine 在熔断 open 时的运维语义：上游决策可能被迫使用陈旧价格，
// 风控算法应当对此显式做出降级判断（见 docs/phase8/17 §E 风险点）。

// -- 领域原语（Branded types） ---------------------------------------------------------
// MarkPriceValue 与 FundingRateValue 区分品牌：标记价必须 > 0（零意味着标的不存在），
// 资金费率可为负（多空力量博弈的体现），两者数值域语义完全不同。

type Brand<T, B> = T & { readonly __brand: B };

export type MarkPriceValue = Brand<number, "MarkPriceValue">;
export type FundingRateValue = Brand<number, "FundingRateValue">;

export const createMarkPriceValue = (value: number): MarkPriceValue => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    // > 0 严格——零或负的"标记价"在加密资产语境里没有合法解释。
    throw new Error("MarkPriceValue must be a positive finite number");
  }
  return value as MarkPriceValue;
};

export const createFundingRateValue = (value: number): FundingRateValue => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("FundingRateValue must be a finite number");
  }
  return value as FundingRateValue;
};

// -- 业务方法请求/响应类型 ------------------------------------------------------------

// MarkPrice 单点查询：给定 symbol 返回当前标记价。
// symbol 保留 plain string（与 Position / Match 的 symbol 字段处理一致）——symbol
// 是跨域共享原语而非 MarkPrice 域专属，加 Brand 反而会让上游每次调用都需转换。
export type QueryMarkPriceRequest = {
  readonly symbol: string;
  readonly traceId?: TraceId;
};

export type QueryMarkPriceResponse = {
  readonly symbol: string;
  readonly markPrice: MarkPriceValue;
  readonly queriedAt: string; // ISO-8601
};

// 批量查询：调用方一次拿多个 symbol，下游通常做内部缓存优化。Adapter 不替下游决定
// 批量阈值（这是下游运维的 capacity planning 范畴，不是 Port 的责任）。
export type QueryMarkPriceBatchRequest = {
  readonly symbols: readonly string[];
  readonly traceId?: TraceId;
};

export type MarkPriceQuote = {
  readonly symbol: string;
  readonly markPrice: MarkPriceValue;
};

export type QueryMarkPriceBatchResponse = {
  readonly prices: readonly MarkPriceQuote[];
  readonly queriedAt: string;
};

// FundingRate 是永续合约特有的周期性结算指标，与 MarkPrice 紧密相关但读路径独立。
// fundingTime 是下一次结算时间——风控算法需要这个字段决定是否在结算窗口前后调整持仓。
export type QueryFundingRateRequest = {
  readonly symbol: string;
  readonly traceId?: TraceId;
};

export type QueryFundingRateResponse = {
  readonly symbol: string;
  readonly fundingRate: FundingRateValue;
  readonly fundingTime: string; // ISO-8601 — 下一次结算时间点
  readonly queriedAt: string;
};

// -- Port 错误类型 --------------------------------------------------------------------

export type MarkPriceEnginePortErrorCode =
  | "TQ-INF-003"
  | "TQ-INF-004"
  | "TQ-INF-013"
  | "TQ-INF-014"
  | "TQ-INF-015"
  | "TQ-INF-016"
  | "TQ-INF-017"
  | "TQ-INF-018"
  | "TQ-CON-013";

export type MarkPriceEnginePortError = {
  readonly code: MarkPriceEnginePortErrorCode;
  readonly message: string;
  readonly context: Readonly<Record<string, unknown>>;
};

// -- Port 接口 ------------------------------------------------------------------------

export type MarkPriceEnginePort = {
  queryMarkPrice(
    request: QueryMarkPriceRequest
  ): Promise<Result<QueryMarkPriceResponse, MarkPriceEnginePortError>>;
  queryMarkPriceBatch(
    request: QueryMarkPriceBatchRequest
  ): Promise<Result<QueryMarkPriceBatchResponse, MarkPriceEnginePortError>>;
  queryFundingRate(
    request: QueryFundingRateRequest
  ): Promise<Result<QueryFundingRateResponse, MarkPriceEnginePortError>>;
};
