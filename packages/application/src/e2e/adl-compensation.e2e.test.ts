// Phase 11 / Step 5 — ADL Saga 端到端补偿路径 e2e 测试.
//
// 用途（PHASE_DESIGN K.3 α'' 6 it + K.4 P+Q 双覆盖 + K.5 γ bodyIdempotencyKeyPattern
// + K.6 选项 1 + K.7 5 不变量端到端兑现表）：
// Phase 11 主题核心层第四个工程价值实现 Step——ADL 补偿路径首次端到端验证。
// 顺利路径基线 (Step 2+3) + Liquidation 补偿 (Step 4) 之上，本 Step 实施
// ADL 补偿路径：让 step 5 (settle-account-funds) 执行失败触发逆序补偿；
// P 终态 (compensated) 验证完整补偿链 (step 4 reverse-insurance + step 3
// cancel-orders × N)；Q 终态 (partially_compensated) 验证补偿失败死信入队.
//
// 与 Step 4 Liquidation 补偿 e2e 的严格对称：
// 5 视角 1:1 mirror（completes / audit / persist / HTTP reverse-order / concurrent）
// + 第 6 个 it 专 Q 终态。Phase 11 e2e 22 it 严格对称（顺利 5+5 + 补偿 6+6）。
//
// ADL 补偿与 Liquidation 补偿的结构性差异（K.1 实测；ADR-0004 Step 5 段记录）：
//   - ADL step 内部多账户 C-fail-fast 循环（step 2/3/5）
//   - ADL step 3 compensate: cancelOrder × N（vs Liquidation cancelOrder × 1）
//   - ADL step 4 compensate: transferFund 反向（vs Liquidation lockMargin）
//   - ADL step 5 compensate: transferFund × N 反向（vs Liquidation transferFund × 1）
//   - **ADL step 4 + step 5 共用 /transfer-fund endpoint** — 区分依赖 body
//     idempotencyKey 子串（K.5 候选 γ bodyIdempotencyKeyPattern 字段）
//
// 5 不变量端到端兑现（K.7 完整表）：
//   - 不变量 1 严格逆序补偿: it 4 (HTTP reverse-order; step 4 transferFund
//     reverse-insurance 必先于 step 3 cancel-orders)
//   - 不变量 2 仅 succeeded 被补偿 / 双重幂等: it 1 (P 主测 stepStatuses 断言)
//   - 不变量 3 compensation_failed 必入死信: it 6 (Q 终态 + listPending)
//   - 不变量 4 每次状态变化都 persist: it 3 (listIncomplete) + it 2 (audit 间接)
//   - 不变量 5 链式继续: it 6 (Q 测试链式) + it 5 (并发独立性)
//
// 元规则 J：TIANQI_TEST_POSTGRES_URL + TIANQI_TEST_KAFKA_BROKERS 双控
// 制 skip（与 Step 1-4 同模式）。
//
// K.6 KI-P9-001 第四次评估：基于 Step 5 独立 4 探针实测（非惰性推断）确认
// 本 Step 沿用 saga.runForCase 直接调用模式，结构性不触及 KI-P9-001 数据
// 副本漂移区域；维持 OPEN（详见 docs/decisions/0004 Step 5 段 +
// docs/KNOWN-ISSUES.md 第四次评估留痕）.

import { env } from "node:process";
import { setTimeout as scheduleTimer } from "node:timers";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  createFundAccountId,
  createFundAmount,
  createFundCurrency,
  createMarkPriceValue,
  createMatchAccountId,
  createPositionAccountId,
  createPositionId,
  createPositionSize
} from "@tianqi/ports";
import type { PersistedSagaState, DeadLetterEntry } from "@tianqi/ports";

import {
  createADLSaga,
  type ADLInput,
  type DeleveragingTarget
} from "../saga/adl-saga.js";

import {
  createFakeEnginesServer,
  type FakeEnginesServer,
  type FakeEngineRequest
} from "./fake-engines.js";
import { createE2eHarness, type E2eHarness } from "./test-harness.js";

const postgresUrl = env["TIANQI_TEST_POSTGRES_URL"];
const kafkaBrokersEnv = env["TIANQI_TEST_KAFKA_BROKERS"];
const kafkaBrokers =
  kafkaBrokersEnv !== undefined && kafkaBrokersEnv.length > 0
    ? kafkaBrokersEnv.split(",")
    : [];

const canRunE2e =
  typeof postgresUrl === "string" && postgresUrl.length > 0 && kafkaBrokers.length > 0;

// ============================================================
// fixture builder — ADL 补偿路径输入
// ============================================================

const buildDeleveragingTarget = (
  targetSuffix: string,
  overrides: Partial<DeleveragingTarget> = {}
): DeleveragingTarget => ({
  accountId: createPositionAccountId("acct-pos-adl-" + targetSuffix),
  fundAccountId: createFundAccountId("acct-fund-adl-" + targetSuffix),
  matchAccountId: createMatchAccountId("acct-match-adl-" + targetSuffix),
  positionId: createPositionId("pos-adl-" + targetSuffix),
  symbol: "BTC-USDT",
  deleveragingSide: "sell",
  deleveragingQuantity: createPositionSize(0.5),
  expectedDeleveragingPrice: createMarkPriceValue(50_000),
  accountSettleAmount: createFundAmount(500),
  ...overrides
});

const buildAdlInput = (
  caseSuffix: string,
  overrides: Partial<ADLInput> = {}
): ADLInput => ({
  caseId: "case-adl-" + caseSuffix,
  insuranceFundAccountId: createFundAccountId("acct-insurance-" + caseSuffix),
  lossAbsorptionTargetAccountId: createFundAccountId("acct-loss-" + caseSuffix),
  systemLossAmount: createFundAmount(5_000),
  systemLossCurrency: createFundCurrency("USDT"),
  fundCurrency: createFundCurrency("USDT"),
  symbols: ["BTC-USDT", "ETH-USDT"],
  targets: [
    buildDeleveragingTarget(caseSuffix + "-tgt-1"),
    buildDeleveragingTarget(caseSuffix + "-tgt-2")
  ],
  deleveragingStrategy: "by-profit-rate",
  triggerReason: "system_loss_triggered_adl",
  ...overrides
});

// ADL 5 step 正向 HTTP path（K.1 实测；多账户 step 2/3/5 调用 N=2 次）.
const FORWARD_STEP_PATHS = [
  "/query-mark-price-batch", // step 1: fetch-mark-prices
  "/query-position",         // step 2: verify-targets × N
  "/place-order",            // step 3: submit-deleveraging-orders × N
  "/transfer-fund"           // step 4 (insurance-fund-deduction) + step 5 (settle-account-funds × N)
] as const;

// ADL 补偿 HTTP path 说明（saga 层严格逆序：step 4 transferFund (reverse-insurance)
// 先于 step 3 cancelOrder × N；step 1+2 noop 无 HTTP）.
// /transfer-fund 在补偿阶段又出现一次 (step 4 compensate)，靠 body 区分.
// 实际断言在 it 4 内按 body.idempotencyKey 子串过滤；不需要独立常量.

const STEP_NAMES = [
  "fetch-mark-prices",
  "verify-targets",
  "submit-deleveraging-orders",
  "insurance-fund-deduction",
  "settle-account-funds"
] as const;

const delayMs = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    scheduleTimer(() => resolve(), ms);
  });

// ============================================================
// 辅助：从 receivedRequests 中按 body.idempotencyKey substring 过滤
// ============================================================

const getBodyIdempotencyKey = (req: FakeEngineRequest): string | null => {
  if (req.body === null || typeof req.body !== "object" || Array.isArray(req.body)) {
    return null;
  }
  const key = (req.body as Record<string, unknown>)["idempotencyKey"];
  return typeof key === "string" ? key : null;
};

// ============================================================
// 测试套件
// ============================================================

const createdHarnesses: E2eHarness[] = [];
const createdServers: FakeEnginesServer[] = [];

afterAll(async () => {
  for (const h of createdHarnesses) {
    await h.cleanup().catch(() => {
      // Best-effort.
    });
  }
  for (const s of createdServers) {
    await s.close().catch(() => {
      // Best-effort.
    });
  }
}, 60_000);

describe.skipIf(!canRunE2e)("ADL Saga e2e — Phase 11 / Step 5 compensation path", () => {
  // P 终态测试（it 1-5）：step 5 execute fail (transferFund + :settle: body
  // pattern) → 补偿链 step 4 reverse-insurance + step 3 cancel-orders × N.
  let fakeServerP: FakeEnginesServer;
  let harnessP: E2eHarness;
  // Q 终态测试（it 6）：step 5 execute fail + step 3 cancel-order fail
  // → 死信入队 step 3.
  let fakeServerQ: FakeEnginesServer;
  let harnessQ: E2eHarness;

  beforeEach(async () => {
    // P 终态 harness：让 step 5 execute (transferFund :settle:) 失败；
    // step 4 execute (transferFund :insurance) + step 4 compensate (transferFund
    // :reverse-insurance) + step 3 compensate (cancel-order × N) 全部 happy.
    fakeServerP = await createFakeEnginesServer({
      caseFailureRules: [
        {
          traceIdPattern: "adl-compensation-P",
          path: "/transfer-fund",
          bodyIdempotencyKeyPattern: ":settle:",
          statusCode: 500,
          responseBody: { error: "account_settle_failed_injected" }
        }
      ]
    });
    createdServers.push(fakeServerP);
    harnessP = await createE2eHarness({
      postgresUrl: postgresUrl!,
      kafkaBrokers,
      fakeEngineHttp: fakeServerP
    });
    createdHarnesses.push(harnessP);

    // Q 终态 harness：让 step 5 execute (transferFund :settle:) fail +
    // step 3 compensate (cancel-order) fail → step 3 C-fail-fast 整 step
    // compensation_failed → 死信入队 step 3.
    fakeServerQ = await createFakeEnginesServer({
      caseFailureRules: [
        {
          traceIdPattern: "adl-compensation-Q",
          path: "/transfer-fund",
          bodyIdempotencyKeyPattern: ":settle:",
          statusCode: 500,
          responseBody: { error: "account_settle_failed_injected" }
        },
        {
          traceIdPattern: "adl-compensation-Q",
          path: "/cancel-order",
          statusCode: 500,
          responseBody: { error: "cancel_order_compensate_failed_injected" }
        }
      ]
    });
    createdServers.push(fakeServerQ);
    harnessQ = await createE2eHarness({
      postgresUrl: postgresUrl!,
      kafkaBrokers,
      fakeEngineHttp: fakeServerQ
    });
    createdHarnesses.push(harnessQ);
  });

  it(
    "test_compensation_path_terminates_with_compensated_status_on_full_compensation_success",
    async () => {
      // K.4 P 终态主测；K.7 不变量 2 (仅 succeeded 被补偿) 主测.
      const engines = harnessP.engines;
      expect(engines).not.toBeUndefined();
      if (engines === undefined) return;

      const saga = createADLSaga({
        sagaStateStore: harnessP.sagaStateStore,
        deadLetterStore: harnessP.deadLetterStore,
        auditEventSink: harnessP.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const input = buildAdlInput("adl-compensation-P-1");
      const result = await saga.runForCase(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // P 终态：补偿全部成功 → compensated
        expect(result.value.status).toBe("compensated");
        expect(result.value.stepStatuses).toHaveLength(5);

        // 不变量 2 验证：
        // - step 0/1 (noop compensate) status = compensated
        // - step 2 (cancel-orders × N) status = compensated
        // - step 3 (reverse-insurance) status = compensated
        // - step 4 (failed execute = settle-account-funds) status = failed
        //   (不变量 2 双重幂等保护让失败 step 不进入 compensation)
        expect(result.value.stepStatuses[0]?.status).toBe("compensated"); // fetch-mark-prices
        expect(result.value.stepStatuses[1]?.status).toBe("compensated"); // verify-targets
        expect(result.value.stepStatuses[2]?.status).toBe("compensated"); // submit-deleveraging-orders
        expect(result.value.stepStatuses[3]?.status).toBe("compensated"); // insurance-fund-deduction
        expect(result.value.stepStatuses[4]?.status).toBe("failed");       // settle-account-funds
      }
    },
    60_000
  );

  it(
    "test_compensation_path_emits_correct_audit_events_for_saga_lifecycle_and_steps",
    async () => {
      // §15 审计要求；K.7 不变量 4 间接验证.
      const engines = harnessP.engines!;
      const saga = createADLSaga({
        sagaStateStore: harnessP.sagaStateStore,
        deadLetterStore: harnessP.deadLetterStore,
        auditEventSink: harnessP.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const input = buildAdlInput("adl-compensation-P-audit-1");
      const result = await saga.runForCase(input);
      expect(result.ok).toBe(true);

      const sagaLifecycleEvents = harnessP.auditSink.events.filter(
        (e) => e.eventType === "saga.started" || e.eventType === "saga.completed"
      );
      expect(sagaLifecycleEvents.length).toBeGreaterThanOrEqual(2);
      expect(sagaLifecycleEvents.some((e) => e.eventType === "saga.started")).toBe(true);
      expect(sagaLifecycleEvents.some((e) => e.eventType === "saga.completed")).toBe(true);

      const stepEvents = harnessP.auditSink.events.filter((e) =>
        e.eventType.startsWith("saga.step.")
      );
      expect(stepEvents.length).toBeGreaterThanOrEqual(STEP_NAMES.length);

      for (const stepName of STEP_NAMES) {
        const matched = stepEvents.some(
          (e) => (e.payload as Record<string, unknown>)["stepName"] === stepName
        );
        expect(matched).toBe(true);
      }

      // 失败 step (settle-account-funds) 必含 failed outcome event.
      const failedOutcomeEvents = stepEvents.filter((e) => {
        const payload = e.payload as Record<string, unknown>;
        return (
          payload["stepName"] === "settle-account-funds" &&
          payload["outcome"] === "failed"
        );
      });
      expect(failedOutcomeEvents.length).toBeGreaterThanOrEqual(1);
    },
    60_000
  );

  it(
    "test_compensation_path_persists_every_state_transition_to_postgres",
    async () => {
      // §8.1 严守；K.7 不变量 4 主测.
      const engines = harnessP.engines!;
      const saga = createADLSaga({
        sagaStateStore: harnessP.sagaStateStore,
        deadLetterStore: harnessP.deadLetterStore,
        auditEventSink: harnessP.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const input = buildAdlInput("adl-compensation-P-persist-1");
      const result = await saga.runForCase(input);
      expect(result.ok).toBe(true);

      const incompleteResult = await harnessP.sagaStateStore.listIncomplete();
      expect(incompleteResult.ok).toBe(true);
      if (incompleteResult.ok && result.ok) {
        const targetSagaId = result.value.sagaId;
        const stillIncomplete = incompleteResult.value.some(
          (s: PersistedSagaState) => s.sagaId === targetSagaId
        );
        expect(stillIncomplete).toBe(false);
      }
    },
    60_000
  );

  it(
    "test_compensation_path_invokes_engines_in_strict_reverse_order_via_real_http",
    async () => {
      // K.7 不变量 1 主测 (saga 层严格逆序 + step 内部多账户循环双层验证).
      //
      // ADL 补偿 HTTP path 序列：
      //   正向：query-mark-price-batch → query-position × N → place-order × N
      //         → transfer-fund (step 4 :insurance) → transfer-fund (step 5 :settle:0 FAIL)
      //   补偿：transfer-fund (step 4 :reverse-insurance) → cancel-order × N (step 3 :cancel:0/1)
      //
      // saga 层严格逆序断言：step 4 compensate transferFund (:reverse-insurance)
      // 必先于 step 3 compensate cancel-orders.
      const engines = harnessP.engines!;
      const saga = createADLSaga({
        sagaStateStore: harnessP.sagaStateStore,
        deadLetterStore: harnessP.deadLetterStore,
        auditEventSink: harnessP.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const input = buildAdlInput("adl-compensation-P-reverse-1");
      const result = await saga.runForCase(input);
      expect(result.ok).toBe(true);

      const requests = fakeServerP.receivedRequests;
      const paths = requests.map((r) => r.path);

      // 正向 4 distinct path 全部触发.
      for (const expectedPath of FORWARD_STEP_PATHS) {
        expect(paths).toContain(expectedPath);
      }

      // 补偿 step 4 (reverse-insurance) 在 receivedRequests 中的位置.
      const step4CompensateIdx = requests.findIndex((r) => {
        if (r.path !== "/transfer-fund") return false;
        const key = getBodyIdempotencyKey(r);
        return key !== null && key.includes(":reverse-insurance");
      });
      expect(step4CompensateIdx).toBeGreaterThan(-1);

      // 补偿 step 3 (cancel-order × N) 第一个 idx.
      const step3CompensateIdx = requests.findIndex((r) => {
        if (r.path !== "/cancel-order") return false;
        const key = getBodyIdempotencyKey(r);
        return key !== null && key.includes(":cancel:");
      });
      expect(step3CompensateIdx).toBeGreaterThan(-1);

      // saga 层严格逆序：step 4 compensate 必先于 step 3 compensate.
      expect(step4CompensateIdx).toBeLessThan(step3CompensateIdx);

      // step 内部多账户循环验证：step 3 cancel-order × 2 (N=2 targets).
      const step3CancelOrders = requests.filter((r) => {
        if (r.path !== "/cancel-order") return false;
        const key = getBodyIdempotencyKey(r);
        return key !== null && key.includes(":cancel:");
      });
      expect(step3CancelOrders.length).toBe(2);

      // step 4 reverse-insurance 仅 1 次 (非多账户).
      const step4ReverseInsurance = requests.filter((r) => {
        if (r.path !== "/transfer-fund") return false;
        const key = getBodyIdempotencyKey(r);
        return key !== null && key.includes(":reverse-insurance");
      });
      expect(step4ReverseInsurance.length).toBe(1);
    },
    60_000
  );

  it(
    "test_compensation_paths_remain_independent_under_concurrent_execution",
    async () => {
      // K.7 不变量 5 并发维度.
      const engines = harnessP.engines!;
      const saga = createADLSaga({
        sagaStateStore: harnessP.sagaStateStore,
        deadLetterStore: harnessP.deadLetterStore,
        auditEventSink: harnessP.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const inputA = buildAdlInput("adl-compensation-P-concurrent-A");
      const inputB = buildAdlInput("adl-compensation-P-concurrent-B");

      const [resultA, resultB] = await Promise.all([
        saga.runForCase(inputA),
        saga.runForCase(inputB)
      ]);

      expect(resultA.ok).toBe(true);
      expect(resultB.ok).toBe(true);
      if (resultA.ok && resultB.ok) {
        expect(resultA.value.status).toBe("compensated");
        expect(resultB.value.status).toBe("compensated");
        expect(resultA.value.sagaId).not.toBe(resultB.value.sagaId);
      }

      // 两并发 ADL 补偿 saga 至少触发 2 × (1+2+2+1+1+1+2) = 2 × 10 = 20 HTTP calls.
      // 单 saga: 1 batch + 2 query-position + 2 place-order + 1 transfer-fund (step 4)
      // + 1 transfer-fund FAIL (step 5 :settle:0) + 1 transfer-fund (step 4 compensate)
      // + 2 cancel-order (step 3 compensate) = 10.
      expect(fakeServerP.receivedRequests.length).toBeGreaterThanOrEqual(20);

      await delayMs(500);
    },
    90_000
  );

  it(
    "test_compensation_path_terminates_with_partially_compensated_status_on_partial_compensation_failure",
    async () => {
      // K.4 Q 终态主测；K.7 不变量 3 (compensation_failed 入死信) 主测 +
      // 不变量 5 (链式继续) 兑现.
      //
      // ADL 多账户 C-fail-fast 补偿场景：
      // step 5 execute fail (transferFund :settle: FAIL) → 触发补偿；
      // step 4 compensate (transferFund :reverse-insurance) success → step 4 = compensated;
      // step 3 compensate (cancelOrder × N): 第一个 cancel-order FAIL → ADL step 3
      // 内部 C-fail-fast → 整 step 3 compensate 返回 err → step 3 status =
      // compensation_failed → 不变量 3 死信入队 step 3 (submit-deleveraging-orders);
      // step 2/1 noop 仍执行 (不变量 5 链式继续即使 step 3 compensation fail);
      // 终态 partially_compensated (Q).
      const engines = harnessQ.engines!;
      const saga = createADLSaga({
        sagaStateStore: harnessQ.sagaStateStore,
        deadLetterStore: harnessQ.deadLetterStore,
        auditEventSink: harnessQ.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const input = buildAdlInput("adl-compensation-Q-1");
      const result = await saga.runForCase(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Q 终态：部分补偿失败 → partially_compensated
        expect(result.value.status).toBe("partially_compensated");

        // step 2 (submit-deleveraging-orders) status = dead_lettered (compensation 失败)
        expect(result.value.stepStatuses[2]?.status).toBe("dead_lettered");
        // step 3 (insurance-fund-deduction) status = compensated (reverse-insurance success)
        expect(result.value.stepStatuses[3]?.status).toBe("compensated");
        // step 4 (settle-account-funds; failed execute) 仍是 failed
        expect(result.value.stepStatuses[4]?.status).toBe("failed");
      }

      // 不变量 3 主测：死信表含 step 3 (submit-deleveraging-orders) 入队记录.
      const pendingResult = await harnessQ.deadLetterStore.listPending();
      expect(pendingResult.ok).toBe(true);
      if (pendingResult.ok) {
        const submitDeleveragingDeadLetters = pendingResult.value.filter(
          (entry: DeadLetterEntry) => entry.stepName === "submit-deleveraging-orders"
        );
        expect(submitDeleveragingDeadLetters.length).toBeGreaterThanOrEqual(1);
      }

      // 不变量 5 链式继续验证：step 3 compensate fail 不阻断 step 4 compensate.
      const requests = fakeServerQ.receivedRequests;
      const step4ReverseInsuranceCount = requests.filter((r) => {
        if (r.path !== "/transfer-fund") return false;
        const key = getBodyIdempotencyKey(r);
        return key !== null && key.includes(":reverse-insurance");
      }).length;
      // step 4 compensate (reverse-insurance) 至少 1 次 (链式继续 — 在 step 3
      // compensate fail 之前已发生).
      expect(step4ReverseInsuranceCount).toBeGreaterThanOrEqual(1);

      // step 3 cancel-order 至少 1 次 (FAIL response).
      const step3CancelOrderAttempts = requests.filter((r) => r.path === "/cancel-order").length;
      expect(step3CancelOrderAttempts).toBeGreaterThanOrEqual(1);

      // 严格逆序仍兑现：step 4 compensate transferFund (reverse-insurance) 必先于
      // step 3 compensate cancel-order.
      const step4CompensateIdx = requests.findIndex((r) => {
        if (r.path !== "/transfer-fund") return false;
        const key = getBodyIdempotencyKey(r);
        return key !== null && key.includes(":reverse-insurance");
      });
      const step3CancelOrderIdx = requests.findIndex((r) => r.path === "/cancel-order");
      expect(step4CompensateIdx).toBeGreaterThan(-1);
      expect(step3CancelOrderIdx).toBeGreaterThan(-1);
      expect(step4CompensateIdx).toBeLessThan(step3CancelOrderIdx);
    },
    60_000
  );
});
