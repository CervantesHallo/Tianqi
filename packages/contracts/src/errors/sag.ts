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
