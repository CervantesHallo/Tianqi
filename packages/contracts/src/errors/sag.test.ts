import { describe, expect, it } from "vitest";

import { ERROR_CODES } from "../error-code.js";
import { ERROR_LAYERS } from "./error-layer.js";
import {
  sagaStepCompensationFailedError,
  SagaError,
  sagaStepExecutionFailedError,
  sagaStepTimeoutError
} from "./sag.js";

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

  // Phase 9 / Step 1 — 新增 TQ-SAG-002 / TQ-SAG-003 工厂的 round-trip 与
  // 三码独立性断言。每条错误码必须独占一个字符串槽位（不与既有码重复），
  // 且工厂返回的 SagaError 必须 layer=saga（错误层级标识）。

  it("constructs the TQ-SAG-002 sample via factory", () => {
    const error = sagaStepExecutionFailedError(
      "saga-deleverage-acct-001",
      "lock-margin-account",
      "downstream margin engine returned non-retryable error"
    );
    expect(error).toBeInstanceOf(SagaError);
    expect(error.code).toBe(ERROR_CODES.SAGA_STEP_EXECUTION_FAILED);
    expect(error.code).toBe("TQ-SAG-002");
    expect(error.layer).toBe(ERROR_LAYERS.SAGA);
    expect(error.context).toEqual({
      sagaId: "saga-deleverage-acct-001",
      stepName: "lock-margin-account",
      reason: "downstream margin engine returned non-retryable error"
    });
  });

  it("preserves cause on TQ-SAG-002 factory", () => {
    const cause = new Error("HTTP 500 from margin-engine");
    const error = sagaStepExecutionFailedError("saga-1", "step-1", "summary", cause);
    expect(error.cause).toBe(cause);
  });

  it("constructs the TQ-SAG-003 sample via factory", () => {
    const error = sagaStepCompensationFailedError(
      "saga-deleverage-acct-001",
      "lock-margin-account",
      "compensation idempotency check could not confirm prior unlock"
    );
    expect(error).toBeInstanceOf(SagaError);
    expect(error.code).toBe(ERROR_CODES.SAGA_STEP_COMPENSATION_FAILED);
    expect(error.code).toBe("TQ-SAG-003");
    expect(error.layer).toBe(ERROR_LAYERS.SAGA);
    expect(error.context).toEqual({
      sagaId: "saga-deleverage-acct-001",
      stepName: "lock-margin-account",
      reason: "compensation idempotency check could not confirm prior unlock"
    });
  });

  it("preserves cause on TQ-SAG-003 factory", () => {
    const cause = new Error("downstream ACK timeout during unlock");
    const error = sagaStepCompensationFailedError("saga-1", "step-1", "summary", cause);
    expect(error.cause).toBe(cause);
  });

  it("keeps three TQ-SAG codes pairwise distinct", () => {
    // 永久留痕：本 Step 引入的 003 码与既存 001 + 新增 002 三两互不重复。
    // 后续 Phase 9 Step 引入新 TQ-SAG-* 时，应继续在此添加分离断言（按
    // sag.test.ts 既定模式累积），确保命名空间分隔不被悄然破坏。
    const codes = new Set<string>([
      ERROR_CODES.SAGA_STEP_TIMEOUT,
      ERROR_CODES.SAGA_STEP_EXECUTION_FAILED,
      ERROR_CODES.SAGA_STEP_COMPENSATION_FAILED
    ]);
    expect(codes.size).toBe(3);
  });
});
