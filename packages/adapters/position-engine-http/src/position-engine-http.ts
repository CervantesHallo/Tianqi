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
  PositionId,
  PositionSide,
  PositionSize,
  QueryPositionRequest,
  QueryPositionResponse
} from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { Result, TraceId } from "@tianqi/shared";

// PositionEngineHttp — Sprint E 第二个业务 Engine Adapter（Step 16），第三个 Adapter
// 复用基座（@tianqi/external-engine-http-base）。结构与 Step 15 的
// @tianqi/margin-engine-http 高度同构，但**独立写出**——没有从 margin-engine-http
// 复制任何文件、没有从 match-engine-http 复制任何文件（META-RULE F 在 Sprint E 业务
// Engine 之间持续生效）。
//
// META-RULE O 消费方纪律（与 Step 15 同步）：
//   1. Options = HttpBaseEngineOptions 透传，零字段重设计
//   2. 仅 import 基座 src/index.ts 公开导出
//   3. 业务层 0 个 retry / timeout / circuit / rateLimit 逻辑
//   4. 不 import 任何 sibling business engine

export type PositionEngineHttpOptions = HttpBaseEngineOptions & {
  // No Position-specific fields today. Type alias exists for discoverability +
  // future evolution headroom.
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

export type PositionEngineHttpAdapter = PositionEnginePort &
  ExternalEngineContractProbeSurface & {
    readonly adapterName: "position-engine-http";
    init(): Promise<void>;
    shutdown(): Promise<void>;
    healthCheck(): Promise<AdapterHealthStatus>;
    // META-RULE P pass-through (same role as in margin-engine-http): satisfies
    // TestkitExternalEngineFoundation so the contract suite mounts directly.
    // Production callers should NOT use this — go through queryPosition /
    // openPosition / etc.
    call(
      request: HttpBaseCallRequest,
      traceId?: TraceId
    ): Promise<Result<HttpCallResponse, HttpBaseEngineError>>;
  };

// -- Response parsers --------------------------------------------------------------

const isIsoTimestamp = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  if (Number.isNaN(Date.parse(value))) return false;
  return /T/.test(value) && /(Z|[+-]\d{2}:?\d{2})$/.test(value);
};

const buildSchemaError = (
  operation: string,
  fieldPath: string,
  reason: string
): PositionEnginePortError => ({
  code: "TQ-CON-011",
  message: `TQ-CON-011: ${operation} response ${fieldPath} ${reason}`,
  context: {
    adapterName: "position-engine-http",
    operation,
    fieldPath,
    reason
  }
});

const parseJsonBody = (
  operation: string,
  body: string
): Result<Record<string, unknown>, PositionEnginePortError> => {
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
): Result<string, PositionEnginePortError> => {
  if (typeof value !== "string" || value.length === 0) {
    return err(buildSchemaError(operation, fieldPath, "missing_or_non_string"));
  }
  return ok(value);
};

const requireNonNegativeNumber = (
  operation: string,
  fieldPath: string,
  value: unknown
): Result<number, PositionEnginePortError> => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return err(buildSchemaError(operation, fieldPath, "missing_or_negative_number"));
  }
  return ok(value);
};

const requireIsoTimestamp = (
  operation: string,
  fieldPath: string,
  value: unknown
): Result<string, PositionEnginePortError> => {
  if (!isIsoTimestamp(value)) {
    return err(buildSchemaError(operation, fieldPath, "invalid_timestamp"));
  }
  return ok(value);
};

const requireSide = (
  operation: string,
  fieldPath: string,
  value: unknown
): Result<PositionSide, PositionEnginePortError> => {
  if (value !== "long" && value !== "short") {
    return err(buildSchemaError(operation, fieldPath, "side_must_be_long_or_short"));
  }
  return ok(value);
};

const parseQueryPositionResponse = (
  body: string
): Result<QueryPositionResponse, PositionEnginePortError> => {
  const parsed = parseJsonBody("query-position", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const accountId = requireString("query-position", "accountId", root["accountId"]);
  if (!accountId.ok) return err(accountId.error);
  const symbol = requireString("query-position", "symbol", root["symbol"]);
  if (!symbol.ok) return err(symbol.error);
  // positionId may be null (no current position); the field MUST be present.
  if (!Object.prototype.hasOwnProperty.call(root, "positionId")) {
    return err(buildSchemaError("query-position", "positionId", "missing_field"));
  }
  const rawPositionId = root["positionId"];
  let positionId: PositionId | null;
  if (rawPositionId === null) {
    positionId = null;
  } else if (typeof rawPositionId === "string" && rawPositionId.length > 0) {
    positionId = rawPositionId as PositionId;
  } else {
    return err(
      buildSchemaError("query-position", "positionId", "must_be_null_or_non_empty_string")
    );
  }
  // side is null when positionId is null; otherwise required and "long"|"short".
  const rawSide = root["side"];
  let side: PositionSide | null;
  if (positionId === null) {
    side = null;
  } else {
    const parsedSide = requireSide("query-position", "side", rawSide);
    if (!parsedSide.ok) return err(parsedSide.error);
    side = parsedSide.value;
  }
  const size = requireNonNegativeNumber("query-position", "size", root["size"]);
  if (!size.ok) return err(size.error);
  const queriedAt = requireIsoTimestamp("query-position", "queriedAt", root["queriedAt"]);
  if (!queriedAt.ok) return err(queriedAt.error);
  return ok({
    accountId: accountId.value as PositionAccountId,
    symbol: symbol.value,
    positionId,
    side,
    size: size.value as PositionSize,
    queriedAt: queriedAt.value
  });
};

const parseOpenPositionResponse = (
  body: string
): Result<OpenPositionResponse, PositionEnginePortError> => {
  const parsed = parseJsonBody("open-position", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const positionId = requireString("open-position", "positionId", root["positionId"]);
  if (!positionId.ok) return err(positionId.error);
  const accountId = requireString("open-position", "accountId", root["accountId"]);
  if (!accountId.ok) return err(accountId.error);
  const symbol = requireString("open-position", "symbol", root["symbol"]);
  if (!symbol.ok) return err(symbol.error);
  const side = requireSide("open-position", "side", root["side"]);
  if (!side.ok) return err(side.error);
  const size = requireNonNegativeNumber("open-position", "size", root["size"]);
  if (!size.ok) return err(size.error);
  const openedAt = requireIsoTimestamp("open-position", "openedAt", root["openedAt"]);
  if (!openedAt.ok) return err(openedAt.error);
  return ok({
    positionId: positionId.value as PositionId,
    accountId: accountId.value as PositionAccountId,
    symbol: symbol.value,
    side: side.value,
    size: size.value as PositionSize,
    openedAt: openedAt.value
  });
};

const parseAdjustPositionResponse = (
  body: string
): Result<AdjustPositionResponse, PositionEnginePortError> => {
  const parsed = parseJsonBody("adjust-position", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const positionId = requireString("adjust-position", "positionId", root["positionId"]);
  if (!positionId.ok) return err(positionId.error);
  const side = requireSide("adjust-position", "side", root["side"]);
  if (!side.ok) return err(side.error);
  const size = requireNonNegativeNumber("adjust-position", "size", root["size"]);
  if (!size.ok) return err(size.error);
  const adjustedAt = requireIsoTimestamp("adjust-position", "adjustedAt", root["adjustedAt"]);
  if (!adjustedAt.ok) return err(adjustedAt.error);
  return ok({
    positionId: positionId.value as PositionId,
    side: side.value,
    size: size.value as PositionSize,
    adjustedAt: adjustedAt.value
  });
};

const parseClosePositionResponse = (
  body: string
): Result<ClosePositionResponse, PositionEnginePortError> => {
  const parsed = parseJsonBody("close-position", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const positionId = requireString("close-position", "positionId", root["positionId"]);
  if (!positionId.ok) return err(positionId.error);
  const closedSize = requireNonNegativeNumber("close-position", "closedSize", root["closedSize"]);
  if (!closedSize.ok) return err(closedSize.error);
  const closedAt = requireIsoTimestamp("close-position", "closedAt", root["closedAt"]);
  if (!closedAt.ok) return err(closedAt.error);
  return ok({
    positionId: positionId.value as PositionId,
    closedSize: closedSize.value as PositionSize,
    closedAt: closedAt.value
  });
};

const parseListOpenPositionsResponse = (
  body: string
): Result<ListOpenPositionsResponse, PositionEnginePortError> => {
  const parsed = parseJsonBody("list-open-positions", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const accountId = requireString("list-open-positions", "accountId", root["accountId"]);
  if (!accountId.ok) return err(accountId.error);
  const queriedAt = requireIsoTimestamp("list-open-positions", "queriedAt", root["queriedAt"]);
  if (!queriedAt.ok) return err(queriedAt.error);
  const rawPositions = root["positions"];
  if (!Array.isArray(rawPositions)) {
    return err(buildSchemaError("list-open-positions", "positions", "must_be_array"));
  }
  const positions: OpenPositionSummary[] = [];
  for (let i = 0; i < rawPositions.length; i += 1) {
    const item = rawPositions[i] as Record<string, unknown>;
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return err(buildSchemaError("list-open-positions", `positions[${i}]`, "not_object"));
    }
    const itemPositionId = requireString(
      "list-open-positions",
      `positions[${i}].positionId`,
      item["positionId"]
    );
    if (!itemPositionId.ok) return err(itemPositionId.error);
    const itemSymbol = requireString(
      "list-open-positions",
      `positions[${i}].symbol`,
      item["symbol"]
    );
    if (!itemSymbol.ok) return err(itemSymbol.error);
    const itemSide = requireSide("list-open-positions", `positions[${i}].side`, item["side"]);
    if (!itemSide.ok) return err(itemSide.error);
    const itemSize = requireNonNegativeNumber(
      "list-open-positions",
      `positions[${i}].size`,
      item["size"]
    );
    if (!itemSize.ok) return err(itemSize.error);
    positions.push({
      positionId: itemPositionId.value as PositionId,
      symbol: itemSymbol.value,
      side: itemSide.value,
      size: itemSize.value as PositionSize
    });
  }
  return ok({
    accountId: accountId.value as PositionAccountId,
    positions,
    queriedAt: queriedAt.value
  });
};

// -- Base error → Position error translator --------------------------------------------

const translateBaseError = (baseError: HttpBaseEngineError): PositionEnginePortError => ({
  code: baseError.code as PositionEnginePortError["code"],
  message: baseError.message,
  context: {
    ...baseError.context,
    adapterName: "position-engine-http"
  }
});

// -- Factory ---------------------------------------------------------------------------

export const createPositionEngineHttp = (
  options: PositionEngineHttpOptions
): PositionEngineHttpAdapter => {
  if (typeof options.baseUrl !== "string" || options.baseUrl.length === 0) {
    throw new Error("position-engine-http: baseUrl is required");
  }

  const base = createHttpBaseEngine({
    ...options,
    adapterName: "position-engine-http"
  });

  const callWithTrace = async <T>(
    operation: string,
    payload: unknown,
    traceId: TraceId | undefined,
    parseBody: (body: string) => Result<T, PositionEnginePortError>
  ): Promise<Result<T, PositionEnginePortError>> => {
    const result = await base.call({ operation, payload }, traceId);
    if (!result.ok) {
      return err(translateBaseError(result.error));
    }
    return parseBody(result.value.body);
  };

  // Step 5 lesson is inherited via base.init/base.shutdown (the base honours the
  // shut_down-before-created order); see http-base-engine.ts for the original
  // guard. This adapter never re-implements lifecycle gates.
  const queryPosition = (
    request: QueryPositionRequest
  ): Promise<Result<QueryPositionResponse, PositionEnginePortError>> =>
    callWithTrace(
      "query-position",
      {
        accountId: request.accountId,
        symbol: request.symbol
      },
      request.traceId,
      parseQueryPositionResponse
    );

  const openPosition = (
    request: OpenPositionRequest
  ): Promise<Result<OpenPositionResponse, PositionEnginePortError>> =>
    callWithTrace(
      "open-position",
      {
        accountId: request.accountId,
        symbol: request.symbol,
        side: request.side,
        size: request.size,
        idempotencyKey: request.idempotencyKey
      },
      request.traceId,
      parseOpenPositionResponse
    );

  const adjustPosition = (
    request: AdjustPositionRequest
  ): Promise<Result<AdjustPositionResponse, PositionEnginePortError>> =>
    callWithTrace(
      "adjust-position",
      {
        positionId: request.positionId,
        deltaSize: request.deltaSize,
        idempotencyKey: request.idempotencyKey
      },
      request.traceId,
      parseAdjustPositionResponse
    );

  const closePosition = (
    request: ClosePositionRequest
  ): Promise<Result<ClosePositionResponse, PositionEnginePortError>> =>
    callWithTrace(
      "close-position",
      {
        positionId: request.positionId,
        idempotencyKey: request.idempotencyKey
      },
      request.traceId,
      parseClosePositionResponse
    );

  const listOpenPositions = (
    request: ListOpenPositionsRequest
  ): Promise<Result<ListOpenPositionsResponse, PositionEnginePortError>> =>
    callWithTrace(
      "list-open-positions",
      { accountId: request.accountId },
      request.traceId,
      parseListOpenPositionsResponse
    );

  return {
    adapterName: "position-engine-http",
    __externalEngineProbe: true,
    init: () => base.init(),
    shutdown: () => base.shutdown(),
    healthCheck: async (): Promise<AdapterHealthStatus> => {
      const baseHealth = await base.healthCheck();
      return {
        adapterName: "position-engine-http",
        healthy: baseHealth.healthy,
        details: {
          ...baseHealth.details,
          engineKind: "position",
          businessMethods:
            "queryPosition,openPosition,adjustPosition,closePosition,listOpenPositions"
        },
        checkedAt: baseHealth.checkedAt
      };
    },
    queryPosition,
    openPosition,
    adjustPosition,
    closePosition,
    listOpenPositions,
    call: (request, traceId) => base.call(request, traceId),
    getCircuitBreakerState: () => base.getCircuitBreakerState(),
    getCurrentConcurrency: () => base.getCurrentConcurrency(),
    getPeakConcurrency: () => base.getPeakConcurrency(),
    getLastTraceId: () => base.getLastTraceId(),
    getRetryStats: () => base.getRetryStats(),
    getLastCircuitTransitionAt: () => base.getLastCircuitTransitionAt()
  };
};
