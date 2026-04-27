import { ERROR_CODES } from "../error-code.js";
import type { SagaErrorCode } from "../error-code.js";
import { ERROR_LAYERS } from "./error-layer.js";
import type { ErrorLayer, TianqiErrorContext } from "./error-layer.js";

export class SagaError extends Error {
  public readonly code: SagaErrorCode;
  public readonly layer: ErrorLayer;
  public readonly context: TianqiErrorContext;
  public override readonly cause?: Error | SagaError;

  public constructor(
    code: SagaErrorCode,
    message: string,
    context: TianqiErrorContext,
    cause?: Error | SagaError
  ) {
    super(message);
    this.name = "SagaError";
    this.code = code;
    this.layer = ERROR_LAYERS.SAGA;
    this.context = context;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export const sagaStepTimeoutError = (stepId: string, timeoutMs: number, cause?: Error): SagaError =>
  new SagaError(
    ERROR_CODES.SAGA_STEP_TIMEOUT,
    "Saga step exceeded its timeout budget",
    {
      stepId,
      timeoutMs
    },
    cause
  );

// Phase 9 / Step 1 — TQ-SAG-002 / TQ-SAG-003 工厂。
// 接口契约层面的最小集（惯例 K）：
//   - TQ-SAG-002：execute 失败的通用包装（业务逻辑 / 下游不可用 / 校验失败）
//   - TQ-SAG-003：compensate 失败 → 触发死信队列入队（《§4.5》）
// 后续 Step 6+（编排器）可能引入更多 TQ-SAG-* 码；本 Step 仅引入"接口签名
// 直接需要表达"的两条。
//
// §6.5 纪律延续：
//   - message 必须是领域级摘要，不得透出下游异常原文
//   - cause 是诊断辅助，工厂参数标记为 ?cause 让调用方决定是否附带
//   - context 字段集合刻意保持精简（sagaId / stepName / 必要附加信息），
//     避免在错误链路上耦合 saga 全量上下文（运行时由编排器在审计中独立记录）

export const sagaStepExecutionFailedError = (
  sagaId: string,
  stepName: string,
  reason: string,
  cause?: Error
): SagaError =>
  new SagaError(
    ERROR_CODES.SAGA_STEP_EXECUTION_FAILED,
    "Saga step execution failed",
    {
      sagaId,
      stepName,
      reason
    },
    cause
  );

export const sagaStepCompensationFailedError = (
  sagaId: string,
  stepName: string,
  reason: string,
  cause?: Error
): SagaError =>
  new SagaError(
    ERROR_CODES.SAGA_STEP_COMPENSATION_FAILED,
    "Saga step compensation failed",
    {
      sagaId,
      stepName,
      reason
    },
    cause
  );

// Phase 9 / Step 9 — TQ-SAG-005 工厂。
// 人工介入处理死信记录失败的通用包装。本错误码统一承载多种 reason
// （moniker）：
//   - "requestor_and_approver_must_differ"：双签名校验失败
//     （input.requestedBy === input.approvedBy）
//   - "audit_request_event_failed"：requested 审计事件写入失败（致命；
//     操作未授权不能继续）
//   - "dead_letter_entry_not_found"：entry 不存在
//   - "dead_letter_entry_already_processed"：entry 已被处理（status !==
//     "pending"；幂等保护）
//   - "dead_letter_mark_as_processed_failed"：DeadLetterStore.markAsProcessed
//     调用失败
//
// 惯例 K 第 11 次实战——"必需"成立证据：
//   1. 业务语义独立——"人工介入"是与 saga step / compensation / 整体
//      超时不同的运维路径，运维监控独立计数
//   2. message moniker 表达细分故障类型——保持单一码 + reason 字段细分
//      （避免错误码爆炸违反"克制"）
//   3. 与 §15.1 双重审计绑定的运维流程：当 TQ-SAG-005 出现时运维必查
//      "双签名是否合法 / requested 事件是否存在 / 是否被重复处理"——
//      错误码本身就是运维 runbook 入口
//
// §6.5 转译纪律延续：reason moniker 是领域语义槽位，不携带原始异常文本；
// cause 是诊断辅助仅供编排器内部审计。
export const sagaManualInterventionFailedError = (
  entryId: string,
  reason: string,
  cause?: Error
): SagaError =>
  new SagaError(
    ERROR_CODES.SAGA_MANUAL_INTERVENTION_FAILED,
    "Saga manual intervention failed",
    {
      entryId,
      reason
    },
    cause
  );

// Phase 9 / Step 8 — TQ-SAG-004 工厂。
// 整体 Saga 超时与单 Step 超时（TQ-SAG-001）在运维监控上需要独立计数
// （《§14.2》metrics）：
//   - TQ-SAG-001：单 step.execute / step.compensate 超过 effectiveStepTimeoutMs
//   - TQ-SAG-004：整个 saga 在编排器视角下的总耗时超过 defaultSagaTimeoutMs
//
// 惯例 K 第 10 次实战："必需"成立：
//   1. 运维语义独立——整体超时与单步超时根因不同（前者业务流程过长 /
//      后者下游单点慢）
//   2. metrics 维度独立——告警与 SLO 指标分别 owner（业务团队 / 平台团队）
//   3. 终态映射独立——TQ-SAG-001 触发后 saga 仍可能 compensated 完毕；
//      TQ-SAG-004 触发后 saga 终态固定为 timed_out / partially_compensated
//      / compensated（裁决 3 R 精细模式）。
//
// §6.5 纪律延续：message 领域级摘要"saga overall execution time exceeded"
// 不透下游异常文本；context 含 elapsed + configuredSagaTimeoutMs + 末次
// 执行的 step 名称便于运维定位"saga 卡在哪一步触发整体超时"。
export const sagaOverallTimedOutError = (
  sagaId: string,
  elapsedMs: number,
  configuredSagaTimeoutMs: number,
  lastExecutingStepName: string,
  cause?: Error
): SagaError =>
  new SagaError(
    ERROR_CODES.SAGA_OVERALL_TIMED_OUT,
    "Saga overall execution time exceeded",
    {
      sagaId,
      elapsedMs,
      configuredSagaTimeoutMs,
      lastExecutingStepName
    },
    cause
  );
