// Phase 11 / Step 4 — Liquidation Saga 端到端补偿路径 e2e 测试.
//
// 用途（PHASE_DESIGN K.3 α' 6 it + K.4 P+Q 双覆盖 + K.5 候选 α + K.6 选项 1 + K.7
// 5 不变量端到端兑现表）：
// Phase 11 主题核心层第三个工程价值实现 Step——补偿路径首次端到端验证。
// 顺利路径基线 (Step 2 Liquidation + Step 3 ADL) 之上，本 Step 实施
// Liquidation 补偿路径：让 step 5 (settle-fund-transfer) 执行失败触发逆序
// 补偿；P 终态 (compensated) 验证完整补偿链；Q 终态 (partially_compensated)
// 验证补偿失败死信入队（不变量 3 端到端兑现唯一窗口）。
//
// 与 Step 2 + Step 3 e2e 测试的对称性（PHASE_DESIGN K.3 α'）：
// 前 5 个 it 1:1 mirror Step 2/3 的 5 视角（completes / audit / persist /
// HTTP order / concurrent），仅业务流程切到补偿路径（HTTP order 视角变为反向）。
// 第 6 个 it 专 Q 终态（Step 2/3 无对称；补偿路径独有的部分失败维度）。
//
// 5 不变量端到端兑现（K.7 完整表）：
//   - 不变量 1 严格逆序补偿: it 4 (HTTP reverse-order)
//   - 不变量 2 仅 succeeded 被补偿 / 双重幂等: it 1 (P 主测 stepStatuses 断言)
//   - 不变量 3 compensation_failed 必入死信: it 6 (Q 终态 + listPending)
//   - 不变量 4 每次状态变化都 persist: it 3 (listIncomplete) + it 2 (audit 间接)
//   - 不变量 5 链式继续: it 6 (Q 测试链式) + it 5 (并发独立性)
//
// 元规则 J：TIANQI_TEST_POSTGRES_URL + TIANQI_TEST_KAFKA_BROKERS 双控
// 制 skip（与 Step 1 + Step 2 + Step 3 同模式）。
//
// K.6 KI-P9-001 第三次评估：基于 4 探针实测确认本 Step 沿用 saga.runForCase
// 直接调用模式，结构性不触及 KI-P9-001 数据副本漂移区域；维持 OPEN（详见
// docs/decisions/0004 Step 4 段 + docs/KNOWN-ISSUES.md 第三次评估留痕）。

import { env } from "node:process";
import { setTimeout as scheduleTimer } from "node:timers";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  createFundAccountId,
  createFundAmount,
  createFundCurrency,
  createMarginAccountId,
  createMarginCurrency,
  createMarginLockId,
  createMatchAccountId,
  createPositionAccountId
} from "@tianqi/ports";
import type { PersistedSagaState, DeadLetterEntry } from "@tianqi/ports";

import { createLiquidationSaga, type LiquidationInput } from "../saga/liquidation-saga.js";

import { createFakeEnginesServer, type FakeEnginesServer } from "./fake-engines.js";
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
// fixture builder — Liquidation 补偿路径输入
// ============================================================

const buildLiquidationInput = (
  caseSuffix: string,
  overrides: Partial<LiquidationInput> = {}
): LiquidationInput => ({
  caseId: "case-" + caseSuffix,
  marginAccountId: createMarginAccountId("acct-margin-" + caseSuffix),
  positionAccountId: createPositionAccountId("acct-pos-" + caseSuffix),
  matchAccountId: createMatchAccountId("acct-match-" + caseSuffix),
  fundSourceAccountId: createFundAccountId("acct-fund-src-" + caseSuffix),
  symbol: "BTC-USDT",
  marginCurrency: createMarginCurrency("USDT"),
  fundCurrency: createFundCurrency("USDT"),
  marginLockId: createMarginLockId("lock-" + caseSuffix),
  fundDestinationAccountId: createFundAccountId("acct-fund-dest-" + caseSuffix),
  fundAmount: createFundAmount(1_000),
  closeOrderSide: "sell",
  closeOrderQuantity: 0.5,
  triggerReason: "margin_below_maintenance",
  ...overrides
});

// 5 个 Liquidation Saga step 的正向 HTTP path（与 Step 2 既有 EXPECTED_STEP_PATHS
// 一致；用作补偿路径执行后的"正向 step 已发起"佐证）。
const FORWARD_STEP_PATHS = [
  "/query-mark-price",      // step 1 execute
  "/list-open-positions",   // step 2 execute
  "/place-order",           // step 3 execute
  "/release-margin",        // step 4 execute
  "/transfer-fund"          // step 5 execute (P/Q 场景下此 step FAIL)
] as const;

// 补偿路径的 HTTP path（不变量 1 严格逆序：step 4 先补偿 → step 3 后补偿）。
// step 1 + step 2 是 read-only noop compensate，不产生 HTTP call。
// step 5 execute fail，不进入 compensation。
const COMPENSATION_STEP_PATHS = [
  "/lock-margin",   // step 4 compensate (relock margin)
  "/cancel-order"   // step 3 compensate (cancel close order)
] as const;

// 5 个 Liquidation Saga step 名（与 saga-orchestrator audit event payload 中
// stepName 对应；§15 审计要求；K.7 不变量 2 间接验证 audit 中失败 step 不进
// compensation）。
const STEP_NAMES = [
  "fetch-mark-price",
  "list-open-positions",
  "submit-close-orders",
  "release-margin",
  "settle-fund-transfer"
] as const;

const delayMs = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    scheduleTimer(() => resolve(), ms);
  });

// ============================================================
// 测试套件
// ============================================================

const createdHarnesses: E2eHarness[] = [];
const createdServers: FakeEnginesServer[] = [];

afterAll(async () => {
  // Defensive cleanup tier.
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

describe.skipIf(!canRunE2e)("Liquidation Saga e2e — Phase 11 / Step 4 compensation path", () => {
  // P 终态测试（it 1-5）共用 harness + fakeServer（K.5 候选 α 失败规则注入
  // step 5 execute fail; lock-margin / cancel-order 补偿 happy）.
  let fakeServerP: FakeEnginesServer;
  let harnessP: E2eHarness;
  // Q 终态测试（it 6）独立 harness + fakeServer（额外注入 lock-margin 补偿 fail）.
  let fakeServerQ: FakeEnginesServer;
  let harnessQ: E2eHarness;

  beforeEach(async () => {
    // P 终态 harness：step 5 execute fail（触发完整补偿链 step 4 → step 3）
    fakeServerP = await createFakeEnginesServer({
      caseFailureRules: [
        {
          traceIdPattern: "compensation-P",
          path: "/transfer-fund",
          statusCode: 500,
          responseBody: { error: "fund_settlement_failed_injected" }
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

    // Q 终态 harness：step 5 execute fail + step 4 compensate (lock-margin) fail
    fakeServerQ = await createFakeEnginesServer({
      caseFailureRules: [
        {
          traceIdPattern: "compensation-Q",
          path: "/transfer-fund",
          statusCode: 500,
          responseBody: { error: "fund_settlement_failed_injected" }
        },
        {
          traceIdPattern: "compensation-Q",
          path: "/lock-margin",
          statusCode: 500,
          responseBody: { error: "relock_margin_failed_injected" }
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

      const saga = createLiquidationSaga({
        sagaStateStore: harnessP.sagaStateStore,
        deadLetterStore: harnessP.deadLetterStore,
        auditEventSink: harnessP.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const input = buildLiquidationInput("compensation-P-1");
      const result = await saga.runForCase(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // P 终态：补偿全部成功 → compensated
        expect(result.value.status).toBe("compensated");
        expect(result.value.stepStatuses).toHaveLength(5);

        // 不变量 2 验证：
        // - step 0/1 (noop compensate) status = compensated
        // - step 2/3 (cancel/relock compensate) status = compensated
        // - step 4 (failed execute) status = failed (NOT compensated;
        //   不变量 2 双重幂等保护让失败 step 不进入 compensation)
        expect(result.value.stepStatuses[0]?.status).toBe("compensated"); // fetch-mark-price
        expect(result.value.stepStatuses[1]?.status).toBe("compensated"); // list-open-positions
        expect(result.value.stepStatuses[2]?.status).toBe("compensated"); // submit-close-orders
        expect(result.value.stepStatuses[3]?.status).toBe("compensated"); // release-margin
        expect(result.value.stepStatuses[4]?.status).toBe("failed");       // settle-fund-transfer
      }
    },
    60_000
  );

  it(
    "test_compensation_path_emits_correct_audit_events_for_saga_lifecycle_and_steps",
    async () => {
      // 审计事件序列：saga.started + 5 step.execute.outcome (4 succeeded
      // + 1 failed) + N compensation 相关 event + saga.completed.
      // K.7 不变量 4 间接验证（每次状态变化必经 audit append + persist）.
      const engines = harnessP.engines!;
      const saga = createLiquidationSaga({
        sagaStateStore: harnessP.sagaStateStore,
        deadLetterStore: harnessP.deadLetterStore,
        auditEventSink: harnessP.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const input = buildLiquidationInput("compensation-P-audit-1");
      const result = await saga.runForCase(input);
      expect(result.ok).toBe(true);

      const sagaLifecycleEvents = harnessP.auditSink.events.filter(
        (e) => e.eventType === "saga.started" || e.eventType === "saga.completed"
      );
      expect(sagaLifecycleEvents.length).toBeGreaterThanOrEqual(2);
      expect(sagaLifecycleEvents.some((e) => e.eventType === "saga.started")).toBe(true);
      expect(sagaLifecycleEvents.some((e) => e.eventType === "saga.completed")).toBe(true);

      // saga.step.* events：每个正向 step + 补偿过程都必经 audit append.
      const stepEvents = harnessP.auditSink.events.filter((e) =>
        e.eventType.startsWith("saga.step.")
      );
      expect(stepEvents.length).toBeGreaterThanOrEqual(STEP_NAMES.length);

      // 每个 expected step name 至少在某个 step event payload 出现一次.
      for (const stepName of STEP_NAMES) {
        const matched = stepEvents.some(
          (e) => (e.payload as Record<string, unknown>)["stepName"] === stepName
        );
        expect(matched).toBe(true);
      }

      // 失败 step (settle-fund-transfer) 必含 failed outcome event.
      const failedOutcomeEvents = stepEvents.filter((e) => {
        const payload = e.payload as Record<string, unknown>;
        return (
          payload["stepName"] === "settle-fund-transfer" &&
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
      // §8.1 严守：补偿路径状态变化全部真实持久化到 Postgres.
      // K.7 不变量 4 主测：listIncomplete() 终态后空（saga 不再 in_progress/
      // compensating）.
      const engines = harnessP.engines!;
      const saga = createLiquidationSaga({
        sagaStateStore: harnessP.sagaStateStore,
        deadLetterStore: harnessP.deadLetterStore,
        auditEventSink: harnessP.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const input = buildLiquidationInput("compensation-P-persist-1");
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
      // K.7 不变量 1 主测：HTTP path 顺序断言.
      // 正向阶段：query-mark-price → list-open-positions → place-order →
      //          release-margin → transfer-fund (FAIL)
      // 补偿阶段：lock-margin (step 4) → cancel-order (step 3)
      //          （严格逆序：先 step 4 后 step 3；步骤 1+2 noop 无 HTTP）
      const engines = harnessP.engines!;
      const saga = createLiquidationSaga({
        sagaStateStore: harnessP.sagaStateStore,
        deadLetterStore: harnessP.deadLetterStore,
        auditEventSink: harnessP.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const input = buildLiquidationInput("compensation-P-reverse-1");
      const result = await saga.runForCase(input);
      expect(result.ok).toBe(true);

      const observedPaths = fakeServerP.receivedRequests.map((r) => r.path);

      // 正向 5 step HTTP 全部触发（含 transfer-fund 的 FAIL response）.
      for (const expectedPath of FORWARD_STEP_PATHS) {
        expect(observedPaths).toContain(expectedPath);
      }

      // 补偿阶段 HTTP（不变量 1 严格逆序）：
      // step 4 compensate (lock-margin) 先发生
      // step 3 compensate (cancel-order) 后发生
      for (const compPath of COMPENSATION_STEP_PATHS) {
        expect(observedPaths).toContain(compPath);
      }
      const lockMarginIdx = observedPaths.indexOf("/lock-margin");
      const cancelOrderIdx = observedPaths.indexOf("/cancel-order");
      // 严格逆序断言：lock-margin (step 4 compensate) 必先于 cancel-order (step 3 compensate)
      expect(lockMarginIdx).toBeGreaterThan(-1);
      expect(cancelOrderIdx).toBeGreaterThan(-1);
      expect(lockMarginIdx).toBeLessThan(cancelOrderIdx);

      // 不变量 1 + 不变量 2 联动：补偿 HTTP 仅 2 次（不含 step 1/2 noop / step 5 failed）
      const compensationHttpCount = observedPaths.filter(
        (p) => p === "/lock-margin" || p === "/cancel-order"
      ).length;
      expect(compensationHttpCount).toBe(2);
    },
    60_000
  );

  it(
    "test_compensation_paths_remain_independent_under_concurrent_execution",
    async () => {
      // K.7 不变量 5 并发维度：2 个并发补偿 saga（不同 caseId）互不干扰.
      const engines = harnessP.engines!;
      const saga = createLiquidationSaga({
        sagaStateStore: harnessP.sagaStateStore,
        deadLetterStore: harnessP.deadLetterStore,
        auditEventSink: harnessP.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const inputA = buildLiquidationInput("compensation-P-concurrent-A");
      const inputB = buildLiquidationInput("compensation-P-concurrent-B");

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

      // 两个并发补偿 saga 应触发 ≥ 2 × 7 = 14 个 HTTP call.
      // 单 saga：5 正向 (含 transfer-fund FAIL) + 2 补偿 (lock-margin + cancel-order) = 7
      expect(fakeServerP.receivedRequests.length).toBeGreaterThanOrEqual(14);

      // delay 让 Kafka consumer poll 稳定（与 Step 2/3 同模式）.
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
      // 时序：step 5 execute fail (transfer-fund FAIL) → 触发补偿；
      //       step 4 compensate (lock-margin FAIL) → status = compensation_failed
      //       → 不变量 3 死信入队 step 4 (release-margin)；
      //       step 3 compensate (cancel-order success) → 不变量 5 链式继续
      //       即使 step 4 compensation fail，step 3 仍执行补偿；
      //       终态 partially_compensated (Q).
      const engines = harnessQ.engines!;
      const saga = createLiquidationSaga({
        sagaStateStore: harnessQ.sagaStateStore,
        deadLetterStore: harnessQ.deadLetterStore,
        auditEventSink: harnessQ.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const input = buildLiquidationInput("compensation-Q-1");
      const result = await saga.runForCase(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Q 终态：部分补偿失败 → partially_compensated
        expect(result.value.status).toBe("partially_compensated");

        // step 4 status = dead_lettered (compensation 失败 → 死信)
        // step 3 status = compensated (不变量 5 链式继续 + cancel-order success)
        expect(result.value.stepStatuses[3]?.status).toBe("dead_lettered");
        expect(result.value.stepStatuses[2]?.status).toBe("compensated");
        // step 4 (failed execute) 仍是 failed
        expect(result.value.stepStatuses[4]?.status).toBe("failed");
      }

      // 不变量 3 主测：死信表含 step 4 (release-margin) 入队记录.
      const pendingResult = await harnessQ.deadLetterStore.listPending();
      expect(pendingResult.ok).toBe(true);
      if (pendingResult.ok) {
        const releaseMargineDeadLetters = pendingResult.value.filter(
          (entry: DeadLetterEntry) => entry.stepName === "release-margin"
        );
        expect(releaseMargineDeadLetters.length).toBeGreaterThanOrEqual(1);
      }

      // 不变量 5 链式继续验证：HTTP 调用中 cancel-order 仍出现
      // （即使 lock-margin compensate fail，step 3 compensate 没被阻断）.
      const observedPaths = fakeServerQ.receivedRequests.map((r) => r.path);
      expect(observedPaths).toContain("/lock-margin"); // step 4 compensate 尝试（fail response）
      expect(observedPaths).toContain("/cancel-order"); // step 3 compensate (success)
      // 严格逆序仍兑现：lock-margin (step 4) 先发生.
      const lockMarginIdx = observedPaths.indexOf("/lock-margin");
      const cancelOrderIdx = observedPaths.indexOf("/cancel-order");
      expect(lockMarginIdx).toBeLessThan(cancelOrderIdx);
    },
    60_000
  );
});
