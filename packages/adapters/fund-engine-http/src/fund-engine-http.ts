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
  FundAccountId,
  FundAmount,
  FundCurrency,
  FundEnginePort,
  FundEnginePortError,
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
} from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { Result, TraceId } from "@tianqi/shared";

// FundEngineHttp — Sprint E 第五个业务 Engine Adapter（Step 17 收官战）。本 Adapter
// 与同 Step 落地的 @tianqi/mark-price-engine-http **独立写出**——零代码共享、零相互
// import（META-RULE F 在业务 Engine 之间硬约束）。同时与 Step 15 / 16 的三个业务
// Engine（margin / position / match）零代码共享、零相互 import。
//
// META-RULE O 消费方纪律继承 Step 15 / 16 / 17 mark-price：Options 透传 / 仅公开导出
// import / 业务层 0 稳定性逻辑 / 不 import sibling business engine。
//
// 业务领域差异：本 Adapter 是**读为主 + 单一弱写**的混合形态——4 个业务方法 = 3 读
// （queryFundBalance / queryFundLedger / queryTransferStatus）+ 1 写（transferFund，
// 依赖 idempotencyKey）。这与 Step 15 / 16 操作型 Engine（多写多读）不同，也与同 Step
// mark-price 纯读 Engine 不同——Sprint E 三种业务形态各一。

export type FundEngineHttpOptions = HttpBaseEngineOptions & {
  // 资金引擎 future hooks（如划转上限、币种白名单等）若 Step 17 之后扩展，落到这里。
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

export type FundEngineHttpAdapter = FundEnginePort &
  ExternalEngineContractProbeSurface & {
    readonly adapterName: "fund-engine-http";
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
): FundEnginePortError => ({
  code: "TQ-CON-014",
  message: `TQ-CON-014: ${operation} response ${fieldPath} ${reason}`,
  context: {
    adapterName: "fund-engine-http",
    operation,
    fieldPath,
    reason
  }
});

const parseJsonBody = (
  operation: string,
  body: string
): Result<Record<string, unknown>, FundEnginePortError> => {
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
): Result<string, FundEnginePortError> => {
  if (typeof value !== "string" || value.length === 0) {
    return err(buildSchemaError(operation, fieldPath, "missing_or_non_string"));
  }
  return ok(value);
};

const requireNonNegativeNumber = (
  operation: string,
  fieldPath: string,
  value: unknown
): Result<number, FundEnginePortError> => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return err(buildSchemaError(operation, fieldPath, "missing_or_negative_number"));
  }
  return ok(value);
};

const requireIsoTimestamp = (
  operation: string,
  fieldPath: string,
  value: unknown
): Result<string, FundEnginePortError> => {
  if (!isIsoTimestamp(value)) {
    return err(buildSchemaError(operation, fieldPath, "invalid_timestamp"));
  }
  return ok(value);
};

const TRANSFER_STATUSES: readonly TransferStatus[] = ["pending", "completed", "failed"];

const requireTransferStatus = (
  operation: string,
  fieldPath: string,
  value: unknown
): Result<TransferStatus, FundEnginePortError> => {
  if (typeof value !== "string" || !TRANSFER_STATUSES.includes(value as TransferStatus)) {
    return err(buildSchemaError(operation, fieldPath, "transfer_status_unknown"));
  }
  return ok(value as TransferStatus);
};

const LEDGER_ENTRY_TYPES: readonly LedgerEntryType[] = [
  "deposit",
  "withdrawal",
  "transfer",
  "trade",
  "fee"
];

const requireLedgerEntryType = (
  operation: string,
  fieldPath: string,
  value: unknown
): Result<LedgerEntryType, FundEnginePortError> => {
  if (typeof value !== "string" || !LEDGER_ENTRY_TYPES.includes(value as LedgerEntryType)) {
    return err(buildSchemaError(operation, fieldPath, "ledger_entry_type_unknown"));
  }
  return ok(value as LedgerEntryType);
};

const parseQueryFundBalanceResponse = (
  body: string
): Result<QueryFundBalanceResponse, FundEnginePortError> => {
  const parsed = parseJsonBody("query-fund-balance", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const accountId = requireString("query-fund-balance", "accountId", root["accountId"]);
  if (!accountId.ok) return err(accountId.error);
  const currency = requireString("query-fund-balance", "currency", root["currency"]);
  if (!currency.ok) return err(currency.error);
  const total = requireNonNegativeNumber(
    "query-fund-balance",
    "totalBalance",
    root["totalBalance"]
  );
  if (!total.ok) return err(total.error);
  const available = requireNonNegativeNumber(
    "query-fund-balance",
    "availableBalance",
    root["availableBalance"]
  );
  if (!available.ok) return err(available.error);
  const frozen = requireNonNegativeNumber(
    "query-fund-balance",
    "frozenBalance",
    root["frozenBalance"]
  );
  if (!frozen.ok) return err(frozen.error);
  const queriedAt = requireIsoTimestamp("query-fund-balance", "queriedAt", root["queriedAt"]);
  if (!queriedAt.ok) return err(queriedAt.error);
  return ok({
    accountId: accountId.value as FundAccountId,
    currency: currency.value as FundCurrency,
    totalBalance: total.value as FundAmount,
    availableBalance: available.value as FundAmount,
    frozenBalance: frozen.value as FundAmount,
    queriedAt: queriedAt.value
  });
};

const parseQueryFundLedgerResponse = (
  body: string
): Result<QueryFundLedgerResponse, FundEnginePortError> => {
  const parsed = parseJsonBody("query-fund-ledger", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const accountId = requireString("query-fund-ledger", "accountId", root["accountId"]);
  if (!accountId.ok) return err(accountId.error);
  const currency = requireString("query-fund-ledger", "currency", root["currency"]);
  if (!currency.ok) return err(currency.error);
  const queriedAt = requireIsoTimestamp("query-fund-ledger", "queriedAt", root["queriedAt"]);
  if (!queriedAt.ok) return err(queriedAt.error);
  const rawEntries = root["entries"];
  if (!Array.isArray(rawEntries)) {
    return err(buildSchemaError("query-fund-ledger", "entries", "must_be_array"));
  }
  const entries: LedgerEntry[] = [];
  for (let i = 0; i < rawEntries.length; i += 1) {
    const item = rawEntries[i] as Record<string, unknown>;
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return err(buildSchemaError("query-fund-ledger", `entries[${i}]`, "not_object"));
    }
    const entryId = requireString("query-fund-ledger", `entries[${i}].entryId`, item["entryId"]);
    if (!entryId.ok) return err(entryId.error);
    const type = requireLedgerEntryType("query-fund-ledger", `entries[${i}].type`, item["type"]);
    if (!type.ok) return err(type.error);
    const amount = requireNonNegativeNumber(
      "query-fund-ledger",
      `entries[${i}].amount`,
      item["amount"]
    );
    if (!amount.ok) return err(amount.error);
    const balanceAfter = requireNonNegativeNumber(
      "query-fund-ledger",
      `entries[${i}].balanceAfter`,
      item["balanceAfter"]
    );
    if (!balanceAfter.ok) return err(balanceAfter.error);
    const entryAt = requireIsoTimestamp(
      "query-fund-ledger",
      `entries[${i}].entryAt`,
      item["entryAt"]
    );
    if (!entryAt.ok) return err(entryAt.error);
    entries.push({
      entryId: entryId.value,
      type: type.value,
      amount: amount.value as FundAmount,
      balanceAfter: balanceAfter.value as FundAmount,
      entryAt: entryAt.value
    });
  }
  return ok({
    accountId: accountId.value as FundAccountId,
    currency: currency.value as FundCurrency,
    entries,
    queriedAt: queriedAt.value
  });
};

const parseTransferFundResponse = (
  body: string
): Result<TransferFundResponse, FundEnginePortError> => {
  const parsed = parseJsonBody("transfer-fund", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const transferId = requireString("transfer-fund", "transferId", root["transferId"]);
  if (!transferId.ok) return err(transferId.error);
  const status = requireTransferStatus("transfer-fund", "status", root["status"]);
  if (!status.ok) return err(status.error);
  const transferredAt = requireIsoTimestamp(
    "transfer-fund",
    "transferredAt",
    root["transferredAt"]
  );
  if (!transferredAt.ok) return err(transferredAt.error);
  return ok({
    transferId: transferId.value as TransferId,
    status: status.value,
    transferredAt: transferredAt.value
  });
};

const parseQueryTransferStatusResponse = (
  body: string
): Result<QueryTransferStatusResponse, FundEnginePortError> => {
  const parsed = parseJsonBody("query-transfer-status", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const transferId = requireString("query-transfer-status", "transferId", root["transferId"]);
  if (!transferId.ok) return err(transferId.error);
  const status = requireTransferStatus("query-transfer-status", "status", root["status"]);
  if (!status.ok) return err(status.error);
  const transferredAt = requireIsoTimestamp(
    "query-transfer-status",
    "transferredAt",
    root["transferredAt"]
  );
  if (!transferredAt.ok) return err(transferredAt.error);
  return ok({
    transferId: transferId.value as TransferId,
    status: status.value,
    transferredAt: transferredAt.value
  });
};

// -- Base error → Fund error translator ----------------------------------------------

const translateBaseError = (baseError: HttpBaseEngineError): FundEnginePortError => ({
  code: baseError.code as FundEnginePortError["code"],
  message: baseError.message,
  context: {
    ...baseError.context,
    adapterName: "fund-engine-http"
  }
});

// -- Factory ---------------------------------------------------------------------------

export const createFundEngineHttp = (options: FundEngineHttpOptions): FundEngineHttpAdapter => {
  if (typeof options.baseUrl !== "string" || options.baseUrl.length === 0) {
    throw new Error("fund-engine-http: baseUrl is required");
  }

  const base = createHttpBaseEngine({
    ...options,
    adapterName: "fund-engine-http"
  });

  // Step 5 state guard 教训通过 base.init / base.shutdown 委托继承——本 Adapter 不
  // 重新实现 lifecycle 校验，避免重复逻辑漂移。
  const callWithTrace = async <T>(
    operation: string,
    payload: unknown,
    traceId: TraceId | undefined,
    parseBody: (body: string) => Result<T, FundEnginePortError>
  ): Promise<Result<T, FundEnginePortError>> => {
    const result = await base.call({ operation, payload }, traceId);
    if (!result.ok) {
      return err(translateBaseError(result.error));
    }
    return parseBody(result.value.body);
  };

  const queryFundBalance = (
    request: QueryFundBalanceRequest
  ): Promise<Result<QueryFundBalanceResponse, FundEnginePortError>> =>
    callWithTrace(
      "query-fund-balance",
      { accountId: request.accountId, currency: request.currency },
      request.traceId,
      parseQueryFundBalanceResponse
    );

  const queryFundLedger = (
    request: QueryFundLedgerRequest
  ): Promise<Result<QueryFundLedgerResponse, FundEnginePortError>> =>
    callWithTrace(
      "query-fund-ledger",
      {
        accountId: request.accountId,
        currency: request.currency,
        // Conditional limit 透传——下游对"limit 缺失"的语义可能是"取默认 N 条"，
        // 调用方明确传 undefined 与不传应当等价。这与 match-engine-http placeOrder
        // 的 price 条件透传同样的 pattern。
        ...(request.limit !== undefined ? { limit: request.limit } : {})
      },
      request.traceId,
      parseQueryFundLedgerResponse
    );

  const transferFund = (
    request: TransferFundRequest
  ): Promise<Result<TransferFundResponse, FundEnginePortError>> =>
    callWithTrace(
      "transfer-fund",
      {
        fromAccountId: request.fromAccountId,
        toAccountId: request.toAccountId,
        currency: request.currency,
        amount: request.amount,
        idempotencyKey: request.idempotencyKey
      },
      request.traceId,
      parseTransferFundResponse
    );

  const queryTransferStatus = (
    request: QueryTransferStatusRequest
  ): Promise<Result<QueryTransferStatusResponse, FundEnginePortError>> =>
    callWithTrace(
      "query-transfer-status",
      { transferId: request.transferId },
      request.traceId,
      parseQueryTransferStatusResponse
    );

  return {
    adapterName: "fund-engine-http",
    __externalEngineProbe: true,
    init: () => base.init(),
    shutdown: () => base.shutdown(),
    healthCheck: async (): Promise<AdapterHealthStatus> => {
      const baseHealth = await base.healthCheck();
      return {
        adapterName: "fund-engine-http",
        healthy: baseHealth.healthy,
        details: {
          ...baseHealth.details,
          engineKind: "fund",
          businessMethods: "queryFundBalance,queryFundLedger,transferFund,queryTransferStatus"
        },
        checkedAt: baseHealth.checkedAt
      };
    },
    queryFundBalance,
    queryFundLedger,
    transferFund,
    queryTransferStatus,
    call: (request, traceId) => base.call(request, traceId),
    getCircuitBreakerState: () => base.getCircuitBreakerState(),
    getCurrentConcurrency: () => base.getCurrentConcurrency(),
    getPeakConcurrency: () => base.getPeakConcurrency(),
    getLastTraceId: () => base.getLastTraceId(),
    getRetryStats: () => base.getRetryStats(),
    getLastCircuitTransitionAt: () => base.getLastCircuitTransitionAt()
  };
};
