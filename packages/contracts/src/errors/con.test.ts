import { describe, expect, it } from "vitest";

import { ERROR_CODES } from "../error-code.js";
import {
  adapterConfigActivationAuditFailedError,
  adapterConfigVersionNotFoundError,
  adapterContractTestViolationError,
  configFileSchemaInvalidError,
  configHistoryStateInconsistentError,
  marginResponseSchemaInvalidError,
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

  it("constructs the TQ-CON-008 config-file schema-invalid via factory", () => {
    const error = configFileSchemaInvalidError(
      "config-file",
      "/etc/tianqi/config.yaml",
      "root `version` must be a positive integer"
    );
    expect(error).toBeInstanceOf(Phase8ContractError);
    expect(error.code).toBe(ERROR_CODES.CONFIG_FILE_SCHEMA_INVALID);
    expect(error.code).toBe("TQ-CON-008");
    expect(error.layer).toBe(ERROR_LAYERS.CONTRACT);
    expect(error.context).toEqual({
      adapterName: "config-file",
      filePath: "/etc/tianqi/config.yaml",
      reason: "root `version` must be a positive integer"
    });
  });

  it("distinguishes TQ-CON-008 from TQ-CON-005 event schema violation", () => {
    // Convention K applied: event schemas and config schemas live in different corpora
    // (program-generated JSON with domain-event docs vs operator-edited YAML with runbook
    // docs), so the two diagnostics stay split even though both surface as "schema wrong".
    expect(ERROR_CODES.EVENT_SCHEMA_VIOLATION).toBe("TQ-CON-005");
    expect(ERROR_CODES.CONFIG_FILE_SCHEMA_INVALID).toBe("TQ-CON-008");
    expect(ERROR_CODES.EVENT_SCHEMA_VIOLATION).not.toBe(ERROR_CODES.CONFIG_FILE_SCHEMA_INVALID);
  });

  it("constructs the TQ-CON-009 config-history-state inconsistent via factory", () => {
    const error = configHistoryStateInconsistentError(
      "config-file",
      "/etc/tianqi/config.yaml.tianqi-history",
      "state.json activeVersion=5 but versions/v000005.yaml missing"
    );
    expect(error).toBeInstanceOf(Phase8ContractError);
    expect(error.code).toBe(ERROR_CODES.CONFIG_HISTORY_STATE_INCONSISTENT);
    expect(error.code).toBe("TQ-CON-009");
    expect(error.layer).toBe(ERROR_LAYERS.CONTRACT);
    expect(error.context).toEqual({
      adapterName: "config-file",
      historyDirectory: "/etc/tianqi/config.yaml.tianqi-history",
      reason: "state.json activeVersion=5 but versions/v000005.yaml missing"
    });
  });

  it("keeps TQ-CON-008 and TQ-CON-009 split across file-schema vs history-state corpora", () => {
    // Convention K: schema-invalid is about the operator-edited YAML shape;
    // history-state-inconsistent is about the Adapter-managed history tree falling out
    // of sync with itself. Different runbooks, different audiences, different codes.
    expect(ERROR_CODES.CONFIG_FILE_SCHEMA_INVALID).toBe("TQ-CON-008");
    expect(ERROR_CODES.CONFIG_HISTORY_STATE_INCONSISTENT).toBe("TQ-CON-009");
    expect(ERROR_CODES.CONFIG_FILE_SCHEMA_INVALID).not.toBe(
      ERROR_CODES.CONFIG_HISTORY_STATE_INCONSISTENT
    );
  });

  it("constructs TQ-CON-010 Margin response schema invalid with domain-level reason", () => {
    const error = marginResponseSchemaInvalidError(
      "margin-engine-http",
      "calculate-margin",
      "requiredMargin",
      "missing_field"
    );
    expect(error.code).toBe("TQ-CON-010");
    expect(error.layer).toBe(ERROR_LAYERS.CONTRACT);
    expect(error.context).toEqual({
      adapterName: "margin-engine-http",
      operation: "calculate-margin",
      fieldPath: "requiredMargin",
      reason: "missing_field"
    });
    // §6.5 discipline: reason is a domain moniker, not a raw HTTP status or a
    // provider-specific error message.
    expect(String(error.context["reason"])).not.toMatch(/^\d\d\d$/);
  });

  it("distinguishes TQ-CON-010 from TQ-CON-005 and TQ-CON-008 — each engine owns its schema slot", () => {
    // Convention K per the Sprint E namespace plan: each business engine in Sprint E
    // mints its own *_RESPONSE_SCHEMA_INVALID code because the diagnostic audience
    // is the downstream service owner (Margin team / Position team / etc), whose API
    // docs and recent deploys are the root remediation path. Step 16-17 will add
    // TQ-CON-011 / 012 / 013 / 014 for the remaining four engines.
    expect(ERROR_CODES.EVENT_SCHEMA_VIOLATION).toBe("TQ-CON-005");
    expect(ERROR_CODES.CONFIG_FILE_SCHEMA_INVALID).toBe("TQ-CON-008");
    expect(ERROR_CODES.MARGIN_RESPONSE_SCHEMA_INVALID).toBe("TQ-CON-010");
    const codes = new Set([
      ERROR_CODES.EVENT_SCHEMA_VIOLATION,
      ERROR_CODES.CONFIG_FILE_SCHEMA_INVALID,
      ERROR_CODES.MARGIN_RESPONSE_SCHEMA_INVALID
    ]);
    expect(codes.size).toBe(3);
  });
});
