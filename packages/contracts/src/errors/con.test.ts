import { describe, expect, it } from "vitest";

import { ERROR_CODES } from "../error-code.js";
import { adapterContractTestViolationError, Phase8ContractError } from "./con.js";
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
});
