// Phase 9 / Step 14 — cross-saga-coordination 集成测试。
//
// 4 集成 it（≤4 上限）使用真实 saga-state-store-memory adapter 驱动
// 协调模块的端到端行为。重点：
//
//   1. test_with_real_in_memory_adapter_returns_in_progress_saga_for_case
//      —— 单 saga in_progress 真实持久化场景下协调模块正确返回
//
//   2. test_simultaneous_two_sagas_for_same_case_seen_by_coordinator
//      —— **G24 跨 Saga 真实并发场景**：同 caseId 两个不同 kind Saga
//      （Liquidation + ADL）同时活跃；协调模块返回 2 个 ActiveSagaInfo
//      按 startedAt 升序；模拟 Tianqi 业务流程语义触发的"状态机推进串行"
//      场景下"前一个 Saga 未结束又触发后一个"的边界情况
//
//   3. test_completed_saga_excluded_from_active_list
//      —— 终态 Saga（completed / compensated / partially_compensated /
//      timed_out）由 listIncomplete 自动排除；协调模块不需额外过滤
//
//   4. test_sagaKindFilter_end_to_end_with_real_adapter
//      —— 跨 caseId 隔离 + sagaKindFilter 端到端；模拟"调用方仅关心
//      Liquidation 类是否活跃"的真实业务策略
//
// **真实 adapter** 而非 mock：本测试套件使用 createInMemorySagaStateStore
// （Sprint F Step 3 锁定 + 元规则 N README Semantics 三条）。集成测试
// 验证"协调模块 + 真实 SagaStateStorePort 实现"端到端语义。
//
// 时序：本测试套件零时序断言（KI-P8-003 防御）；所有断言基于显式 save
// 注入的 PersistedSagaState + 同步控制流。

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createInMemorySagaStateStore } from "@tianqi/saga-state-store-memory";

import type {
  PersistedSagaState,
  PersistedSagaStateOverallStatus,
  SagaStateStorePort
} from "@tianqi/ports";
import { createSagaId } from "@tianqi/ports";

import {
  createCrossSagaCoordination,
  type CrossSagaCoordinationDegradedFailureEvent
} from "./cross-saga-coordination.js";

// ============================================================
// 测试基础设施
// ============================================================

let store: SagaStateStorePort & { init(): Promise<void>; shutdown(): Promise<void> };

beforeEach(async () => {
  store = createInMemorySagaStateStore();
  await store.init();
});

afterEach(async () => {
  await store.shutdown();
});

const buildPersistedState = (
  sagaId: string,
  overallStatus: PersistedSagaStateOverallStatus,
  startedAt: string
): PersistedSagaState => ({
  sagaId: createSagaId(sagaId),
  sagaStartedAt: startedAt,
  lastUpdatedAt: startedAt,
  currentStepIndex: 0,
  totalSteps: 5,
  stepStatuses: [],
  compensationContexts: [],
  overallStatus,
  correlationId: null,
  traceId: null
});

// ============================================================
// 集成测试套件
// ============================================================

describe("cross-saga-coordination integration with saga-state-store-memory", () => {
  it("test_with_real_in_memory_adapter_returns_in_progress_saga_for_case", async () => {
    // 单 saga in_progress 真实持久化场景
    const persisted = buildPersistedState(
      "liquidation-saga-CASE-INT-001-1735689600000-1",
      "in_progress",
      "2026-05-01T10:00:00.000Z"
    );
    const saveResult = await store.save(persisted);
    expect(saveResult.ok).toBe(true);

    const coord = createCrossSagaCoordination({ sagaStateStore: store });
    const result = await coord.checkActiveSagaForCase({ caseId: "CASE-INT-001" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.sagaKind).toBe("liquidation");
      expect(result.value[0]?.caseId).toBe("CASE-INT-001");
      expect(result.value[0]?.overallStatus).toBe("in_progress");
      expect(result.value[0]?.startedAt).toBe("2026-05-01T10:00:00.000Z");
    }

    // 不同 caseId 的查询应返回空数组
    const otherResult = await coord.checkActiveSagaForCase({
      caseId: "CASE-INT-OTHER"
    });
    if (otherResult.ok) {
      expect(otherResult.value).toEqual([]);
    }
  });

  it("test_simultaneous_two_sagas_for_same_case_seen_by_coordinator", async () => {
    // **G24 跨 Saga 真实并发场景验证 it**：
    //
    // 模拟 Tianqi 状态机推进串行流程的"前一 Saga 未结束又触发后一 Saga"
    // 边界情况——譬如 LiquidationSaga 还在 compensating 中时已被错误
    // 触发 ADL Saga；协调模块的查询应让调用方看到两个活跃 Saga 从而
    // 防御重复触发。
    //
    // 时序：两个 PersistedSagaState 不同 startedAt（差 100ms）；按升序
    // 排序后 ADL（先触发） → Liquidation（后触发）。
    const liquidationState = buildPersistedState(
      "liquidation-saga-CASE-CONCURRENT-001-1735689600200-2",
      "compensating",
      "2026-05-01T10:00:00.200Z"
    );
    const adlState = buildPersistedState(
      "adl-saga-CASE-CONCURRENT-001-1735689600100-1",
      "in_progress",
      "2026-05-01T10:00:00.100Z"
    );

    const liquidationSave = await store.save(liquidationState);
    expect(liquidationSave.ok).toBe(true);
    const adlSave = await store.save(adlState);
    expect(adlSave.ok).toBe(true);

    const coord = createCrossSagaCoordination({ sagaStateStore: store });
    const result = await coord.checkActiveSagaForCase({
      caseId: "CASE-CONCURRENT-001"
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 两个 Saga 都被识别为活跃
      expect(result.value).toHaveLength(2);
      // 按 startedAt 升序：ADL 先（10:00:00.100）→ Liquidation 后（10:00:00.200）
      expect(result.value[0]?.sagaKind).toBe("adl");
      expect(result.value[0]?.overallStatus).toBe("in_progress");
      expect(result.value[1]?.sagaKind).toBe("liquidation");
      expect(result.value[1]?.overallStatus).toBe("compensating");
    }

    // 调用方典型业务策略：发现已有活跃 Saga 后拒绝启动新的同类 Saga
    // （此处仅模拟决策；实际拒绝逻辑在调用方 Application 层）
    const sagaKindFilterResult = await coord.checkActiveSagaForCase({
      caseId: "CASE-CONCURRENT-001",
      sagaKindFilter: ["liquidation", "adl"]
    });
    if (sagaKindFilterResult.ok) {
      expect(sagaKindFilterResult.value).toHaveLength(2);
    }
  });

  it("test_completed_saga_excluded_from_active_list", async () => {
    // 终态 Saga 由 SagaStateStorePort.listIncomplete 自动排除（Step 3
    // 锁定语义：仅 in_progress / compensating 返回）；协调模块的返回
    // 与既有 listIncomplete 行为一致。
    const completedState = buildPersistedState(
      "liquidation-saga-CASE-INT-002-1735689600000-1",
      "completed",
      "2026-05-01T11:00:00.000Z"
    );
    const compensatedState = buildPersistedState(
      "adl-saga-CASE-INT-002-1735689600100-2",
      "compensated",
      "2026-05-01T11:00:01.000Z"
    );
    const partiallyCompensatedState = buildPersistedState(
      "insurance-fund-saga-CASE-INT-002-1735689600200-3",
      "partially_compensated",
      "2026-05-01T11:00:02.000Z"
    );
    const timedOutState = buildPersistedState(
      "state-transition-saga-CASE-INT-002-1735689600300-4",
      "timed_out",
      "2026-05-01T11:00:03.000Z"
    );
    const inProgressState = buildPersistedState(
      "liquidation-saga-CASE-INT-002-1735689600400-5",
      "in_progress",
      "2026-05-01T11:00:04.000Z"
    );

    for (const state of [
      completedState,
      compensatedState,
      partiallyCompensatedState,
      timedOutState,
      inProgressState
    ]) {
      const save = await store.save(state);
      expect(save.ok).toBe(true);
    }

    const coord = createCrossSagaCoordination({ sagaStateStore: store });
    const result = await coord.checkActiveSagaForCase({ caseId: "CASE-INT-002" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 4 个终态 Saga 全部被排除；仅 in_progress 的返回
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.sagaKind).toBe("liquidation");
      expect(result.value[0]?.overallStatus).toBe("in_progress");
    }
  });

  it("test_sagaKindFilter_end_to_end_with_real_adapter_and_caseId_isolation", async () => {
    // sagaKindFilter 端到端 + 跨 caseId 隔离 + onDegradedFailure 触发
    // 真实路径（v2 修订核心 it 集成版）。
    //
    // 构造 4 saga：
    //   - CASE-A 的 Liquidation（in_progress）
    //   - CASE-A 的 ADL（in_progress）
    //   - CASE-B 的 Liquidation（in_progress）  ← 不同 caseId 应被过滤
    //   - 不可解析的 sagaId（应触发 onDegradedFailure）
    const states: PersistedSagaState[] = [
      buildPersistedState(
        "liquidation-saga-CASE-A-1735689600000-1",
        "in_progress",
        "2026-05-01T12:00:00.000Z"
      ),
      buildPersistedState(
        "adl-saga-CASE-A-1735689600100-2",
        "in_progress",
        "2026-05-01T12:00:01.000Z"
      ),
      buildPersistedState(
        "liquidation-saga-CASE-B-1735689600200-3",
        "in_progress",
        "2026-05-01T12:00:02.000Z"
      ),
      // 不可解析（kind 不在白名单）；模拟 Phase 10+ 引入新 Saga 但忘
      // 同步 BusinessSagaKind 的命名约定漂移场景
      buildPersistedState(
        "future-saga-saga-CASE-A-1735689600300-4",
        "in_progress",
        "2026-05-01T12:00:03.000Z"
      )
    ];
    for (const state of states) {
      const save = await store.save(state);
      expect(save.ok).toBe(true);
    }

    const events: CrossSagaCoordinationDegradedFailureEvent[] = [];
    const coord = createCrossSagaCoordination(
      { sagaStateStore: store },
      {
        sagaKindFilter: ["liquidation"],
        onDegradedFailure: e => {
          events.push(e);
        }
      }
    );

    // CASE-A 仅 Liquidation 类（工厂级 filter）
    const caseAResult = await coord.checkActiveSagaForCase({ caseId: "CASE-A" });
    expect(caseAResult.ok).toBe(true);
    if (caseAResult.ok) {
      expect(caseAResult.value).toHaveLength(1);
      expect(caseAResult.value[0]?.sagaKind).toBe("liquidation");
      expect(caseAResult.value[0]?.caseId).toBe("CASE-A");
    }

    // 跨 caseId 隔离：CASE-B 不应被 CASE-A 查询到
    const caseBResult = await coord.checkActiveSagaForCase({ caseId: "CASE-B" });
    expect(caseBResult.ok).toBe(true);
    if (caseBResult.ok) {
      expect(caseBResult.value).toHaveLength(1);
      expect(caseBResult.value[0]?.caseId).toBe("CASE-B");
    }

    // 不可解析 sagaId 触发了 onDegradedFailure（每次查询都会遇到）
    // 经过两次查询，2 个 caseA + 2 个 caseB → 4 次回调（每次查询遍历全部）
    // 验证至少触发 ≥1 次（具体次数取决于查询次数）
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.every(e => e.kind === "unparseable_saga_id")).toBe(true);
    expect(
      events.every(e => e.sagaId === "future-saga-saga-CASE-A-1735689600300-4")
    ).toBe(true);
  });
});
