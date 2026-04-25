import {
  createHttpBaseEngine,
  type HttpBaseCallRequest,
  type HttpBaseEngineAdapter,
  type HttpBaseEngineError,
  type HttpBaseEngineOptions,
  type HttpCallResponse
} from "@tianqi/external-engine-http-base";
import type { AdapterHealthStatus } from "@tianqi/ports";
import type {
  ActiveOrderSummary,
  CancelOrderRequest,
  CancelOrderResponse,
  ListActiveOrdersRequest,
  ListActiveOrdersResponse,
  MatchAccountId,
  MatchEnginePort,
  MatchEnginePortError,
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
} from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { Result, TraceId } from "@tianqi/shared";

// MatchEngineHttp — Sprint E 第三个业务 Engine Adapter（Step 16），与
// @tianqi/position-engine-http 同步落地但**独立写出**。两个 Adapter 之间无任何
// import / 共享 helper（META-RULE F 在业务 Engine 之间硬约束）；结构同构是模板复
// 用的结果，不是代码复制的副作用。
//
// META-RULE O 消费方纪律继承 Step 15 / 16 position 的全部纪律：Options 透传 / 仅
// 公开导出 import / 业务层 0 稳定性逻辑 / 不 import sibling business engine。

export type MatchEngineHttpOptions = HttpBaseEngineOptions & {
  // 撮合引擎 future hooks（订单簿镜像、成交流订阅等）若 Step 16 之后扩展，会落到
  // 这里。当前版本字段为空。
};

type ExternalEngineContractProbeSurface = {
  readonly __externalEngineProbe: true;
  getCircuitBreakerState(): ReturnType<HttpBaseEngineAdapter["getCircuitBreakerState"]>;
  getCurrentConcurrency(): number;
  getPeakConcurrency(): number;
  getLastTraceId(): TraceId | null;
  getRetryStats(): ReturnType<HttpBaseEngineAdapter["getRetryStats"]>;
  getLastCircuitTransitionAt(): string | null;
};

export type MatchEngineHttpAdapter = MatchEnginePort &
  ExternalEngineContractProbeSurface & {
    readonly adapterName: "match-engine-http";
    init(): Promise<void>;
    shutdown(): Promise<void>;
    healthCheck(): Promise<AdapterHealthStatus>;
    call(
      request: HttpBaseCallRequest,
      traceId?: TraceId
    ): Promise<Result<HttpCallResponse, HttpBaseEngineError>>;
  };

// -- Response parsers ---------------------------------------------------------------

const isIsoTimestamp = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  if (Number.isNaN(Date.parse(value))) return false;
  return /T/.test(value) && /(Z|[+-]\d{2}:?\d{2})$/.test(value);
};

const buildSchemaError = (
  operation: string,
  fieldPath: string,
  reason: string
): MatchEnginePortError => ({
  code: "TQ-CON-012",
  message: `TQ-CON-012: ${operation} response ${fieldPath} ${reason}`,
  context: {
    adapterName: "match-engine-http",
    operation,
    fieldPath,
    reason
  }
});

const parseJsonBody = (
  operation: string,
  body: string
): Result<Record<string, unknown>, MatchEnginePortError> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return err(buildSchemaError(operation, "body", "not_json"));
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return err(buildSchemaError(operation, "body", "not_object"));
  }
  return ok(parsed as Record<string, unknown>);
};

const requireString = (
  operation: string,
  fieldPath: string,
  value: unknown
): Result<string, MatchEnginePortError> => {
  if (typeof value !== "string" || value.length === 0) {
    return err(buildSchemaError(operation, fieldPath, "missing_or_non_string"));
  }
  return ok(value);
};

const requireNonNegativeNumber = (
  operation: string,
  fieldPath: string,
  value: unknown
): Result<number, MatchEnginePortError> => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return err(buildSchemaError(operation, fieldPath, "missing_or_negative_number"));
  }
  return ok(value);
};

const requireIsoTimestamp = (
  operation: string,
  fieldPath: string,
  value: unknown
): Result<string, MatchEnginePortError> => {
  if (!isIsoTimestamp(value)) {
    return err(buildSchemaError(operation, fieldPath, "invalid_timestamp"));
  }
  return ok(value);
};

const ORDER_SIDES: readonly OrderSide[] = ["buy", "sell"];
const ORDER_TYPES: readonly OrderType[] = ["market", "limit"];
const ORDER_STATUSES: readonly OrderStatus[] = [
  "pending",
  "partially_filled",
  "filled",
  "cancelled",
  "rejected"
];

const requireOrderSide = (
  operation: string,
  fieldPath: string,
  value: unknown
): Result<OrderSide, MatchEnginePortError> => {
  if (typeof value !== "string" || !ORDER_SIDES.includes(value as OrderSide)) {
    return err(buildSchemaError(operation, fieldPath, "side_must_be_buy_or_sell"));
  }
  return ok(value as OrderSide);
};

const requireOrderType = (
  operation: string,
  fieldPath: string,
  value: unknown
): Result<OrderType, MatchEnginePortError> => {
  if (typeof value !== "string" || !ORDER_TYPES.includes(value as OrderType)) {
    return err(buildSchemaError(operation, fieldPath, "type_must_be_market_or_limit"));
  }
  return ok(value as OrderType);
};

const requireOrderStatus = (
  operation: string,
  fieldPath: string,
  value: unknown
): Result<OrderStatus, MatchEnginePortError> => {
  if (typeof value !== "string" || !ORDER_STATUSES.includes(value as OrderStatus)) {
    return err(buildSchemaError(operation, fieldPath, "status_unknown"));
  }
  return ok(value as OrderStatus);
};

const parsePlaceOrderResponse = (
  body: string
): Result<PlaceOrderResponse, MatchEnginePortError> => {
  const parsed = parseJsonBody("place-order", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const orderId = requireString("place-order", "orderId", root["orderId"]);
  if (!orderId.ok) return err(orderId.error);
  const status = requireOrderStatus("place-order", "status", root["status"]);
  if (!status.ok) return err(status.error);
  const placedAt = requireIsoTimestamp("place-order", "placedAt", root["placedAt"]);
  if (!placedAt.ok) return err(placedAt.error);
  return ok({
    orderId: orderId.value as OrderId,
    status: status.value,
    placedAt: placedAt.value
  });
};

const parseCancelOrderResponse = (
  body: string
): Result<CancelOrderResponse, MatchEnginePortError> => {
  const parsed = parseJsonBody("cancel-order", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const orderId = requireString("cancel-order", "orderId", root["orderId"]);
  if (!orderId.ok) return err(orderId.error);
  const status = requireOrderStatus("cancel-order", "status", root["status"]);
  if (!status.ok) return err(status.error);
  const cancelledAt = requireIsoTimestamp("cancel-order", "cancelledAt", root["cancelledAt"]);
  if (!cancelledAt.ok) return err(cancelledAt.error);
  return ok({
    orderId: orderId.value as OrderId,
    status: status.value,
    cancelledAt: cancelledAt.value
  });
};

const parseQueryOrderResponse = (
  body: string
): Result<QueryOrderResponse, MatchEnginePortError> => {
  const parsed = parseJsonBody("query-order", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const orderId = requireString("query-order", "orderId", root["orderId"]);
  if (!orderId.ok) return err(orderId.error);
  const status = requireOrderStatus("query-order", "status", root["status"]);
  if (!status.ok) return err(status.error);
  const side = requireOrderSide("query-order", "side", root["side"]);
  if (!side.ok) return err(side.error);
  const type = requireOrderType("query-order", "type", root["type"]);
  if (!type.ok) return err(type.error);
  const quantity = requireNonNegativeNumber("query-order", "quantity", root["quantity"]);
  if (!quantity.ok) return err(quantity.error);
  const filled = requireNonNegativeNumber("query-order", "filledQuantity", root["filledQuantity"]);
  if (!filled.ok) return err(filled.error);
  const remaining = requireNonNegativeNumber(
    "query-order",
    "remainingQuantity",
    root["remainingQuantity"]
  );
  if (!remaining.ok) return err(remaining.error);
  const queriedAt = requireIsoTimestamp("query-order", "queriedAt", root["queriedAt"]);
  if (!queriedAt.ok) return err(queriedAt.error);
  return ok({
    orderId: orderId.value as OrderId,
    status: status.value,
    side: side.value,
    type: type.value,
    quantity: quantity.value,
    filledQuantity: filled.value,
    remainingQuantity: remaining.value,
    queriedAt: queriedAt.value
  });
};

const parseListActiveOrdersResponse = (
  body: string
): Result<ListActiveOrdersResponse, MatchEnginePortError> => {
  const parsed = parseJsonBody("list-active-orders", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const accountId = requireString("list-active-orders", "accountId", root["accountId"]);
  if (!accountId.ok) return err(accountId.error);
  const queriedAt = requireIsoTimestamp("list-active-orders", "queriedAt", root["queriedAt"]);
  if (!queriedAt.ok) return err(queriedAt.error);
  const rawOrders = root["orders"];
  if (!Array.isArray(rawOrders)) {
    return err(buildSchemaError("list-active-orders", "orders", "must_be_array"));
  }
  const orders: ActiveOrderSummary[] = [];
  for (let i = 0; i < rawOrders.length; i += 1) {
    const item = rawOrders[i] as Record<string, unknown>;
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return err(buildSchemaError("list-active-orders", `orders[${i}]`, "not_object"));
    }
    const itemOrderId = requireString(
      "list-active-orders",
      `orders[${i}].orderId`,
      item["orderId"]
    );
    if (!itemOrderId.ok) return err(itemOrderId.error);
    const itemStatus = requireOrderStatus(
      "list-active-orders",
      `orders[${i}].status`,
      item["status"]
    );
    if (!itemStatus.ok) return err(itemStatus.error);
    const itemSide = requireOrderSide("list-active-orders", `orders[${i}].side`, item["side"]);
    if (!itemSide.ok) return err(itemSide.error);
    const itemType = requireOrderType("list-active-orders", `orders[${i}].type`, item["type"]);
    if (!itemType.ok) return err(itemType.error);
    const itemRemaining = requireNonNegativeNumber(
      "list-active-orders",
      `orders[${i}].remainingQuantity`,
      item["remainingQuantity"]
    );
    if (!itemRemaining.ok) return err(itemRemaining.error);
    orders.push({
      orderId: itemOrderId.value as OrderId,
      status: itemStatus.value,
      side: itemSide.value,
      type: itemType.value,
      remainingQuantity: itemRemaining.value
    });
  }
  return ok({
    accountId: accountId.value as MatchAccountId,
    orders,
    queriedAt: queriedAt.value
  });
};

const parseQueryTradesResponse = (
  body: string
): Result<QueryTradesResponse, MatchEnginePortError> => {
  const parsed = parseJsonBody("query-trades", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const orderId = requireString("query-trades", "orderId", root["orderId"]);
  if (!orderId.ok) return err(orderId.error);
  const queriedAt = requireIsoTimestamp("query-trades", "queriedAt", root["queriedAt"]);
  if (!queriedAt.ok) return err(queriedAt.error);
  const rawTrades = root["trades"];
  if (!Array.isArray(rawTrades)) {
    return err(buildSchemaError("query-trades", "trades", "must_be_array"));
  }
  const trades: TradeRecord[] = [];
  for (let i = 0; i < rawTrades.length; i += 1) {
    const item = rawTrades[i] as Record<string, unknown>;
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return err(buildSchemaError("query-trades", `trades[${i}]`, "not_object"));
    }
    const tradeId = requireString("query-trades", `trades[${i}].tradeId`, item["tradeId"]);
    if (!tradeId.ok) return err(tradeId.error);
    const tradeOrderId = requireString("query-trades", `trades[${i}].orderId`, item["orderId"]);
    if (!tradeOrderId.ok) return err(tradeOrderId.error);
    const executedQuantity = requireNonNegativeNumber(
      "query-trades",
      `trades[${i}].executedQuantity`,
      item["executedQuantity"]
    );
    if (!executedQuantity.ok) return err(executedQuantity.error);
    const executedPrice = requireNonNegativeNumber(
      "query-trades",
      `trades[${i}].executedPrice`,
      item["executedPrice"]
    );
    if (!executedPrice.ok) return err(executedPrice.error);
    const executedAt = requireIsoTimestamp(
      "query-trades",
      `trades[${i}].executedAt`,
      item["executedAt"]
    );
    if (!executedAt.ok) return err(executedAt.error);
    trades.push({
      tradeId: tradeId.value as TradeId,
      orderId: tradeOrderId.value as OrderId,
      executedQuantity: executedQuantity.value,
      executedPrice: executedPrice.value,
      executedAt: executedAt.value
    });
  }
  return ok({
    orderId: orderId.value as OrderId,
    trades,
    queriedAt: queriedAt.value
  });
};

// -- Base error → Match error translator -----------------------------------------------

const translateBaseError = (baseError: HttpBaseEngineError): MatchEnginePortError => ({
  code: baseError.code as MatchEnginePortError["code"],
  message: baseError.message,
  context: {
    ...baseError.context,
    adapterName: "match-engine-http"
  }
});

// -- Factory ---------------------------------------------------------------------------

export const createMatchEngineHttp = (options: MatchEngineHttpOptions): MatchEngineHttpAdapter => {
  if (typeof options.baseUrl !== "string" || options.baseUrl.length === 0) {
    throw new Error("match-engine-http: baseUrl is required");
  }

  const base = createHttpBaseEngine({
    ...options,
    adapterName: "match-engine-http"
  });

  const callWithTrace = async <T>(
    operation: string,
    payload: unknown,
    traceId: TraceId | undefined,
    parseBody: (body: string) => Result<T, MatchEnginePortError>
  ): Promise<Result<T, MatchEnginePortError>> => {
    const result = await base.call({ operation, payload }, traceId);
    if (!result.ok) {
      return err(translateBaseError(result.error));
    }
    return parseBody(result.value.body);
  };

  // Step 5 lesson is inherited via base.init/base.shutdown; lifecycle gates are
  // applied by the base, this adapter never re-implements them.
  const placeOrder = (
    request: PlaceOrderRequest
  ): Promise<Result<PlaceOrderResponse, MatchEnginePortError>> =>
    callWithTrace(
      "place-order",
      {
        accountId: request.accountId,
        symbol: request.symbol,
        side: request.side,
        type: request.type,
        quantity: request.quantity,
        // Only include price when the caller supplied it — limit orders typically
        // require it, market orders don't. The downstream rejects mismatched
        // combinations as TQ-INF-017 invalid_request.
        ...(request.price !== undefined ? { price: request.price } : {}),
        idempotencyKey: request.idempotencyKey
      },
      request.traceId,
      parsePlaceOrderResponse
    );

  const cancelOrder = (
    request: CancelOrderRequest
  ): Promise<Result<CancelOrderResponse, MatchEnginePortError>> =>
    callWithTrace(
      "cancel-order",
      {
        orderId: request.orderId,
        idempotencyKey: request.idempotencyKey
      },
      request.traceId,
      parseCancelOrderResponse
    );

  const queryOrder = (
    request: QueryOrderRequest
  ): Promise<Result<QueryOrderResponse, MatchEnginePortError>> =>
    callWithTrace(
      "query-order",
      { orderId: request.orderId },
      request.traceId,
      parseQueryOrderResponse
    );

  const listActiveOrders = (
    request: ListActiveOrdersRequest
  ): Promise<Result<ListActiveOrdersResponse, MatchEnginePortError>> =>
    callWithTrace(
      "list-active-orders",
      { accountId: request.accountId },
      request.traceId,
      parseListActiveOrdersResponse
    );

  const queryTrades = (
    request: QueryTradesRequest
  ): Promise<Result<QueryTradesResponse, MatchEnginePortError>> =>
    callWithTrace(
      "query-trades",
      { orderId: request.orderId },
      request.traceId,
      parseQueryTradesResponse
    );

  return {
    adapterName: "match-engine-http",
    __externalEngineProbe: true,
    init: () => base.init(),
    shutdown: () => base.shutdown(),
    healthCheck: async (): Promise<AdapterHealthStatus> => {
      const baseHealth = await base.healthCheck();
      return {
        adapterName: "match-engine-http",
        healthy: baseHealth.healthy,
        details: {
          ...baseHealth.details,
          engineKind: "match",
          businessMethods: "placeOrder,cancelOrder,queryOrder,listActiveOrders,queryTrades"
        },
        checkedAt: baseHealth.checkedAt
      };
    },
    placeOrder,
    cancelOrder,
    queryOrder,
    listActiveOrders,
    queryTrades,
    call: (request, traceId) => base.call(request, traceId),
    getCircuitBreakerState: () => base.getCircuitBreakerState(),
    getCurrentConcurrency: () => base.getCurrentConcurrency(),
    getPeakConcurrency: () => base.getPeakConcurrency(),
    getLastTraceId: () => base.getLastTraceId(),
    getRetryStats: () => base.getRetryStats(),
    getLastCircuitTransitionAt: () => base.getLastCircuitTransitionAt()
  };
};
