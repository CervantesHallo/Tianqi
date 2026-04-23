import { describe, expect, it } from "vitest";

import { ERROR_CODES } from "../error-code.js";
import { ERROR_LAYERS } from "./error-layer.js";
import { sagaStepTimeoutError, SagaError } from "./sag.js";

describe("TQ-SAG error namespace", () => {
  it("constructs the TQ-SAG-001 sample via factory", () => {
    const error = sagaStepTimeoutError("await-deleveraging-finalized", 5_000);
    expect(error).toBeInstanceOf(SagaError);
    expect(error.code).toBe(ERROR_CODES.SAGA_STEP_TIMEOUT);
    expect(error.code).toBe("TQ-SAG-001");
    expect(error.layer).toBe(ERROR_LAYERS.SAGA);
    expect(error.context).toEqual({ stepId: "await-deleveraging-finalized", timeoutMs: 5_000 });
  });

  it("marks every SagaError with layer=saga", () => {
    const error = new SagaError(ERROR_CODES.SAGA_STEP_TIMEOUT, "boom", {
      stepId: "x",
      timeoutMs: 1
    });
    expect(error.layer).toBe("saga");
  });

  it("preserves optional cause chain", () => {
    const cause = new Error("underlying network timeout");
    const error = sagaStepTimeoutError("notify-ops", 15_000, cause);
    expect(error.cause).toBe(cause);
  });

  it("rejects non-TQ-SAG codes at the type layer", () => {
    // @ts-expect-error — TQ-INF-002 cannot be assigned to a SagaErrorCode slot
    const invalid = new SagaError(ERROR_CODES.ADAPTER_INITIALIZATION_FAILED, "wrong", {
      stepId: "x",
      timeoutMs: 0
    });
    expect(invalid).toBeInstanceOf(SagaError);
  });
});
