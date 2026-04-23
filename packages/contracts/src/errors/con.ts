import { ERROR_CODES } from "../error-code.js";
import type { ContractErrorCode } from "../error-code.js";
import { ERROR_LAYERS } from "./error-layer.js";
import type { ErrorLayer, TianqiErrorContext } from "./error-layer.js";

export class Phase8ContractError extends Error {
  public readonly code: ContractErrorCode;
  public readonly layer: ErrorLayer;
  public readonly context: TianqiErrorContext;
  public override readonly cause?: Error | Phase8ContractError;

  public constructor(
    code: ContractErrorCode,
    message: string,
    context: TianqiErrorContext,
    cause?: Error | Phase8ContractError
  ) {
    super(message);
    this.name = "Phase8ContractError";
    this.code = code;
    this.layer = ERROR_LAYERS.CONTRACT;
    this.context = context;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export const adapterContractTestViolationError = (
  adapterName: string,
  suiteName: string,
  reason: string,
  cause?: Error
): Phase8ContractError =>
  new Phase8ContractError(
    ERROR_CODES.ADAPTER_CONTRACT_TEST_VIOLATION,
    "Adapter violated a shared contract test",
    {
      adapterName,
      suiteName,
      reason
    },
    cause
  );
