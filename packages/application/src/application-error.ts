import { ERROR_CODES } from "@tianqi/contracts";
import type { ErrorCode } from "@tianqi/contracts";
import type { ContractError } from "@tianqi/contracts";
import type { DomainError } from "@tianqi/domain";

export type ApplicationErrorSource = "application" | "domain" | "contracts";

export type ApplicationError = {
  readonly code: ErrorCode;
  readonly message: string;
  readonly source: ApplicationErrorSource;
  readonly reason: string;
  readonly details?: Record<string, string>;
};

export const invalidApplicationCommandError = (
  reason: string,
  details?: Record<string, string>
): ApplicationError =>
  details
    ? {
        code: ERROR_CODES.APPLICATION_COMMAND_INVALID,
        message: "Application command is invalid",
        source: "application",
        reason,
        details
      }
    : {
        code: ERROR_CODES.APPLICATION_COMMAND_INVALID,
        message: "Application command is invalid",
        source: "application",
        reason
      };

export const idempotencyConflictError = (
  reason: string,
  details?: Record<string, string>
): ApplicationError =>
  details
    ? {
        code: ERROR_CODES.APPLICATION_CONFLICT,
        message: "Application command conflicts with existing execution",
        source: "application",
        reason,
        details
      }
    : {
        code: ERROR_CODES.APPLICATION_CONFLICT,
        message: "Application command conflicts with existing execution",
        source: "application",
        reason
      };

export const resourceNotFoundError = (
  reason: string,
  details?: Record<string, string>
): ApplicationError =>
  details
    ? {
        code: ERROR_CODES.APPLICATION_RESOURCE_NOT_FOUND,
        message: "Application resource not found",
        source: "application",
        reason,
        details
      }
    : {
        code: ERROR_CODES.APPLICATION_RESOURCE_NOT_FOUND,
        message: "Application resource not found",
        source: "application",
        reason
      };

export const dependencyFailureError = (
  reason: string,
  details?: Record<string, string>
): ApplicationError =>
  details
    ? {
        code: ERROR_CODES.APPLICATION_DEPENDENCY_FAILURE,
        message: "Application dependency call failed",
        source: "application",
        reason,
        details
      }
    : {
        code: ERROR_CODES.APPLICATION_DEPENDENCY_FAILURE,
        message: "Application dependency call failed",
        source: "application",
        reason
      };

export const publishFailureError = (
  reason: string,
  details?: Record<string, string>
): ApplicationError =>
  details
    ? {
        code: ERROR_CODES.APPLICATION_PUBLISH_FAILED,
        message: "Application event publish failed",
        source: "application",
        reason,
        details
      }
    : {
        code: ERROR_CODES.APPLICATION_PUBLISH_FAILED,
        message: "Application event publish failed",
        source: "application",
        reason
      };

export const duplicateResultReferenceUnavailableError = (
  reason: string,
  details?: Record<string, string>
): ApplicationError =>
  details
    ? {
        code: ERROR_CODES.APPLICATION_DUPLICATE_RESULT_REFERENCE_UNAVAILABLE,
        message: "Duplicate request has no reusable result reference",
        source: "application",
        reason,
        details
      }
    : {
        code: ERROR_CODES.APPLICATION_DUPLICATE_RESULT_REFERENCE_UNAVAILABLE,
        message: "Duplicate request has no reusable result reference",
        source: "application",
        reason
      };

export const snapshotVersionMissingError = (
  reason: string,
  details?: Record<string, string>
): ApplicationError =>
  details
    ? {
        code: ERROR_CODES.APPLICATION_SNAPSHOT_VERSION_MISSING,
        message: "Snapshot schema version is missing",
        source: "application",
        reason,
        details
      }
    : {
        code: ERROR_CODES.APPLICATION_SNAPSHOT_VERSION_MISSING,
        message: "Snapshot schema version is missing",
        source: "application",
        reason
      };

export const snapshotVersionUnsupportedError = (
  reason: string,
  details?: Record<string, string>
): ApplicationError =>
  details
    ? {
        code: ERROR_CODES.APPLICATION_SNAPSHOT_VERSION_UNSUPPORTED,
        message: "Snapshot schema version is unsupported",
        source: "application",
        reason,
        details
      }
    : {
        code: ERROR_CODES.APPLICATION_SNAPSHOT_VERSION_UNSUPPORTED,
        message: "Snapshot schema version is unsupported",
        source: "application",
        reason
      };

export const fromDomainError = (error: DomainError): ApplicationError =>
  error.context.details
    ? {
        code: error.code,
        message: error.message,
        source: "domain",
        reason: error.context.reason,
        details: error.context.details
      }
    : {
        code: error.code,
        message: error.message,
        source: "domain",
        reason: error.context.reason
      };

export const fromContractError = (error: ContractError): ApplicationError =>
  error.context.details
    ? {
        code: error.code,
        message: error.message,
        source: "contracts",
        reason: error.context.reason,
        details: error.context.details
      }
    : {
        code: error.code,
        message: error.message,
        source: "contracts",
        reason: error.context.reason
      };
