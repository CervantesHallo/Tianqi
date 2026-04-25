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
  FundingRateValue,
  MarkPriceEnginePort,
  MarkPriceEnginePortError,
  MarkPriceQuote,
  MarkPriceValue,
  QueryFundingRateRequest,
  QueryFundingRateResponse,
  QueryMarkPriceBatchRequest,
  QueryMarkPriceBatchResponse,
  QueryMarkPriceRequest,
  QueryMarkPriceResponse
} from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { Result, TraceId } from "@tianqi/shared";

// MarkPriceEngineHttp — Sprint E 第四个业务 Engine Adapter（Step 17）。本 Adapter 与
// 同 Step 落地的 @tianqi/fund-engine-http **独立写出**——结构同构是模板复用的结果，
// 不是代码复制的副作用（META-RULE F 在业务 Engine 之间硬约束）。同时与 Step 15 / 16
// 的 margin / position / match 三个业务 Engine **零代码共享、零相互 import**。
//
// META-RULE O 消费方纪律继承 Step 15 / 16：Options 透传 / 仅公开导出 import / 业务层
// 0 稳定性逻辑 / 不 import sibling business engine。Step 5 state guard 教训通过基座
// 继承——本 Adapter 的 init / shutdown 一行委托 base.init() / base.shutdown()，不再
// 实现额外的 lifecycle 守卫。
//
// 业务领域差异：本 Adapter 是**纯读引擎**——3 个业务方法全部为天然幂等读，无任何写
// 方法、无幂等键。这是与 Step 15 / 16 操作型 Engine 的关键差异。读取型 Engine 在
// 熔断 open 时的运维含义见 README §Semantics。

export type MarkPriceEngineHttpOptions = HttpBaseEngineOptions & {
  // 标记价引擎 future hooks（如 Quote 缓存预热、symbol whitelist 过滤等）若 Step 17
  // 之后扩展，会落到这里。当前版本字段为空——五件套配置完全透传给基座。
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

export type MarkPriceEngineHttpAdapter = MarkPriceEnginePort &
  ExternalEngineContractProbeSurface & {
    readonly adapterName: "mark-price-engine-http";
    init(): Promise<void>;
    shutdown(): Promise<void>;
    healthCheck(): Promise<AdapterHealthStatus>;
    call(
      request: HttpBaseCallRequest,
      traceId?: TraceId
    ): Promise<Result<HttpCallResponse, HttpBaseEngineError>>;
  };

// -- Response parsers ---------------------------------------------------------------
// 严格反序列化——任何字段缺失 / 类型错 / 时间戳非法 / 数值不合理立即抛 TQ-CON-013，
// 永不 zero 默认值兜底。每个 reason 是领域 moniker，永不泄漏 raw HTTP status 或网络
// 错误名（§6.5 三层固化）。

const isIsoTimestamp = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  if (Number.isNaN(Date.parse(value))) return false;
  return /T/.test(value) && /(Z|[+-]\d{2}:?\d{2})$/.test(value);
};

const buildSchemaError = (
  operation: string,
  fieldPath: string,
  reason: string
): MarkPriceEnginePortError => ({
  code: "TQ-CON-013",
  message: `TQ-CON-013: ${operation} response ${fieldPath} ${reason}`,
  context: {
    adapterName: "mark-price-engine-http",
    operation,
    fieldPath,
    reason
  }
});

const parseJsonBody = (
  operation: string,
  body: string
): Result<Record<string, unknown>, MarkPriceEnginePortError> => {
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
): Result<string, MarkPriceEnginePortError> => {
  if (typeof value !== "string" || value.length === 0) {
    return err(buildSchemaError(operation, fieldPath, "missing_or_non_string"));
  }
  return ok(value);
};

// MarkPrice 必须 > 0（标的存在的前提）——零或负的"标记价"在加密资产语境无合法解释，
// 与 Margin / Fund 的 ≥ 0 约束（余额可以为零）显著不同。专属 reason 名让运维一眼
// 看出"下游返回了非法标记价"。
const requirePositiveNumber = (
  operation: string,
  fieldPath: string,
  value: unknown
): Result<number, MarkPriceEnginePortError> => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return err(buildSchemaError(operation, fieldPath, "missing_or_non_positive_number"));
  }
  return ok(value);
};

// FundingRate 可正可负——多空力量博弈的常态体现。仅校验 finite。
const requireFiniteNumber = (
  operation: string,
  fieldPath: string,
  value: unknown
): Result<number, MarkPriceEnginePortError> => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return err(buildSchemaError(operation, fieldPath, "missing_or_non_finite_number"));
  }
  return ok(value);
};

const requireIsoTimestamp = (
  operation: string,
  fieldPath: string,
  value: unknown
): Result<string, MarkPriceEnginePortError> => {
  if (!isIsoTimestamp(value)) {
    return err(buildSchemaError(operation, fieldPath, "invalid_timestamp"));
  }
  return ok(value);
};

const parseQueryMarkPriceResponse = (
  body: string
): Result<QueryMarkPriceResponse, MarkPriceEnginePortError> => {
  const parsed = parseJsonBody("query-mark-price", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const symbol = requireString("query-mark-price", "symbol", root["symbol"]);
  if (!symbol.ok) return err(symbol.error);
  const markPrice = requirePositiveNumber("query-mark-price", "markPrice", root["markPrice"]);
  if (!markPrice.ok) return err(markPrice.error);
  const queriedAt = requireIsoTimestamp("query-mark-price", "queriedAt", root["queriedAt"]);
  if (!queriedAt.ok) return err(queriedAt.error);
  return ok({
    symbol: symbol.value,
    markPrice: markPrice.value as MarkPriceValue,
    queriedAt: queriedAt.value
  });
};

const parseQueryMarkPriceBatchResponse = (
  body: string
): Result<QueryMarkPriceBatchResponse, MarkPriceEnginePortError> => {
  const parsed = parseJsonBody("query-mark-price-batch", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const queriedAt = requireIsoTimestamp("query-mark-price-batch", "queriedAt", root["queriedAt"]);
  if (!queriedAt.ok) return err(queriedAt.error);
  const rawPrices = root["prices"];
  if (!Array.isArray(rawPrices)) {
    return err(buildSchemaError("query-mark-price-batch", "prices", "must_be_array"));
  }
  const prices: MarkPriceQuote[] = [];
  for (let i = 0; i < rawPrices.length; i += 1) {
    const item = rawPrices[i] as Record<string, unknown>;
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return err(buildSchemaError("query-mark-price-batch", `prices[${i}]`, "not_object"));
    }
    const itemSymbol = requireString(
      "query-mark-price-batch",
      `prices[${i}].symbol`,
      item["symbol"]
    );
    if (!itemSymbol.ok) return err(itemSymbol.error);
    const itemPrice = requirePositiveNumber(
      "query-mark-price-batch",
      `prices[${i}].markPrice`,
      item["markPrice"]
    );
    if (!itemPrice.ok) return err(itemPrice.error);
    prices.push({
      symbol: itemSymbol.value,
      markPrice: itemPrice.value as MarkPriceValue
    });
  }
  return ok({
    prices,
    queriedAt: queriedAt.value
  });
};

const parseQueryFundingRateResponse = (
  body: string
): Result<QueryFundingRateResponse, MarkPriceEnginePortError> => {
  const parsed = parseJsonBody("query-funding-rate", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const symbol = requireString("query-funding-rate", "symbol", root["symbol"]);
  if (!symbol.ok) return err(symbol.error);
  const fundingRate = requireFiniteNumber("query-funding-rate", "fundingRate", root["fundingRate"]);
  if (!fundingRate.ok) return err(fundingRate.error);
  const fundingTime = requireIsoTimestamp("query-funding-rate", "fundingTime", root["fundingTime"]);
  if (!fundingTime.ok) return err(fundingTime.error);
  const queriedAt = requireIsoTimestamp("query-funding-rate", "queriedAt", root["queriedAt"]);
  if (!queriedAt.ok) return err(queriedAt.error);
  return ok({
    symbol: symbol.value,
    fundingRate: fundingRate.value as FundingRateValue,
    fundingTime: fundingTime.value,
    queriedAt: queriedAt.value
  });
};

// -- Base error → MarkPrice error translator -----------------------------------------

const translateBaseError = (baseError: HttpBaseEngineError): MarkPriceEnginePortError => ({
  code: baseError.code as MarkPriceEnginePortError["code"],
  message: baseError.message,
  context: {
    ...baseError.context,
    adapterName: "mark-price-engine-http"
  }
});

// -- Factory ---------------------------------------------------------------------------

export const createMarkPriceEngineHttp = (
  options: MarkPriceEngineHttpOptions
): MarkPriceEngineHttpAdapter => {
  if (typeof options.baseUrl !== "string" || options.baseUrl.length === 0) {
    throw new Error("mark-price-engine-http: baseUrl is required");
  }

  const base = createHttpBaseEngine({
    ...options,
    adapterName: "mark-price-engine-http"
  });

  // Step 5 state guard 教训：先判 shut_down 再判 created（继承基座，本 Adapter 不
  // 重新实现 lifecycle 校验）。callWithTrace 是业务方法的统一入口——所有 5 件套
  // 稳定性都通过 base.call 透传。
  const callWithTrace = async <T>(
    operation: string,
    payload: unknown,
    traceId: TraceId | undefined,
    parseBody: (body: string) => Result<T, MarkPriceEnginePortError>
  ): Promise<Result<T, MarkPriceEnginePortError>> => {
    const result = await base.call({ operation, payload }, traceId);
    if (!result.ok) {
      return err(translateBaseError(result.error));
    }
    return parseBody(result.value.body);
  };

  const queryMarkPrice = (
    request: QueryMarkPriceRequest
  ): Promise<Result<QueryMarkPriceResponse, MarkPriceEnginePortError>> =>
    callWithTrace(
      "query-mark-price",
      { symbol: request.symbol },
      request.traceId,
      parseQueryMarkPriceResponse
    );

  const queryMarkPriceBatch = (
    request: QueryMarkPriceBatchRequest
  ): Promise<Result<QueryMarkPriceBatchResponse, MarkPriceEnginePortError>> =>
    callWithTrace(
      "query-mark-price-batch",
      { symbols: request.symbols },
      request.traceId,
      parseQueryMarkPriceBatchResponse
    );

  const queryFundingRate = (
    request: QueryFundingRateRequest
  ): Promise<Result<QueryFundingRateResponse, MarkPriceEnginePortError>> =>
    callWithTrace(
      "query-funding-rate",
      { symbol: request.symbol },
      request.traceId,
      parseQueryFundingRateResponse
    );

  return {
    adapterName: "mark-price-engine-http",
    __externalEngineProbe: true,
    init: () => base.init(),
    shutdown: () => base.shutdown(),
    healthCheck: async (): Promise<AdapterHealthStatus> => {
      const baseHealth = await base.healthCheck();
      return {
        adapterName: "mark-price-engine-http",
        healthy: baseHealth.healthy,
        details: {
          ...baseHealth.details,
          engineKind: "mark-price",
          businessMethods: "queryMarkPrice,queryMarkPriceBatch,queryFundingRate"
        },
        checkedAt: baseHealth.checkedAt
      };
    },
    queryMarkPrice,
    queryMarkPriceBatch,
    queryFundingRate,
    call: (request, traceId) => base.call(request, traceId),
    getCircuitBreakerState: () => base.getCircuitBreakerState(),
    getCurrentConcurrency: () => base.getCurrentConcurrency(),
    getPeakConcurrency: () => base.getPeakConcurrency(),
    getLastTraceId: () => base.getLastTraceId(),
    getRetryStats: () => base.getRetryStats(),
    getLastCircuitTransitionAt: () => base.getLastCircuitTransitionAt()
  };
};
