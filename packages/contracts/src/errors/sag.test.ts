import { describe, expect, it } from "vitest";

import { ERROR_CODES } from "../error-code.js";
import { ERROR_LAYERS } from "./error-layer.js";
import {
  sagaManualInterventionFailedError,
  sagaOverallTimedOutError,
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

  // Phase 9 / Step 8 — 新增 TQ-SAG-004 整体 Saga 超时码工厂的 round-trip
  // + 四码分离断言。整体超时与单 step 超时（001）在运维监控/SLO 上需要独
  // 立计数（《§14.2》metrics 重试率 / 失败率）。

  it("constructs the TQ-SAG-004 sample via factory", () => {
    const error = sagaOverallTimedOutError(
      "saga-deleverage-acct-001",
      31_200,
      30_000,
      "settle-fund-pool"
    );
    expect(error).toBeInstanceOf(SagaError);
    expect(error.code).toBe(ERROR_CODES.SAGA_OVERALL_TIMED_OUT);
    expect(error.code).toBe("TQ-SAG-004");
    expect(error.layer).toBe(ERROR_LAYERS.SAGA);
    expect(error.context).toEqual({
      sagaId: "saga-deleverage-acct-001",
      elapsedMs: 31_200,
      configuredSagaTimeoutMs: 30_000,
      lastExecutingStepName: "settle-fund-pool"
    });
  });

  it("preserves cause on TQ-SAG-004 factory", () => {
    const cause = new Error("upstream orchestrator wallclock budget exhausted");
    const error = sagaOverallTimedOutError("saga-1", 60_000, 45_000, "step-x", cause);
    expect(error.cause).toBe(cause);
  });

  it("keeps four TQ-SAG codes pairwise distinct", () => {
    // 永久留痕：本 Step 引入的 004 码与既存 001/002/003 四码两两互不重复。
    // 后续 Phase 9 Step 引入新 TQ-SAG-* 时，应继续在此添加分离断言（按
    // sag.test.ts 既定模式累积），确保命名空间分隔不被悄然破坏。
    const codes = new Set<string>([
      ERROR_CODES.SAGA_STEP_TIMEOUT,
      ERROR_CODES.SAGA_STEP_EXECUTION_FAILED,
      ERROR_CODES.SAGA_STEP_COMPENSATION_FAILED,
      ERROR_CODES.SAGA_OVERALL_TIMED_OUT
    ]);
    expect(codes.size).toBe(4);
  });

  // Phase 9 / Step 9 — 新增 TQ-SAG-005 人工介入失败码工厂的 round-trip
  // + 五码分离断言。本码与 §15.1 双重审计场景绑定的"运维 runbook 入口"
  // 错误码——出现时运维必查双签名 / requested 事件 / 重复处理三类典型故障。

  it("constructs the TQ-SAG-005 sample via factory", () => {
    const error = sagaManualInterventionFailedError(
      "dlq-saga-acct-001-step-3",
      "requestor_and_approver_must_differ"
    );
    expect(error).toBeInstanceOf(SagaError);
    expect(error.code).toBe(ERROR_CODES.SAGA_MANUAL_INTERVENTION_FAILED);
    expect(error.code).toBe("TQ-SAG-005");
    expect(error.layer).toBe(ERROR_LAYERS.SAGA);
    expect(error.context).toEqual({
      entryId: "dlq-saga-acct-001-step-3",
      reason: "requestor_and_approver_must_differ"
    });
  });

  it("preserves cause on TQ-SAG-005 factory", () => {
    const cause = new Error("audit sink unreachable");
    const error = sagaManualInterventionFailedError(
      "dlq-1",
      "audit_request_event_failed",
      cause
    );
    expect(error.cause).toBe(cause);
  });

  it("keeps five TQ-SAG codes pairwise distinct", () => {
    // 永久留痕：本 Step 引入的 005 码与既存 001/002/003/004 五码两两互不
    // 重复。Sprint G 收官：Phase 9 saga 错误码命名空间累积 5 条，覆盖
    // step 超时（001）/ step 执行失败（002）/ step 补偿失败（003）/
    // saga 整体超时（004）/ 人工介入失败（005）—— Phase 9 编排能力的
    // 完整故障语义集合。
    const codes = new Set<string>([
      ERROR_CODES.SAGA_STEP_TIMEOUT,
      ERROR_CODES.SAGA_STEP_EXECUTION_FAILED,
      ERROR_CODES.SAGA_STEP_COMPENSATION_FAILED,
      ERROR_CODES.SAGA_OVERALL_TIMED_OUT,
      ERROR_CODES.SAGA_MANUAL_INTERVENTION_FAILED
    ]);
    expect(codes.size).toBe(5);
  });
});
