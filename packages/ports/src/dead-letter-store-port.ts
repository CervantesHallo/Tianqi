// Phase 9 / Step 4 — DeadLetterStorePort 类型契约。
//
// DeadLetterStorePort 承担《补充文档》§4.6 死信约束：
//   - 任何 saga step 在补偿失败后**必须**进入死信队列（非可选）
//   - 死信队列承载的元数据：sagaId / stepName / compensationContext /
//     failureChain / enqueuedAt（5 强制字段）
//   - 死信记录长期保留供合规审计 / 人工介入
//   - 人工处理动作必须产生审计事件（《§4.6》最后一段 + 《宪法》§15.1
//     双重审计）—— 但**审计事件写入是调用方（Step 9）职责**，不是
//     DeadLetterStore 的职责（元规则 F：Adapter 不跨 Adapter 调用）
//
// 设计裁决（详见 docs/decisions/0002 Step 4 段）：
//   - 裁决 1：DeadLetterEntry 13 字段（5 强制 + 8 扩展）
//   - 裁决 2 (α)：引入 DeadLetterEntryStatus 三态枚举（pending / processed
//     / archived）；DeadLetterStore 暴露 markAsProcessed 状态变更方法
//   - 裁决 3：DeadLetterStorePort 5 方法（enqueue / load / listPending
//     / listBySaga / markAsProcessed）
//   - 裁决 4：提供 listBySaga（Step 9 人工介入接口直接受益）
//   - 裁决 5：定义 definePersistentDeadLetterStoreContractTests（元规则 E）
//
// **特别约束**：
//   - failureChain 是数组（可承载"原因 → 中间原因 → 根本原因"链式结构），
//     但每环都必须是领域级摘要——《§6.5》转译纪律延续，不得原文携带 PG
//     错误码 / HTTP 状态 / 网络异常文本
//   - DeadLetterStore 不实现"清理 / 归档 / TTL"——这些是 Phase 10+ 责任
//   - DeadLetterStore 不实现 delete——死信记录长期保留（合规要求）

import type { Brand, Result, TraceId } from "@tianqi/shared";

import type { CorrelationId, SagaId } from "./saga-port.js";

// ============================================================
// 1. Brand 类型
// ============================================================

/**
 * 死信记录唯一标识。一个 SagaId 下可有多条 DeadLetterId（多步补偿失败 /
 * 同步重试都失败再次入队）。本 Step 由调用方（Step 9 编排器）生成，不
 * 在 Adapter 内部生成（保持 Port 纯粹）。
 */
export type DeadLetterId = Brand<string, "DeadLetterId">;

/**
 * 构造 DeadLetterId。空字符串 / 全空白会抛错（与 createSagaId 等姐妹工厂一致）。
 */
export const createDeadLetterId = (value: string): DeadLetterId => {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error("DeadLetterId must be a non-empty string");
  }
  return normalized as DeadLetterId;
};

// ============================================================
// 2. DeadLetterEntryStatus —— 死信记录状态三态
// ============================================================

/**
 * 死信记录状态。一次性定义齐全（裁决 2 同型策略），元规则 B 防止后续 Step
 * 改枚举值。
 *
 * 状态语义：
 *   - "pending"：新入队，等待人工介入。listPending 返回此态。
 *   - "processed"：人工已处理（处理结果由 processingNotes 记录；不区分
 *     成功/失败）。Step 9 调 markAsProcessed 时切换至此态。
 *   - "archived"：归档（合规保留期满后的运维操作）。本 Step **不**实现归档
 *     转换接口；保留枚举值供 Phase 10+ 引入归档转换 API 时使用，避免修改
 *     枚举（元规则 B）。
 *
 * 状态机：pending → processed → archived（单向；不可回退）。
 */
export type DeadLetterEntryStatus = "pending" | "processed" | "archived";

// ============================================================
// 3. DeadLetterEntry —— 死信记录
// ============================================================

/**
 * 单条死信记录。13 字段（5 强制《§4.6》 + 8 扩展）。
 *
 * 必含 5（《§4.6》强制）：
 *   - sagaId / stepName / compensationContext / failureChain / enqueuedAt
 *
 * 必含扩展 3：
 *   - entryId（主键；调用方生成保 Adapter 纯粹）
 *   - status（裁决 2 选 α 引入）
 *   - attemptCount（《§4.6》"补偿尝试次数"是死信入队元数据）
 *
 * 可选扩展 5：
 *   - correlationId / traceId（与 SagaStateStore 一致；审计追溯）
 *   - lastAttemptAt（最后一次补偿尝试时间；attemptCount 的伴生字段）
 *   - processedAt / processedBy / processingNotes（status === "processed"
 *     时由 markAsProcessed 填入；其他态为 null）
 *
 * **不含**：
 *   - input / output（业务数据；隐私 + 大对象顾虑）
 *   - retry policy / next retry at（重试策略不是死信的事——死信意味着重试已耗尽）
 */
export type DeadLetterEntry = {
  readonly entryId: DeadLetterId;
  readonly sagaId: SagaId;
  readonly stepName: string;
  readonly status: DeadLetterEntryStatus;
  readonly enqueuedAt: string; // ISO-8601 UTC
  readonly attemptCount: number;
  /**
   * 补偿上下文：execute 当时返回的 compensationContext。运行时 JSON 序列
   * 化由持久化契约测试 (definePersistentDeadLetterStoreContractTests) 强
   * 制可序列化；与 SagaCompensationContext 一致。
   */
  readonly compensationContext: unknown;
  /**
   * 失败原因链：每环是领域级摘要（《§6.5》转译纪律延续）。从最近一次失败
   * 到根本原因排序；数组首项是"最近一次补偿尝试的失败原因"，末项是"最
   * 早可追溯的根本原因"。
   *
   * **严禁**原文携带：PG 错误码 / HTTP 状态码（4xx/5xx）/ 网络异常名
   * （ECONNRESET / ENOTFOUND）/ SQL 文本片段。
   * 调用方负责把下游异常转译为 domain moniker（如 "compensation_unlock_unreachable"
   * 而非 "ECONNREFUSED"），再放入 failureChain。
   */
  readonly failureChain: ReadonlyArray<string>;
  readonly correlationId: CorrelationId | null;
  readonly traceId: TraceId | null;
  readonly lastAttemptAt: string | null; // ISO-8601 UTC
  readonly processedAt: string | null; // ISO-8601 UTC
  readonly processedBy: string | null;
  readonly processingNotes: string | null;
};

// ============================================================
// 4. DeadLetterStoreError —— 错误信封
// ============================================================

/**
 * DeadLetterStore 操作失败时返回的错误形状。
 *
 * §6.5 转译纪律延续：message 必须是领域级摘要，**严禁原文携带下游 SQL
 * 异常文本 / pg 错误码 / 网络异常文本**。
 *
 * 适用 code 集合：
 *   - TQ-INF-009 POSTGRES_UNREACHABLE（Phase 8 既有，pg 连接失败时复用）
 *   - TQ-INF-022 DEAD_LETTER_STORE_NOT_INITIALIZED（init 前调用）
 *   - TQ-INF-023 DEAD_LETTER_STORE_ALREADY_SHUT_DOWN（shutdown 后调用）
 *   - TQ-INF-024 DEAD_LETTER_STORE_SCHEMA_VERSION_MISMATCH（postgres 模式版本不匹配）
 */
export type DeadLetterStoreError = {
  readonly message: string;
};

// ============================================================
// 5. DeadLetterStorePort —— 5 方法接口
// ============================================================

/**
 * 死信存储 Port。承担《§4.6》死信约束的"存储 + 状态查询 + 状态变更"职责。
 * **不**承担：
 *   - 审计事件写入（调用方 Step 9 责任；元规则 F）
 *   - 死信清理 / 归档 / TTL（Phase 10+ 责任）
 *   - 死信删除（合规要求长期保留；不提供 delete）
 *   - 重试策略（死信意味着重试已耗尽；不在本 Port 范围）
 *
 * 方法语义：
 *   - enqueue：插入新死信记录；同 entryId 重复 enqueue 视为幂等冲突由
 *     Adapter 实现侧决定（postgres 通过 PRIMARY KEY 触发唯一性；memory
 *     使用 Map.has 检查）。建议调用方保证 entryId 唯一。
 *   - load：按 entryId 读取；不存在返回 ok(null)；不抛错。
 *   - listPending：返回 status === "pending" 的全部死信记录。结果数组的
 *     顺序由 Adapter 实现决定（契约测试不假定特定顺序）。
 *   - listBySaga：返回同 sagaId 的全部死信记录（不限状态）。供 Step 9
 *     人工介入接口在处理一笔死信前查看同 Saga 的全部死信。
 *   - markAsProcessed：把 status="pending" 的记录切换为 "processed"，
 *     同时填入 processedAt / processedBy / processingNotes。已是 "processed"
 *     时的语义由 Adapter 决定（建议幂等：再次调用相同参数无效果，参数不
 *     同时不允许覆写——但本 Step 选择"幂等覆写最近一次的处理元数据"以
 *     简化 Adapter 实现）。entryId 不存在时返回 ok（幂等；不抛错）。
 */
export type DeadLetterStorePort = {
  enqueue(entry: DeadLetterEntry): Promise<Result<void, DeadLetterStoreError>>;
  load(entryId: DeadLetterId): Promise<Result<DeadLetterEntry | null, DeadLetterStoreError>>;
  listPending(): Promise<Result<ReadonlyArray<DeadLetterEntry>, DeadLetterStoreError>>;
  listBySaga(
    sagaId: SagaId
  ): Promise<Result<ReadonlyArray<DeadLetterEntry>, DeadLetterStoreError>>;
  markAsProcessed(
    entryId: DeadLetterId,
    processedBy: string,
    processingNotes?: string
  ): Promise<Result<void, DeadLetterStoreError>>;
};
