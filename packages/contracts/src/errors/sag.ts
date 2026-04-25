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
