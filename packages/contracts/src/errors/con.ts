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

export const eventSchemaViolationError = (
  fieldName: string,
  reason: string,
  cause?: Error
): Phase8ContractError =>
  new Phase8ContractError(
    ERROR_CODES.EVENT_SCHEMA_VIOLATION,
    "Event schema violation",
    {
      fieldName,
      reason
    },
    cause
  );

// Adapter-layer "config version not found" — distinct from TQ-POL-007 which covers the
// Policy-layer diagnostic. The Adapter returns this when asked for a version it never
// persisted (e.g. rollback target not loaded, getByVersion for an unknown version). Keeping
// the adapter-layer semantics in TQ-CON-* respects layer hygiene: Adapters never mint
// Policy-layer codes, and the two diagnostic paths (check storage vs. check caller)
// diverge enough to warrant distinct codes even though their surface message is similar.
export const adapterConfigVersionNotFoundError = (
  adapterName: string,
  requestedVersion: number,
  cause?: Error
): Phase8ContractError =>
  new Phase8ContractError(
    ERROR_CODES.ADAPTER_CONFIG_VERSION_NOT_FOUND,
    "Config version not found in adapter storage",
    {
      adapterName,
      requestedVersion
    },
    cause
  );

// Triggered when the Adapter atomically couples "activate new version" with "append an
// audit event" and the audit append fails. The Adapter MUST rollback the activation so
// the active pointer never outruns the audit trail; this error flags that rollback.
// Note: this lives in TQ-CON-* rather than TQ-SAG-* because the Adapter is not a Saga
// coordinator — it just preserves a single-Adapter invariant. TQ-SAG-* is reserved for
// cross-step, cross-Adapter workflow failures.
export const adapterConfigActivationAuditFailedError = (
  adapterName: string,
  attemptedVersion: number,
  rolledBackTo: number,
  cause?: Error
): Phase8ContractError =>
  new Phase8ContractError(
    ERROR_CODES.ADAPTER_CONFIG_ACTIVATION_AUDIT_FAILED,
    "Config activation rolled back because audit append failed",
    {
      adapterName,
      attemptedVersion,
      rolledBackTo
    },
    cause
  );

// Config-file adapter specific: YAML parsed successfully but structurally did not match
// the Adapter's expected shape (root `version` missing/non-integer, `values` missing/
// non-object, etc). This is distinct from TQ-CON-005 EVENT_SCHEMA_VIOLATION because the
// remediation corpus is completely different — Config schemas are operator-facing YAML
// documented for humans to hand-edit, while event schemas are program-generated JSON
// whose docs live in the domain-event package.
export const configFileSchemaInvalidError = (
  adapterName: string,
  filePath: string,
  reason: string,
  cause?: Error
): Phase8ContractError =>
  new Phase8ContractError(
    ERROR_CODES.CONFIG_FILE_SCHEMA_INVALID,
    "Config file schema is invalid",
    {
      adapterName,
      filePath,
      reason
    },
    cause
  );
