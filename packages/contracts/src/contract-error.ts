import { ERROR_CODES } from "./error-code.js";
import type { ContractErrorCode } from "./error-code.js";

export type ContractErrorContext = {
  readonly reason: string;
  readonly details?: Record<string, string>;
};

export class ContractError extends Error {
  public readonly code: ContractErrorCode;
  public readonly context: ContractErrorContext;

  public constructor(code: ContractErrorCode, message: string, context: ContractErrorContext) {
    super(message);
    this.name = "ContractError";
    this.code = code;
    this.context = context;
  }
}

export const contractRequiredFieldMissingError = (fieldName: string): ContractError =>
  new ContractError(
    ERROR_CODES.CONTRACT_REQUIRED_FIELD_MISSING,
    "Domain event envelope required field missing",
    {
      reason: "Required contract field is missing or empty",
      details: { fieldName }
    }
  );

export const contractInvalidFieldFormatError = (
  fieldName: string,
  expectedFormat: string
): ContractError =>
  new ContractError(ERROR_CODES.CONTRACT_INVALID_FIELD_FORMAT, "Contract field format is invalid", {
    reason: "Contract field does not match expected format",
    details: {
      fieldName,
      expectedFormat
    }
  });
