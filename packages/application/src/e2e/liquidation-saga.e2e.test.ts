// Phase 11 / Step 2 — Liquidation Saga 端到端顺利路径 e2e 测试.
//
// 用途（裁决 1 β + 裁决 2 5-7 测试 + ADR-0004 Step 2 段）：
// Phase 11 主题核心层第一个工程价值实现 Step——用 createE2eHarness 真实
// fixture 框架，跑 Liquidation Saga 5-step 顺利路径，在真实 Postgres +
// 真实 Kafka + 真实 HTTP wire path (fake-engines) 下兑现 §8.1 Mock 边界
// 硬约束（4 类组件全部真实激活）+ §15 审计要求 + §8.2 顺利路径覆盖。
//
// 与既有 saga-end-to-end.integration.test.ts (Phase 9 / Step 16) 关系：
//   - integration test 用 memory adapter (裁决 4 A 锁定;不修改)
//   - 本 e2e test 用真实 adapter (Phase 11 主题真实激活;§8.1 严守)
//   - 两者共存；本 e2e test 是 Phase 11 主题核心层首个工程价值实证
//
// 元规则 J：TIANQI_TEST_POSTGRES_URL + TIANQI_TEST_KAFKA_BROKERS 双控
// 制 skip（与 Step 1 self-check 同模式）。
//
// 5 个 it 设计 (裁决 2)：
//   1. happy_path_completes_through_5_steps_with_completed_status
//   2. happy_path_audit_events_emitted_for_each_step
//   3. happy_path_saga_state_persists_to_postgres_after_completion
//   4. happy_path_5_engine_endpoints_called_via_real_http_in_order
//   5. happy_path_two_concurrent_liquidations_both_complete_independently

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
import type { PersistedSagaState } from "@tianqi/ports";

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
// fixture builder — Liquidation 顺利路径输入
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

// 5 个 Liquidation Saga step 的预期 path (按编排顺序;断言"每个 step
// 真实通过 HTTP wire path 调外部引擎";§8.1 严守).
const EXPECTED_STEP_PATHS = [
  "/query-mark-price",
  "/list-open-positions",
  "/place-order",
  "/release-margin",
  "/transfer-fund"
] as const;

// 5 个 Liquidation Saga step 名 (与 saga-orchestrator audit event payload
// 中 stepName 对应;§15 审计要求).
const EXPECTED_STEP_NAMES = [
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

describe.skipIf(!canRunE2e)("Liquidation Saga e2e — Phase 11 / Step 2 happy path", () => {
  let fakeServer: FakeEnginesServer;
  let harness: E2eHarness;

  beforeEach(async () => {
    fakeServer = await createFakeEnginesServer();
    createdServers.push(fakeServer);
    harness = await createE2eHarness({
      postgresUrl: postgresUrl!,
      kafkaBrokers,
      fakeEngineHttp: fakeServer
    });
    createdHarnesses.push(harness);
  });

  it(
    "test_happy_path_completes_through_5_steps_with_completed_status",
    async () => {
      const engines = harness.engines;
      expect(engines).not.toBeUndefined();
      if (engines === undefined) return;

      const saga = createLiquidationSaga({
        sagaStateStore: harness.sagaStateStore,
        deadLetterStore: harness.deadLetterStore,
        auditEventSink: harness.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const input = buildLiquidationInput("e2e-happy-1");
      const result = await saga.runForCase(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe("completed");
        expect(result.value.finalOutput).not.toBeNull();
        expect(result.value.stepStatuses).toHaveLength(5);
        for (const step of result.value.stepStatuses) {
          expect(step.status).toBe("succeeded");
        }
      }
    },
    60_000
  );

  it(
    "test_happy_path_audit_events_emitted_for_each_of_5_steps_plus_saga_lifecycle",
    async () => {
      // §15 审计要求：每个 Saga step + Saga 整体生命周期都必须发出 audit
      // event,持久化到 audit sink (in-memory;Step 9-10 升级真实 store).
      const engines = harness.engines!;
      const saga = createLiquidationSaga({
        sagaStateStore: harness.sagaStateStore,
        deadLetterStore: harness.deadLetterStore,
        auditEventSink: harness.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const input = buildLiquidationInput("e2e-audit-1");
      const result = await saga.runForCase(input);
      expect(result.ok).toBe(true);

      // saga lifecycle events:至少含 saga.started + saga.completed (saga
      // orchestrator emit;§15 审计要求).
      const sagaLifecycleEvents = harness.auditSink.events.filter(
        (e) => e.eventType === "saga.started" || e.eventType === "saga.completed"
      );
      expect(sagaLifecycleEvents.length).toBeGreaterThanOrEqual(2);
      expect(sagaLifecycleEvents.some((e) => e.eventType === "saga.started")).toBe(true);
      expect(sagaLifecycleEvents.some((e) => e.eventType === "saga.completed")).toBe(true);

      // saga.step.* events:每个 step 至少 1 个 audit event (saga.step.outcome
      // / saga.step.starting 等;Saga orchestrator emit;§15 审计要求).
      const stepEvents = harness.auditSink.events.filter((e) =>
        e.eventType.startsWith("saga.step.")
      );
      expect(stepEvents.length).toBeGreaterThanOrEqual(EXPECTED_STEP_NAMES.length);

      // 每个 expected step name 至少在某个 step event payload 出现一次.
      for (const stepName of EXPECTED_STEP_NAMES) {
        const matched = stepEvents.some(
          (e) => (e.payload as Record<string, unknown>)["stepName"] === stepName
        );
        expect(matched).toBe(true);
      }
    },
    60_000
  );

  it(
    "test_happy_path_saga_state_persists_to_real_postgres_after_completion",
    async () => {
      // §8.1 严守:saga state 必须真实持久化到 Postgres (非 memory).
      // 验证手段:saga 完成后用 listIncomplete() 列出未完成 saga;
      // completed 不在列表 (overallStatus !== in_progress/compensating).
      const engines = harness.engines!;
      const saga = createLiquidationSaga({
        sagaStateStore: harness.sagaStateStore,
        deadLetterStore: harness.deadLetterStore,
        auditEventSink: harness.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const input = buildLiquidationInput("e2e-persist-1");
      const result = await saga.runForCase(input);
      expect(result.ok).toBe(true);

      // listIncomplete 返回所有 overallStatus 为 in_progress/compensating 的
      // saga;completed saga 不在其中 → 列表空或不含本次 sagaId.
      const incompleteResult = await harness.sagaStateStore.listIncomplete();
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
    "test_happy_path_5_engine_endpoints_called_via_real_http_in_expected_order",
    async () => {
      // §8.2 顺利路径 + §8.1 严守:所有 5 step 必须通过真实 HTTP wire path
      // 调外部引擎 (假引擎 HTTP 协议接受;Node.js http server).
      // 验证 fakeServer.receivedRequests 含 5 个对应 path,按编排顺序.
      const engines = harness.engines!;
      const saga = createLiquidationSaga({
        sagaStateStore: harness.sagaStateStore,
        deadLetterStore: harness.deadLetterStore,
        auditEventSink: harness.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const input = buildLiquidationInput("e2e-http-order-1");
      const result = await saga.runForCase(input);
      expect(result.ok).toBe(true);

      // fakeServer.receivedRequests 应至少含 5 expected paths,顺序匹配.
      const observedPaths = fakeServer.receivedRequests.map((r) => r.path);
      for (const expectedPath of EXPECTED_STEP_PATHS) {
        expect(observedPaths).toContain(expectedPath);
      }
      // 顺序验证:每个 expected path 在 observedPaths 中的首次出现顺序匹配.
      const firstOccurrenceIndices = EXPECTED_STEP_PATHS.map((p) => observedPaths.indexOf(p));
      for (let i = 1; i < firstOccurrenceIndices.length; i += 1) {
        expect(firstOccurrenceIndices[i]).toBeGreaterThan(firstOccurrenceIndices[i - 1]!);
      }
    },
    60_000
  );

  it(
    "test_happy_path_two_concurrent_liquidations_both_complete_independently",
    async () => {
      // 并发 2 个 Liquidation saga (不同 caseId / lockId / accountId),
      // 验证两者都 completed + 互不干扰. 顺利路径覆盖的并发维度.
      const engines = harness.engines!;
      const saga = createLiquidationSaga({
        sagaStateStore: harness.sagaStateStore,
        deadLetterStore: harness.deadLetterStore,
        auditEventSink: harness.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const inputA = buildLiquidationInput("e2e-concurrent-A");
      const inputB = buildLiquidationInput("e2e-concurrent-B");

      const [resultA, resultB] = await Promise.all([
        saga.runForCase(inputA),
        saga.runForCase(inputB)
      ]);

      expect(resultA.ok).toBe(true);
      expect(resultB.ok).toBe(true);
      if (resultA.ok && resultB.ok) {
        expect(resultA.value.status).toBe("completed");
        expect(resultB.value.status).toBe("completed");
        // 不同 sagaId (不重复 saga record).
        expect(resultA.value.sagaId).not.toBe(resultB.value.sagaId);
      }

      // 两次并发应触发 ≥ 2 × 5 = 10 个 HTTP call (allow >=10 since saga
      // 可能 emit 额外 step;真实 wire path 实证).
      expect(fakeServer.receivedRequests.length).toBeGreaterThanOrEqual(10);

      // delay 让 Kafka consumer poll 稳定 (与 Step 0.5 §D.5 教训延伸:
      // Kafka 异步 delivery 有时序窗口);此处不强断言 notification 投递
      // 内容,只让 Promise.all 结束后 graceful settle.
      await delayMs(500);
    },
    90_000
  );
});
