import { describe, expect, it } from "vitest";

import { ERROR_CODES } from "../error-code.js";
import {
  adapterConfigActivationAuditFailedError,
  adapterConfigVersionNotFoundError,
  adapterContractTestViolationError,
  Phase8ContractError
} from "./con.js";
import { ERROR_LAYERS } from "./error-layer.js";

describe("TQ-CON error namespace (Phase 8 structured class)", () => {
  it("constructs the TQ-CON-004 sample via factory", () => {
    const error = adapterContractTestViolationError(
      "event-store-sqlite",
      "append-then-read",
      "sequenceNumber not monotonic"
    );
    expect(error).toBeInstanceOf(Phase8ContractError);
    expect(error.code).toBe(ERROR_CODES.ADAPTER_CONTRACT_TEST_VIOLATION);
    expect(error.code).toBe("TQ-CON-004");
    expect(error.layer).toBe(ERROR_LAYERS.CONTRACT);
    expect(error.context).toEqual({
      adapterName: "event-store-sqlite",
      suiteName: "append-then-read",
      reason: "sequenceNumber not monotonic"
    });
  });

  it("marks every Phase8ContractError with layer=contract", () => {
    const error = new Phase8ContractError(ERROR_CODES.ADAPTER_CONTRACT_TEST_VIOLATION, "manual", {
      adapterName: "x",
      suiteName: "y",
      reason: "z"
    });
    expect(error.layer).toBe("contract");
  });

  it("preserves existing Phase 1-7 TQ-CON codes unchanged", () => {
    expect(ERROR_CODES.CONTRACT_VERSION_INCOMPATIBLE).toBe("TQ-CON-001");
    expect(ERROR_CODES.CONTRACT_REQUIRED_FIELD_MISSING).toBe("TQ-CON-002");
    expect(ERROR_CODES.CONTRACT_INVALID_FIELD_FORMAT).toBe("TQ-CON-003");
  });

  it("rejects non-TQ-CON codes at the type layer", () => {
    // @ts-expect-error — TQ-SAG-001 cannot be assigned to a ContractErrorCode slot
    const invalid = new Phase8ContractError(ERROR_CODES.SAGA_STEP_TIMEOUT, "wrong", {});
    expect(invalid).toBeInstanceOf(Phase8ContractError);
  });

  it("constructs the TQ-CON-006 adapter-layer config-version-not-found via factory", () => {
    const error = adapterConfigVersionNotFoundError("reference-config", 42);
    expect(error).toBeInstanceOf(Phase8ContractError);
    expect(error.code).toBe(ERROR_CODES.ADAPTER_CONFIG_VERSION_NOT_FOUND);
    expect(error.code).toBe("TQ-CON-006");
    expect(error.layer).toBe(ERROR_LAYERS.CONTRACT);
    expect(error.context).toEqual({
      adapterName: "reference-config",
      requestedVersion: 42
    });
  });

  it("distinguishes TQ-CON-006 from the frozen policy-layer TQ-POL-007", () => {
    // Convention K applied: TQ-POL-007 covers the Policy caller's diagnostic path, and
    // TQ-CON-006 covers the Adapter storage lookup path. Both carry "version not found"
    // semantics but resolve through different remediation tool-chains, so they stay split.
    expect(ERROR_CODES.CONFIG_VERSION_NOT_FOUND).toBe("TQ-POL-007");
    expect(ERROR_CODES.ADAPTER_CONFIG_VERSION_NOT_FOUND).toBe("TQ-CON-006");
    expect(ERROR_CODES.CONFIG_VERSION_NOT_FOUND).not.toBe(
      ERROR_CODES.ADAPTER_CONFIG_VERSION_NOT_FOUND
    );
  });

  it("constructs the TQ-CON-007 audit-append rollback via factory", () => {
    const error = adapterConfigActivationAuditFailedError("reference-config", 5, 4);
    expect(error).toBeInstanceOf(Phase8ContractError);
    expect(error.code).toBe(ERROR_CODES.ADAPTER_CONFIG_ACTIVATION_AUDIT_FAILED);
    expect(error.code).toBe("TQ-CON-007");
    expect(error.layer).toBe(ERROR_LAYERS.CONTRACT);
    expect(error.context).toEqual({
      adapterName: "reference-config",
      attemptedVersion: 5,
      rolledBackTo: 4
    });
  });

  it("preserves a cause chain through adapterConfigActivationAuditFailedError", () => {
    const cause = new Error("audit writer offline");
    const error = adapterConfigActivationAuditFailedError("reference-config", 7, 6, cause);
    expect(error.cause).toBe(cause);
  });
});
