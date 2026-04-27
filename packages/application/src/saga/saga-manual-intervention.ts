// Phase 9 / Step 9 — SagaManualIntervention 模块（人工介入接口 + 双重审计）。
//
// 落地《§4.6》死信处理 + 《§15.1》"手动干预操作必须双重审计"双约束。
// 性质与 Step 7 / Step 8 不同：本 Step 不是"接续增强"既有模块，而是
// 在 application 层新建独立模块，编排器对本模块**透明**——零 import
// SagaOrchestrator / 任何 saga-orchestrator.ts 内容（元规则 F 在 Phase 9
// 最后一次"独立编排"实战）。
//
// 设计裁决（详见 docs/decisions/0002 Step 9 段 + docs/phase9/09）：
//   - 裁决 1 (α)：模块归属 packages/application/src/saga/saga-manual-intervention.ts
//     与 saga-orchestrator.ts 同目录平级；扁平结构（宗旨第 5 条）
//   - 裁决 2：工厂闭包 createSagaManualIntervention(ports, options?) +
//     processDeadLetter 单方法接口（与 Step 6 SagaOrchestrator 风格一致）
//   - 裁决 3 (A + 简化 B)：双重审计 = 双事件（requested + applied）+ 双
//     签名（input.requestedBy + input.approvedBy 必须不同）
//   - 裁决 4 (N)：MANUAL_INTERVENTION_AUDIT_EVENT_TYPES 独立常量（不
//     共享 Step 6 锁定的 AUDIT_EVENT_TYPES 7 类；元规则 B 在审计层级）
//   - 裁决 5：仅新增 TQ-SAG-005（reason 字段承载 5 类 domain moniker；
//     惯例 K 第 11 次实战"必需"成立）
//   - 裁决 6 (III 分级)：requested 事件失败致命 / applied 事件失败降级
//     （已经 markAsProcessed 后审计补不上不应回滚状态破坏一致性）
//   - 裁决 7：unit ≤8 + 集成 ≤4（dead-letter-store-memory 真实 adapter）
//
// **§15.1 双重审计具体落地形态**：
//   1. 双签名（双权限确认）：input.requestedBy 与 input.approvedBy 必须
//      不同标识；同一人不能既请求又审批（防权限滥用）
//   2. 双事件（双过程审计）：
//      - REQUESTED 事件：操作开始的授权审计（含 requestedBy + approvedBy
//        + entryId 三方签名信息）
//      - APPLIED 事件：操作完成的留痕审计（含 processedAt + 操作结果）
//   两者结合让运维既能审视"操作权限"也能审视"操作过程"。
//
// **编排器透明性证明**（强制开局动作 6）：
//   本文件 import 列表仅含：@tianqi/contracts（错误码工厂）+ @tianqi/ports
//   （DeadLetterStore + AuditEventSink + 必要类型）+ @tianqi/shared（Result）。
//   零 import "./saga-orchestrator.js" / SagaOrchestrator / SagaOrchestratorPorts。
//   grep 验证位置：docs/phase9/09 §B.6。

import { sagaManualInterventionFailedError } from "@tianqi/contracts";
import { err, ok } from "@tianqi/shared";
import type { Result, TraceId } from "@tianqi/shared";

import type {
  AuditEventRecord,
  AuditEventSinkPort,
  CorrelationId,
  DeadLetterEntry,
  DeadLetterId,
  DeadLetterStorePort
} from "@tianqi/ports";

// ============================================================
// MANUAL_INTERVENTION_AUDIT_EVENT_TYPES —— 2 类独立常量（裁决 4 N）
// ============================================================
//
// 元规则 B 在审计层级：本 Step 锁定 2 个 eventType 字符串。后续 Step /
// Phase 10+ 新增类型必须经 ADR-0002 修订流程；既有 2 类的字符串永久冻结。
//
// **不**与 Step 6 锁定的 AUDIT_EVENT_TYPES 7 类共享同一常量——saga-
// orchestrator 自身发出的事件 vs 人工介入模块发出的事件在事件类型层级
// 显式分离，让运维 / 审计可按命名空间分组查询。
//
// 双事件 payload 字段（一旦发布即冻结）：
//   REQUESTED 事件 payload：
//     - entryId: DeadLetterId —— 死信记录主键
//     - requestedBy: string —— 操作请求人标识
//     - approvedBy: string —— 操作审批人标识（必与 requestedBy 不同）
//     - sagaId: SagaId —— 同步死信记录的 sagaId 便于追溯
//     - stepName: string —— 同步死信记录的失败 step 名
//   APPLIED 事件 payload：
//     - entryId: DeadLetterId
//     - requestedBy / approvedBy（与 requested 事件一致；冗余但便于按事件
//       独立审计无需 join）
//     - processedAt: string ISO-8601 —— 处理时刻
//     - processingNotes: string | null —— 处理备注
export const MANUAL_INTERVENTION_AUDIT_EVENT_TYPES = {
  /** 操作开始的授权审计（双签名信息已传入 + DeadLetterStore 状态尚未变更） */
  REQUESTED: "saga.manual_intervention.requested",
  /** 操作完成的留痕审计（DeadLetterStore.markAsProcessed 已成功调用） */
  APPLIED: "saga.manual_intervention.applied"
} as const;

export type ManualInterventionAuditEventType =
  (typeof MANUAL_INTERVENTION_AUDIT_EVENT_TYPES)[keyof typeof MANUAL_INTERVENTION_AUDIT_EVENT_TYPES];

// ============================================================
// 对外类型
// ============================================================

export type SagaManualInterventionPorts = {
  readonly deadLetterStore: DeadLetterStorePort;
  readonly auditEventSink: AuditEventSinkPort;
};

/**
 * 降级失败事件载荷（裁决 6 III 分级模式）。当 applied 审计事件 append
 * 失败时被调用（applied 失败是降级——状态已变更不应回滚；requested 失
 * 败是致命走 err 返回值）。
 */
export type ManualInterventionDegradedFailureEvent = {
  readonly kind: "applied-audit-append-failed";
  readonly entryId: DeadLetterId;
  readonly reason: string;
};

export type SagaManualInterventionOptions = {
  /**
   * 调用方提供的"当前时刻"获取器。便于测试注入 fake clock。
   * 默认 () => new Date()。
   */
  readonly clock?: () => Date;
  /**
   * 降级失败回调。applied 审计事件 append 失败时被调用（生产部署应注入
   * 指向运维告警系统的回调；测试场景可注入收集器验证降级行为）。
   * 默认 undefined（静默降级）。
   */
  readonly onDegradedFailure?: (event: ManualInterventionDegradedFailureEvent) => void;
};

/**
 * 人工介入处理死信记录的输入。
 *
 * 双签名约束（裁决 3 简化 B）：
 *   - requestedBy（请求人）与 approvedBy（审批人）必须是**不同的标识**
 *   - 编排器在 processDeadLetter 入口显式校验；不通过 → 立即返回
 *     TQ-SAG-005 reason "requestor_and_approver_must_differ"
 *   - 调用方（业务系统 / 运维 dashboard）负责确保两个字段映射到不同的
 *     真实人类操作员（譬如 OAuth subject 不同 / RBAC 角色不同）；
 *     编排器仅做字符串相等性校验（不解析背后的身份语义）
 *
 * processingNotes 是可选备注，会被同步写到：
 *   - DeadLetterStore.markAsProcessed 的 processingNotes 参数
 *   - APPLIED 审计事件 payload.processingNotes
 *   两处冗余便于运维独立查询。
 */
export type ProcessDeadLetterInput = {
  readonly entryId: DeadLetterId;
  readonly requestedBy: string;
  readonly approvedBy: string;
  readonly processingNotes?: string;
};

/**
 * 人工介入处理死信记录成功后的返回值。
 *
 * 双重审计的可观测性最小集：
 *   - entryId：处理目标
 *   - processedAt：DeadLetterStore.markAsProcessed 调用时刻（同写入审计
 *     APPLIED 事件 payload.processedAt）
 *   - appliedAuditWritten：APPLIED 审计事件是否成功写入。**false** 不
 *     代表处理失败——而是 applied 事件降级（裁决 6 III）；调用方据此
 *     判断是否需要补充审计。生产部署应注入 onDegradedFailure 让此
 *     场景被运维告警捕获。
 */
export type ProcessDeadLetterOutput = {
  readonly entryId: DeadLetterId;
  readonly processedAt: string;
  readonly appliedAuditWritten: boolean;
};

/**
 * 人工介入失败的错误信封。本模块所有 err 路径都以此形态返回；code 固
 * 定 "TQ-SAG-005"；reason 字段承载 domain moniker。
 *
 * 与 SagaPortError 平行（不复用 SagaPortError——后者是 step.execute /
 * compensate 失败信封；本模块是 application 层人工操作失败信封；语义
 * 不同保独立类型）。
 */
export type ManualInterventionError = {
  readonly code: "TQ-SAG-005";
  readonly entryId: DeadLetterId;
  readonly reason: string;
  readonly message: string;
  readonly cause?: unknown;
};

export type SagaManualIntervention = {
  /**
   * 处理一笔 pending 死信记录。完整流程（裁决 3 双重审计 + 裁决 6 III
   * 分级失败处置）：
   *
   *   1. 校验 input：requestedBy !== approvedBy（双签名第一道关卡）
   *      失败 → err TQ-SAG-005 reason="requestor_and_approver_must_differ"
   *   2. DeadLetterStore.load(entryId)
   *      失败 → err TQ-SAG-005 reason="dead_letter_load_failed"
   *      不存在 → err TQ-SAG-005 reason="dead_letter_entry_not_found"
   *      status !== "pending" → err TQ-SAG-005
   *        reason="dead_letter_entry_already_processed"（幂等保护——本模
   *        块不允许重复处理；DeadLetterStore.markAsProcessed 自身幂等覆
   *        写但 Step 9 模块层面拒绝以保双重审计的"一次操作"语义）
   *   3. 发 audit MANUAL_INTERVENTION_AUDIT_EVENT_TYPES.REQUESTED 事件
   *      （payload 含 entryId / requestedBy / approvedBy / sagaId / stepName）
   *      失败致命 → err TQ-SAG-005 reason="audit_request_event_failed"
   *      （操作未授权审计基础设施不可用，不应继续）
   *   4. DeadLetterStore.markAsProcessed(entryId, approvedBy, processingNotes)
   *      （processedBy = approvedBy 因为审批人是事实操作责任人；
   *       requestedBy 通过 audit event payload 完整保留）
   *      失败致命 → err TQ-SAG-005 reason="dead_letter_mark_as_processed_failed"
   *   5. 发 audit MANUAL_INTERVENTION_AUDIT_EVENT_TYPES.APPLIED 事件
   *      失败降级 → onDegradedFailure 触发；output.appliedAuditWritten = false；
   *      仍返回 ok（裁决 6 III：状态已变更不应回滚破坏一致性）
   *   6. 返回 ProcessDeadLetterOutput
   */
  processDeadLetter(
    input: ProcessDeadLetterInput
  ): Promise<Result<ProcessDeadLetterOutput, ManualInterventionError>>;
};

// ============================================================
// 工厂闭包
// ============================================================

const buildError = (
  entryId: DeadLetterId,
  reason: string,
  cause?: unknown
): ManualInterventionError => ({
  code: "TQ-SAG-005",
  entryId,
  reason,
  message: "Saga manual intervention failed",
  cause
});

export const createSagaManualIntervention = (
  ports: SagaManualInterventionPorts,
  options: SagaManualInterventionOptions = {}
): SagaManualIntervention => {
  const clock = options.clock ?? ((): Date => new Date());
  const onDegradedFailure = options.onDegradedFailure;

  /**
   * 构造 audit event 信封。traceId / correlationId 来自死信记录本身
   * （死信记录在入队时已记录这两个字段；人工介入审计沿用同一 trace 链
   * 与《§14.1》结构化日志要求一致）。entry === null 时 traceId 退回
   * 模块内合成值（仅 requested 事件早于 load 之后路径使用；当前流程不会
   * 出现 entry === null 的 audit 触发）。
   */
  const buildAuditEvent = (
    eventType: ManualInterventionAuditEventType,
    entry: DeadLetterEntry,
    payload: Record<string, unknown>
  ): AuditEventRecord => ({
    eventType,
    occurredAt: clock().toISOString(),
    traceId: (entry.traceId ?? ("trace-manual-intervention" as TraceId)) as string,
    payload: {
      entryId: entry.entryId,
      sagaId: entry.sagaId,
      stepName: entry.stepName,
      ...payload
    }
  });

  const processDeadLetter = async (
    input: ProcessDeadLetterInput
  ): Promise<Result<ProcessDeadLetterOutput, ManualInterventionError>> => {
    // 步骤 1：双签名校验（裁决 3 简化 B 第一道关卡）
    if (input.requestedBy === input.approvedBy) {
      return err(
        buildError(input.entryId, "requestor_and_approver_must_differ")
      );
    }

    // 步骤 2：load 死信记录 + 幂等保护
    const loadResult = await ports.deadLetterStore.load(input.entryId);
    if (!loadResult.ok) {
      return err(
        buildError(input.entryId, "dead_letter_load_failed", loadResult.error)
      );
    }
    const entry = loadResult.value;
    if (entry === null) {
      return err(buildError(input.entryId, "dead_letter_entry_not_found"));
    }
    if (entry.status !== "pending") {
      // 幂等保护：本模块不允许重复处理（保双重审计"一次操作"语义）。
      // DeadLetterStore.markAsProcessed 自身幂等覆写但 Step 9 模块层面拒绝。
      return err(
        buildError(input.entryId, "dead_letter_entry_already_processed")
      );
    }

    // 步骤 3：发 REQUESTED 审计事件（裁决 6 III 致命级失败处置）
    const requestedEvent = buildAuditEvent(
      MANUAL_INTERVENTION_AUDIT_EVENT_TYPES.REQUESTED,
      entry,
      {
        requestedBy: input.requestedBy,
        approvedBy: input.approvedBy
      }
    );
    try {
      const requestedAppendResult = await ports.auditEventSink.append(requestedEvent);
      if (!requestedAppendResult.ok) {
        return err(
          buildError(
            input.entryId,
            "audit_request_event_failed",
            requestedAppendResult.error
          )
        );
      }
    } catch (cause) {
      return err(
        buildError(input.entryId, "audit_request_event_failed", cause)
      );
    }

    // 步骤 4：DeadLetterStore.markAsProcessed（裁决 6 III 致命级）
    // processedBy = approvedBy（审批人是事实操作责任人；
    // requestedBy 通过 audit event payload 完整保留）
    const markResult = await ports.deadLetterStore.markAsProcessed(
      input.entryId,
      input.approvedBy,
      input.processingNotes
    );
    if (!markResult.ok) {
      return err(
        buildError(
          input.entryId,
          "dead_letter_mark_as_processed_failed",
          markResult.error
        )
      );
    }

    const processedAt = clock().toISOString();

    // 步骤 5：发 APPLIED 审计事件（裁决 6 III 降级级失败处置）
    let appliedAuditWritten = true;
    const appliedEvent = buildAuditEvent(
      MANUAL_INTERVENTION_AUDIT_EVENT_TYPES.APPLIED,
      entry,
      {
        requestedBy: input.requestedBy,
        approvedBy: input.approvedBy,
        processedAt,
        processingNotes: input.processingNotes ?? null
      }
    );
    try {
      const appliedAppendResult = await ports.auditEventSink.append(appliedEvent);
      if (!appliedAppendResult.ok) {
        appliedAuditWritten = false;
        onDegradedFailure?.({
          kind: "applied-audit-append-failed",
          entryId: input.entryId,
          reason: appliedAppendResult.error.message
        });
      }
    } catch (cause) {
      appliedAuditWritten = false;
      onDegradedFailure?.({
        kind: "applied-audit-append-failed",
        entryId: input.entryId,
        reason: cause instanceof Error ? cause.name : "unknown_failure"
      });
    }

    return ok({
      entryId: input.entryId,
      processedAt,
      appliedAuditWritten
    });
  };

  return { processDeadLetter };
};

// ============================================================
// 错误码工厂转出（便于业务层将 ManualInterventionError 转为 SagaError class）
// ============================================================
//
// 业务层可调用此函数把本模块返回的扁平 ManualInterventionError 升级为
// 标准 SagaError class（保持与其他 TQ-SAG-* 错误处理路径一致）。
// 本模块自身不消费 SagaError class 是为了保 Port 层的纯数据信封风格
// （与 SagaPortError 平行）。
export const toSagaError = (error: ManualInterventionError): ReturnType<typeof sagaManualInterventionFailedError> =>
  sagaManualInterventionFailedError(
    error.entryId,
    error.reason,
    error.cause instanceof Error ? error.cause : undefined
  );

// 导出类型给消费方做精确类型推断
export type { CorrelationId };
