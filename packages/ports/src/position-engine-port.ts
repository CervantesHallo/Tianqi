import type { Result, TraceId } from "@tianqi/shared";

// PositionEnginePort — Tianqi 与持仓引擎（Position）外部服务的抽象接口。
//
// META-RULE A 处置：与 Step 13 / Step 15 一致——Phase 1-7 未冻结此 Port，本 Step
// 作为首次引入；不修改任何既有 Port 签名。Sprint E 的每个业务 Engine 都在自己的
// Step 中按这一模式新增 Port，互不依赖。
//
// 业务范围：仓位生命周期管理（开仓 / 加减仓 / 平仓 / 查询单仓位 / 列出账户全部
// 持仓）。共 5 个业务方法——3 写 + 2 读，覆盖一个账户从"建仓→维护→平仓"的完整
// 路径，不冗余、不收口于"最小可工作"以下。

// -- 领域原语（Branded types） ---------------------------------------------------------
type Brand<T, B> = T & { readonly __brand: B };

export type PositionAccountId = Brand<string, "PositionAccountId">;
export type PositionId = Brand<string, "PositionId">;
export type PositionSize = Brand<number, "PositionSize">;
export type PositionSide = "long" | "short";

export const createPositionAccountId = (value: string): PositionAccountId => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("PositionAccountId must be a non-empty string");
  }
  return value as PositionAccountId;
};

export const createPositionId = (value: string): PositionId => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("PositionId must be a non-empty string");
  }
  return value as PositionId;
};

export const createPositionSize = (value: number): PositionSize => {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new Error("PositionSize must be a non-negative finite number");
  }
  return value as PositionSize;
};

// -- 业务方法请求/响应类型 ------------------------------------------------------------

export type QueryPositionRequest = {
  readonly accountId: PositionAccountId;
  readonly symbol: string;
  readonly traceId?: TraceId;
};

export type QueryPositionResponse = {
  readonly accountId: PositionAccountId;
  readonly symbol: string;
  // null 表示该 (accountId, symbol) 当前无持仓。Adapter 严格区分 null 与缺失字段：
  // 下游 200 + body { positionId: null, ... } 是合法响应；body 缺失 positionId 字段
  // 是 schema 违反 → TQ-CON-011。
  readonly positionId: PositionId | null;
  readonly side: PositionSide | null;
  readonly size: PositionSize;
  readonly queriedAt: string;
};

export type OpenPositionRequest = {
  readonly accountId: PositionAccountId;
  readonly symbol: string;
  readonly side: PositionSide;
  readonly size: PositionSize;
  readonly idempotencyKey: string;
  readonly traceId?: TraceId;
};

export type OpenPositionResponse = {
  readonly positionId: PositionId;
  readonly accountId: PositionAccountId;
  readonly symbol: string;
  readonly side: PositionSide;
  readonly size: PositionSize;
  readonly openedAt: string;
};

export type AdjustPositionRequest = {
  readonly positionId: PositionId;
  // deltaSize 是有符号增量：正值加仓，负值减仓。绝对值不超过当前仓位绝对值——
  // 越界由下游拒绝（→ TQ-INF-017 invalid_request）。
  readonly deltaSize: number;
  readonly idempotencyKey: string;
  readonly traceId?: TraceId;
};

export type AdjustPositionResponse = {
  readonly positionId: PositionId;
  readonly side: PositionSide;
  readonly size: PositionSize;
  readonly adjustedAt: string;
};

export type ClosePositionRequest = {
  readonly positionId: PositionId;
  readonly idempotencyKey: string;
  readonly traceId?: TraceId;
};

export type ClosePositionResponse = {
  readonly positionId: PositionId;
  readonly closedSize: PositionSize;
  readonly closedAt: string;
};

export type ListOpenPositionsRequest = {
  readonly accountId: PositionAccountId;
  readonly traceId?: TraceId;
};

export type OpenPositionSummary = {
  readonly positionId: PositionId;
  readonly symbol: string;
  readonly side: PositionSide;
  readonly size: PositionSize;
};

export type ListOpenPositionsResponse = {
  readonly accountId: PositionAccountId;
  readonly positions: readonly OpenPositionSummary[];
  readonly queriedAt: string;
};

// -- Port 错误类型 --------------------------------------------------------------------

export type PositionEnginePortErrorCode =
  | "TQ-INF-003"
  | "TQ-INF-004"
  | "TQ-INF-013"
  | "TQ-INF-014"
  | "TQ-INF-015"
  | "TQ-INF-016"
  | "TQ-INF-017"
  | "TQ-INF-018"
  | "TQ-CON-011";

export type PositionEnginePortError = {
  readonly code: PositionEnginePortErrorCode;
  readonly message: string;
  readonly context: Readonly<Record<string, unknown>>;
};

// -- Port 接口 ------------------------------------------------------------------------

export type PositionEnginePort = {
  queryPosition(
    request: QueryPositionRequest
  ): Promise<Result<QueryPositionResponse, PositionEnginePortError>>;
  openPosition(
    request: OpenPositionRequest
  ): Promise<Result<OpenPositionResponse, PositionEnginePortError>>;
  adjustPosition(
    request: AdjustPositionRequest
  ): Promise<Result<AdjustPositionResponse, PositionEnginePortError>>;
  closePosition(
    request: ClosePositionRequest
  ): Promise<Result<ClosePositionResponse, PositionEnginePortError>>;
  listOpenPositions(
    request: ListOpenPositionsRequest
  ): Promise<Result<ListOpenPositionsResponse, PositionEnginePortError>>;
};
