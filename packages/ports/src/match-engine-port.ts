import type { Result, TraceId } from "@tianqi/shared";

// MatchEnginePort — Tianqi 与撮合引擎（Match）外部服务的抽象接口。
//
// META-RULE A 处置：与 Step 13 / Step 15 一致——Phase 1-7 未冻结此 Port，本 Step
// 作为首次引入。Position 与 Match 是两个独立 Port，源码亦独立——Sprint E 的元规则 F
// 在业务 Engine 之间持续生效。
//
// 业务范围：订单生命周期与成交查询（下单 / 撤单 / 查询订单 / 列出未成交订单 /
// 查询某订单成交记录）。共 5 个业务方法——2 写 + 3 读，覆盖一笔订单从"提交→
// 撮合→成交回报"的完整路径。Adapter 严格"薄层翻译"——撮合策略、价格选择、成交
// 优先级等业务逻辑均由下游撮合引擎承担，本 Port 仅暴露接口形状。

// -- 领域原语（Branded types） ---------------------------------------------------------
type Brand<T, B> = T & { readonly __brand: B };

export type MatchAccountId = Brand<string, "MatchAccountId">;
export type OrderId = Brand<string, "OrderId">;
export type TradeId = Brand<string, "TradeId">;

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit";
export type OrderStatus = "pending" | "partially_filled" | "filled" | "cancelled" | "rejected";

export const createMatchAccountId = (value: string): MatchAccountId => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("MatchAccountId must be a non-empty string");
  }
  return value as MatchAccountId;
};

export const createOrderId = (value: string): OrderId => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("OrderId must be a non-empty string");
  }
  return value as OrderId;
};

export const createTradeId = (value: string): TradeId => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("TradeId must be a non-empty string");
  }
  return value as TradeId;
};

// -- 业务方法请求/响应类型 ------------------------------------------------------------

export type PlaceOrderRequest = {
  readonly accountId: MatchAccountId;
  readonly symbol: string;
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly quantity: number;
  // limit order 必须带 price；market order 应当省略 price——schema 校验由下游负责
  // （本 Adapter 透传 + 严格响应解析；请求侧不做交叉字段校验）。
  readonly price?: number;
  readonly idempotencyKey: string;
  readonly traceId?: TraceId;
};

export type PlaceOrderResponse = {
  readonly orderId: OrderId;
  readonly status: OrderStatus;
  readonly placedAt: string;
};

export type CancelOrderRequest = {
  readonly orderId: OrderId;
  readonly idempotencyKey: string;
  readonly traceId?: TraceId;
};

export type CancelOrderResponse = {
  readonly orderId: OrderId;
  readonly status: OrderStatus;
  readonly cancelledAt: string;
};

export type QueryOrderRequest = {
  readonly orderId: OrderId;
  readonly traceId?: TraceId;
};

export type QueryOrderResponse = {
  readonly orderId: OrderId;
  readonly status: OrderStatus;
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly quantity: number;
  readonly filledQuantity: number;
  readonly remainingQuantity: number;
  readonly queriedAt: string;
};

export type ListActiveOrdersRequest = {
  readonly accountId: MatchAccountId;
  readonly traceId?: TraceId;
};

export type ActiveOrderSummary = {
  readonly orderId: OrderId;
  readonly status: OrderStatus;
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly remainingQuantity: number;
};

export type ListActiveOrdersResponse = {
  readonly accountId: MatchAccountId;
  readonly orders: readonly ActiveOrderSummary[];
  readonly queriedAt: string;
};

export type QueryTradesRequest = {
  readonly orderId: OrderId;
  readonly traceId?: TraceId;
};

export type TradeRecord = {
  readonly tradeId: TradeId;
  readonly orderId: OrderId;
  readonly executedQuantity: number;
  readonly executedPrice: number;
  readonly executedAt: string;
};

export type QueryTradesResponse = {
  readonly orderId: OrderId;
  readonly trades: readonly TradeRecord[];
  readonly queriedAt: string;
};

// -- Port 错误类型 --------------------------------------------------------------------

export type MatchEnginePortErrorCode =
  | "TQ-INF-003"
  | "TQ-INF-004"
  | "TQ-INF-013"
  | "TQ-INF-014"
  | "TQ-INF-015"
  | "TQ-INF-016"
  | "TQ-INF-017"
  | "TQ-INF-018"
  | "TQ-CON-012";

export type MatchEnginePortError = {
  readonly code: MatchEnginePortErrorCode;
  readonly message: string;
  readonly context: Readonly<Record<string, unknown>>;
};

// -- Port 接口 ------------------------------------------------------------------------

export type MatchEnginePort = {
  placeOrder(request: PlaceOrderRequest): Promise<Result<PlaceOrderResponse, MatchEnginePortError>>;
  cancelOrder(
    request: CancelOrderRequest
  ): Promise<Result<CancelOrderResponse, MatchEnginePortError>>;
  queryOrder(request: QueryOrderRequest): Promise<Result<QueryOrderResponse, MatchEnginePortError>>;
  listActiveOrders(
    request: ListActiveOrdersRequest
  ): Promise<Result<ListActiveOrdersResponse, MatchEnginePortError>>;
  queryTrades(
    request: QueryTradesRequest
  ): Promise<Result<QueryTradesResponse, MatchEnginePortError>>;
};
