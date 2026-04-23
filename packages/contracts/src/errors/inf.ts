import { ERROR_CODES } from "../error-code.js";
import type { InfrastructureErrorCode } from "../error-code.js";
import { ERROR_LAYERS } from "./error-layer.js";
import type { ErrorLayer, TianqiErrorContext } from "./error-layer.js";

export class InfrastructureError extends Error {
  public readonly code: InfrastructureErrorCode;
  public readonly layer: ErrorLayer;
  public readonly context: TianqiErrorContext;
  public override readonly cause?: Error | InfrastructureError;

  public constructor(
    code: InfrastructureErrorCode,
    message: string,
    context: TianqiErrorContext,
    cause?: Error | InfrastructureError
  ) {
    super(message);
    this.name = "InfrastructureError";
    this.code = code;
    this.layer = ERROR_LAYERS.INFRASTRUCTURE;
    this.context = context;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export const adapterInitializationFailedError = (
  adapterName: string,
  reason: string,
  cause?: Error
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.ADAPTER_INITIALIZATION_FAILED,
    "Adapter initialization failed",
    {
      adapterName,
      reason
    },
    cause
  );

export const eventStoreNotInitializedError = (
  adapterName: string,
  attemptedAction: string
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.EVENT_STORE_NOT_INITIALIZED,
    "Event store adapter is not initialized",
    {
      adapterName,
      attemptedAction
    }
  );

export const eventStoreAlreadyShutDownError = (
  adapterName: string,
  attemptedAction: string
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.EVENT_STORE_ALREADY_SHUT_DOWN,
    "Event store adapter has already been shut down",
    {
      adapterName,
      attemptedAction
    }
  );
