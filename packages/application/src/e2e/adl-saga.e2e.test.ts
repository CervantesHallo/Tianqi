// Phase 11 / Step 3 — ADL Saga 端到端顺利路径 e2e 测试.
//
// 用途（PHASE_DESIGN K.3 α' 与 Step 2 严格对称 + ADR-0004 Step 3 段）：
// Phase 11 主题核心层第二个工程价值实现 Step——用 createE2eHarness 真实
// fixture 框架，跑 ADL Saga 5-step 顺利路径，在真实 Postgres + 真实 Kafka
// + 真实 HTTP wire path (fake-engines) 下兑现 §8.1 Mock 边界硬约束（4 类
// 组件全部真实激活）+ §15 审计要求 + §8.2 顺利路径覆盖（ADL 流程）.
//
// 与 Step 2 liquidation-saga.e2e.test.ts 的对称性（PHASE_DESIGN K.3 α'）：
// 本文件 1:1 mirror Step 2 的 5 视角（completes / audit / persist / HTTP
// order / concurrent），仅业务流程切到 ADL（多账户公平减仓 + 保险资金联动）.
//
// ADL Saga 与 Liquidation Saga 业务差异（K.1 实测）：
//   - Step 数：同（5 step）；模板复用 Liquidation Step 10
//   - Engine 集合：ADL 不调用 MarginEngine（4 engine vs Liquidation 5 engine）
//   - 多账户：ADL targets[] 数组（多账户 C-fail-fast 循环）
//   - 保险资金：ADL 含 insurance-fund-deduction step（Liquidation 无）
//   - Ports 类型别名：ADLSagaPorts = LiquidationSagaPorts（裁决 3 类型复用）
//
// 元规则 J：TIANQI_TEST_POSTGRES_URL + TIANQI_TEST_KAFKA_BROKERS 双控
// 制 skip（与 Step 1 + Step 2 同模式）。
//
// 5 个 it 设计（K.3 α' 与 Step 2 1:1 对称）：
//   1. happy_path_completes_through_5_steps_with_completed_status
//   2. happy_path_audit_events_emitted_for_each_of_5_steps_plus_saga_lifecycle
//   3. happy_path_saga_state_persists_to_real_postgres_after_completion
//   4. happy_path_4_engine_endpoints_called_via_real_http_in_expected_order
//      （ADL 4 endpoint 不含 release-margin；与 Step 2 5 endpoint 差异）
//   5. happy_path_two_concurrent_adl_sagas_both_complete_independently

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
import type { PersistedSagaState } from "@tianqi/ports";

import {
  createADLSaga,
  type ADLInput,
  type DeleveragingTarget
} from "../saga/adl-saga.js";

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
// fixture builder — ADL 顺利路径输入
// ============================================================

/**
 * 构建单个 DeleveragingTarget fixture（K.1 实测 8 字段全部）。
 *
 * targetSuffix 用作 brand id 后缀，确保并发场景下 target 之间 id 不冲突；
 * fundAccountId / matchAccountId / positionAccountId 三个独立 account 维度
 * 因 ADL 多账户场景由调用方分别选定。
 */
const buildDeleveragingTarget = (
  targetSuffix: string,
  overrides: Partial<DeleveragingTarget> = {}
): DeleveragingTarget => ({
  accountId: createPositionAccountId("acct-pos-adl-" + targetSuffix),
  fundAccountId: createFundAccountId("acct-fund-adl-" + targetSuffix),
  matchAccountId: createMatchAccountId("acct-match-adl-" + targetSuffix),
  positionId: createPositionId("pos-adl-" + targetSuffix),
  symbol: "BTC-USDT",
  deleveragingSide: "sell", // 减仓方向（与持仓相反）
  deleveragingQuantity: createPositionSize(0.5),
  expectedDeleveragingPrice: createMarkPriceValue(50_000),
  accountSettleAmount: createFundAmount(500),
  ...overrides
});

/**
 * 构建 ADLInput fixture（K.1 实测 10 字段全部）。
 *
 * 默认 2 个 targets（双账户多账户场景；step 内部循环验证 + C-fail-fast
 * 至少 2 次循环；与 Step 2 单账户 Liquidation 形成业务复杂度对比）.
 */
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

// 4 个 ADL Saga step 对应的 fake-engines HTTP path（K.1 实测）.
// 注意：/transfer-fund 被 step 4 (insurance-fund-deduction) + step 5
// (settle-account-funds) 共用；EXPECTED_STEP_PATHS 仅列首次出现的 4 个
// distinct path. 顺序断言用"首次出现位置"判定（与 Step 2 模式一致）.
const EXPECTED_STEP_PATHS = [
  "/query-mark-price-batch",
  "/query-position",
  "/place-order",
  "/transfer-fund"
] as const;

// 5 个 ADL Saga step 名（与 saga-orchestrator audit event payload 中
// stepName 对应；§15 审计要求；K.1 实测来自 adl-saga.ts buildXxxStep
// 工厂的 name 字段）.
const EXPECTED_STEP_NAMES = [
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

describe.skipIf(!canRunE2e)("ADL Saga e2e — Phase 11 / Step 3 happy path", () => {
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

      // ADLSagaPorts = LiquidationSagaPorts (裁决 3 类型别名)：仍需传入 5
      // engine 全集（含 margin，ADL 不调用但类型签名要求）；harness.engines
      // 已就绪 5 个真实 HTTP adapter.
      const saga = createADLSaga({
        sagaStateStore: harness.sagaStateStore,
        deadLetterStore: harness.deadLetterStore,
        auditEventSink: harness.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const input = buildAdlInput("e2e-happy-1");
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
      const saga = createADLSaga({
        sagaStateStore: harness.sagaStateStore,
        deadLetterStore: harness.deadLetterStore,
        auditEventSink: harness.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const input = buildAdlInput("e2e-audit-1");
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
      const saga = createADLSaga({
        sagaStateStore: harness.sagaStateStore,
        deadLetterStore: harness.deadLetterStore,
        auditEventSink: harness.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const input = buildAdlInput("e2e-persist-1");
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
    "test_happy_path_4_engine_endpoints_called_via_real_http_in_expected_order",
    async () => {
      // §8.2 顺利路径 + §8.1 严守:所有 5 step 必须通过真实 HTTP wire path
      // 调外部引擎 (假引擎 HTTP 协议接受;Node.js http server).
      // 验证 fakeServer.receivedRequests 含 4 个 distinct path（按编排顺序）.
      //
      // ADL 4 endpoint vs Liquidation 5 endpoint 差异（K.1 实测）：
      // - ADL 不含 /release-margin（无 MarginEngine.releaseMargin step）
      // - ADL 含 /query-mark-price-batch（vs Liquidation /query-mark-price）
      // - ADL 含 /query-position（vs Liquidation /list-open-positions）
      //
      // /transfer-fund 被 step 4 (insurance-fund-deduction; 1 call)
      // + step 5 (settle-account-funds; N calls) 共用；
      // EXPECTED_STEP_PATHS 仅列首次出现的 4 个 distinct path.
      const engines = harness.engines!;
      const saga = createADLSaga({
        sagaStateStore: harness.sagaStateStore,
        deadLetterStore: harness.deadLetterStore,
        auditEventSink: harness.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const input = buildAdlInput("e2e-http-order-1");
      const result = await saga.runForCase(input);
      expect(result.ok).toBe(true);

      // fakeServer.receivedRequests 应至少含 4 distinct paths,顺序匹配.
      const observedPaths = fakeServer.receivedRequests.map((r) => r.path);
      for (const expectedPath of EXPECTED_STEP_PATHS) {
        expect(observedPaths).toContain(expectedPath);
      }
      // 顺序验证:每个 expected path 在 observedPaths 中的首次出现顺序匹配.
      const firstOccurrenceIndices = EXPECTED_STEP_PATHS.map((p) => observedPaths.indexOf(p));
      for (let i = 1; i < firstOccurrenceIndices.length; i += 1) {
        expect(firstOccurrenceIndices[i]).toBeGreaterThan(firstOccurrenceIndices[i - 1]!);
      }

      // ADL 多账户 + multi-step transfer-fund 验证：
      // - /query-position 至少 2 次 (verify-targets × 2 targets)
      // - /place-order 至少 2 次 (submit-deleveraging-orders × 2 targets)
      // - /transfer-fund 至少 3 次 (insurance × 1 + settle × 2 targets)
      const positionCount = observedPaths.filter((p) => p === "/query-position").length;
      const placeOrderCount = observedPaths.filter((p) => p === "/place-order").length;
      const transferFundCount = observedPaths.filter((p) => p === "/transfer-fund").length;
      expect(positionCount).toBeGreaterThanOrEqual(2);
      expect(placeOrderCount).toBeGreaterThanOrEqual(2);
      expect(transferFundCount).toBeGreaterThanOrEqual(3);
    },
    60_000
  );

  it(
    "test_happy_path_two_concurrent_adl_sagas_both_complete_independently",
    async () => {
      // 并发 2 个 ADL saga (不同 caseId / target accountIds),
      // 验证两者都 completed + 互不干扰. 顺利路径覆盖的并发维度.
      const engines = harness.engines!;
      const saga = createADLSaga({
        sagaStateStore: harness.sagaStateStore,
        deadLetterStore: harness.deadLetterStore,
        auditEventSink: harness.auditSink,
        markPrice: engines.markPrice,
        position: engines.position,
        match: engines.match,
        margin: engines.margin,
        fund: engines.fund
      });

      const inputA = buildAdlInput("e2e-concurrent-A");
      const inputB = buildAdlInput("e2e-concurrent-B");

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

      // 两次并发 ADL 应触发显著的 HTTP call (单 saga ≥ 7 calls:
      // 1 batch + 2 query-position + 2 place-order + 1 insurance + 2 settle
      // = 8 calls/saga;2 并发 → ≥ 16). 真实 wire path 实证.
      expect(fakeServer.receivedRequests.length).toBeGreaterThanOrEqual(16);

      // delay 让 Kafka consumer poll 稳定 (与 Step 2 同模式).
      await delayMs(500);
    },
    90_000
  );
});
