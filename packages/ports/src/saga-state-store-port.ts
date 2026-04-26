// Phase 9 / Step 3 — SagaStateStorePort 类型契约。
//
// SagaStateStorePort 承担《补充文档》§4.5 Saga 状态持久化的全部约束：
//   - 进程崩溃后必须能从持久化状态恢复当前推进位置（save/load 配对）
//   - 跨实例可见性（一个 Adapter 写、另一实例读到相同结果）
//   - 崩溃恢复扫描（listIncomplete 列出未完成的 saga）
//
// 设计裁决（详见 docs/decisions/0002-phase-9-saga-orchestration.md Step 3 段）：
//   - 裁决 1：4 方法接口（save / load / listIncomplete / delete）—— 仅承
//     载 §4.5 恢复语义，不预设运维查询便利方法（运维 Port 留 Phase 10+）
//   - 裁决 2：PersistedSagaState 10 字段（含 correlationId / traceId 但
//     不含 initialInput；理由见 ADR）
//   - 裁决 3 (β)：Saga 状态只写 SagaStateStore；审计事件由 SagaOrchestrator
//     （Step 6）显式写到 EventStore；两次写之间的不一致由编排器承担（避
//     免 1PC / 2PC 复杂度）
//   - 裁决 4：持久化契约独立函数 definePersistentSagaStateStoreContractTests
//     （元规则 E）
//   - 裁决 5：不引入 Probe（save/load/listIncomplete 接口本身已足够支撑契
//     约断言；克制 > 堆砌）
//
// PersistedSagaStateOverallStatus 与 SagaResultStatus 的关系：
//   两者**不复用**。SagaResultStatus 是"saga 结束时的最终结果"（4 值，含
//   timed_out 等终态），PersistedSagaState 是"任何时刻的运行时快照"，
//   含 SagaResultStatus 不含的过渡态（in_progress / compensating）。
//   元规则 B：本 Step 锁定的 6 值枚举一旦发布即冻结。

import type { Result, TraceId } from "@tianqi/shared";

import type { CorrelationId, SagaId, SagaStepStatusSnapshot } from "./saga-port.js";

// ============================================================
// 1. PersistedSagaStateOverallStatus —— Saga 运行时快照状态
// ============================================================

/**
 * Saga 在持久化快照中的整体状态（区别于 SagaResultStatus 的"结束时最终
 * 结果"）。本枚举一次性定义齐全（裁决 4 同型策略），避免后续 Step 因增
 * 删值破坏元规则 B。
 *
 * 状态语义：
 *   - "in_progress"：前向阶段进行中（至少一个 step "executing" / "succeeded"）
 *   - "completed"：全部 step succeeded，saga 完成；终态
 *   - "compensating"：补偿阶段进行中（至少一个 step "compensating"）
 *   - "compensated"：全部需补偿的 step compensated 完毕；终态
 *   - "partially_compensated"：补偿阶段结束但有 dead_lettered；终态
 *   - "timed_out"：编排器整体超时被中断；终态
 *
 * 终态：completed / compensated / partially_compensated / timed_out。
 * 过渡态：in_progress / compensating。
 *
 * listIncomplete() 返回**过渡态**的 saga 状态供崩溃恢复扫描使用。
 */
export type PersistedSagaStateOverallStatus =
  | "in_progress"
  | "completed"
  | "compensating"
  | "compensated"
  | "partially_compensated"
  | "timed_out";

// ============================================================
// 2. PersistedCompensationEntry —— 单 step 补偿上下文条目
// ============================================================

/**
 * Saga 中已 succeeded step 的补偿上下文条目。crash recovery 时编排器从
 * 这些条目恢复"补偿所需的最小信息集"（《§4.4》"compensate 不依赖进程
 * 内存"对齐——条目必须可序列化）。
 *
 * stepName：与 SagaStep.name 一致（kebab-case）。
 * compensationContext：execute 返回的 SagaStepExecution.compensationContext
 *   原值；类型 unknown（与 SagaCompensationContext 一致），运行时序列化
 *   性由契约测试 (definePersistentSagaStateStoreContractTests) 强制。
 */
export type PersistedCompensationEntry = {
  readonly stepName: string;
  readonly compensationContext: unknown;
};

// ============================================================
// 3. PersistedSagaState —— Saga 持久化快照
// ============================================================

/**
 * Saga 在 SagaStateStore 中的持久化形态。10 字段精简集（裁决 2 锁定）：
 *
 * 必含 8：
 *   - sagaId / sagaStartedAt / lastUpdatedAt
 *   - currentStepIndex / totalSteps
 *   - stepStatuses
 *   - compensationContexts
 *   - overallStatus
 *
 * 可选 2：
 *   - correlationId（跨进程关联，审计追责链关键）
 *   - traceId（《§9.1》要求所有持久化记录含 traceId 便于追踪）
 *
 * 不含 initialInput 等大对象/隐私敏感字段：
 *   - SagaInvocation 是 saga 启动**前置**载荷，应在 Step 6 编排器侧由
 *     Application 层独立持久化（命令存储），不与 Saga 状态混存
 *   - 大对象会让 saga_state 表行很大，索引性能下降
 *   - 隐私敏感字段（用户 PII）单独走脱敏管道（《§15.2》）
 */
export type PersistedSagaState = {
  readonly sagaId: SagaId;
  readonly sagaStartedAt: string; // ISO-8601 UTC
  readonly lastUpdatedAt: string; // ISO-8601 UTC
  readonly currentStepIndex: number;
  readonly totalSteps: number;
  readonly stepStatuses: ReadonlyArray<SagaStepStatusSnapshot>;
  readonly compensationContexts: ReadonlyArray<PersistedCompensationEntry>;
  readonly overallStatus: PersistedSagaStateOverallStatus;
  readonly correlationId: CorrelationId | null;
  readonly traceId: TraceId | null;
};

// ============================================================
// 4. SagaStateStoreError —— 错误信封
// ============================================================

/**
 * SagaStateStore 操作失败时返回的错误形状。
 *
 * §6.5 转译纪律延续：message 必须是领域级摘要，**严禁原文携带下游 SQL
 * 异常文本 / pg 错误码 / 网络异常文本**。code 限定 TQ-INF-* 字面量。
 *
 * 适用 code 集合（本 Step 引入与复用的）：
 *   - TQ-INF-009 POSTGRES_UNREACHABLE（Phase 8 既有，pg 连接失败时复用）
 *   - TQ-INF-019 SAGA_STATE_STORE_NOT_INITIALIZED（init 前调用）
 *   - TQ-INF-020 SAGA_STATE_STORE_ALREADY_SHUT_DOWN（shutdown 后调用）
 *   - TQ-INF-021 SAGA_STATE_STORE_SCHEMA_VERSION_MISMATCH（postgres 模式版本不匹配）
 */
export type SagaStateStoreError = {
  readonly message: string;
};

// ============================================================
// 5. SagaStateStorePort —— 4 方法接口
// ============================================================

/**
 * Saga 状态持久化 Port。负责把 PersistedSagaState 在崩溃恢复点写入并
 * 在恢复时读出。**不**承担审计/回放（EventStore 的职责，裁决 3 β）。
 *
 * 方法语义：
 *   - save：upsert by sagaId。同 sagaId 多次调用 last-write-wins（最新
 *     调用的 lastUpdatedAt / stepStatuses / compensationContexts 覆盖前
 *     一份）。Adapter 实现侧应保证 save 是**单条原子**（要么全写要么不
 *     写；postgres 用单 INSERT ... ON CONFLICT DO UPDATE）。
 *   - load：按 sagaId 读取；不存在返回 ok(null)；不抛错。
 *   - listIncomplete：返回 overallStatus ∈ {"in_progress", "compensating"}
 *     的 saga 列表。**不**返回终态 saga（不含 completed / compensated /
 *     partially_compensated / timed_out）。结果数组的顺序由 Adapter 实
 *     现决定（契约测试不假定特定顺序）。
 *   - delete：按 sagaId 删除；不存在时返回 ok（幂等）。Phase 9 默认不调
 *     用此方法（终态 saga 保留供事后审计/分析）；提供仅供 Phase 10+ 数
 *     据保留策略 / 测试清盘使用。
 */
export type SagaStateStorePort = {
  save(state: PersistedSagaState): Promise<Result<void, SagaStateStoreError>>;
  load(sagaId: SagaId): Promise<Result<PersistedSagaState | null, SagaStateStoreError>>;
  listIncomplete(): Promise<Result<ReadonlyArray<PersistedSagaState>, SagaStateStoreError>>;
  delete(sagaId: SagaId): Promise<Result<void, SagaStateStoreError>>;
};
