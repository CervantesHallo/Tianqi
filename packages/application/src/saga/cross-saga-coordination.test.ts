// Phase 9 / Step 14 — cross-saga-coordination 单元测试。
//
// 6 unit it（≤6 上限；惯例 L 业务模块单独计算）：
//
//   1. parseSagaIdToInfo: 4 业务 Saga 命名约定全部解析成功 +
//      SAGA_ID_NAMING_CONVENTION 常量自洽性（元规则 N 第 2 次实战）
//   2. parseSagaIdToInfo: 解析失败返回 null 的 6 类边界 case
//   3. checkActiveSagaForCase: 同 caseId 无活跃 Saga 返回空数组（不同 caseId
//      过滤 + 终态防御性核查）
//   4. checkActiveSagaForCase: 同 caseId 多 Saga + sagaKindFilter 过滤 +
//      按 startedAt 升序 + per-call sagaKindFilter 优先级覆盖工厂级
//   5. checkActiveSagaForCase: onDegradedFailure 触发 — listIncomplete
//      返回 2 个不可解析的 sagaId，回调收到 2 次事件，可解析的正常返回
//      （v2 修订核心 it；元规则 N pure helper export 配套验证）
//   6. checkActiveSagaForCase: listIncomplete 失败 wrap 为 SagaPortError
//      （TQ-SAG-002 + 占位 sagaId / stepName + cause 携带 storeError）
//
// Mock 策略：本测试用 mock SagaStateStorePort（可控制 listIncomplete 返回
// 数据 / 失败模式）；集成测试 cross-saga-coordination.integration.test.ts
// 用真实 saga-state-store-memory adapter 驱动跨 Saga 真实并发场景。
//
// 时序：本测试套件零时序断言（KI-P8-003 防御）；所有断言基于注入数据 +
// 同步控制流。

import { describe, expect, it } from "vitest";

import { err, ok } from "@tianqi/shared";

import type {
  PersistedSagaState,
  PersistedSagaStateOverallStatus,
  SagaStateStoreError,
  SagaStateStorePort
} from "@tianqi/ports";
import { createSagaId } from "@tianqi/ports";

import {
  SAGA_ID_NAMING_CONVENTION,
  createCrossSagaCoordination,
  parseSagaIdToInfo,
  type BusinessSagaKind,
  type CrossSagaCoordinationDegradedFailureEvent
} from "./cross-saga-coordination.js";

// ============================================================
// Mock SagaStateStorePort
// ============================================================

type MockSagaStateStore = SagaStateStorePort & {
  incomplete: PersistedSagaState[];
  listFailure: SagaStateStoreError | null;
};

const createMockSagaStateStore = (): MockSagaStateStore => {
  const store: MockSagaStateStore = {
    incomplete: [],
    listFailure: null,
    async save() {
      return ok(undefined);
    },
    async load() {
      return ok(null);
    },
    async listIncomplete() {
      if (store.listFailure !== null) return err(store.listFailure);
      return ok([...store.incomplete]);
    },
    async delete() {
      return ok(undefined);
    }
  };
  return store;
};

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
// 单元测试套件
// ============================================================

describe("parseSagaIdToInfo (元规则 N pure helper)", () => {
  it("test_parses_4_business_sagas_naming_convention_with_self_consistency", () => {
    // 4 业务 Saga 既有 sagaId 命名约定全部解析成功（v2 锁定核心证据）
    const cases: Array<[string, BusinessSagaKind, string, string]> = [
      ["liquidation-saga-CASE-001-1735689600000-1", "liquidation", "CASE-001", "1735689600000-1"],
      ["adl-saga-ACC-XYZ-1735689600100-2", "adl", "ACC-XYZ", "1735689600100-2"],
      [
        "insurance-fund-saga-INS-CASE-2026-001-1735689600200-3",
        "insurance-fund",
        "INS-CASE-2026-001",
        "1735689600200-3"
      ],
      [
        "state-transition-saga-STA-2026-04-001-1735689600300-4",
        "state-transition",
        "STA-2026-04-001",
        "1735689600300-4"
      ]
    ];
    for (const [sagaId, expectedKind, expectedCaseId, expectedStamp] of cases) {
      const parsed = parseSagaIdToInfo(sagaId);
      expect(parsed).not.toBeNull();
      expect(parsed?.sagaKind).toBe(expectedKind);
      expect(parsed?.caseId).toBe(expectedCaseId);
      expect(parsed?.stamp).toBe(expectedStamp);
    }

    // SAGA_ID_NAMING_CONVENTION 常量自洽性（v2 元规则 B 锁定形态）
    expect(SAGA_ID_NAMING_CONVENTION.pattern).toBe("{kind}-saga-{caseId}-{stamp}");
    expect(SAGA_ID_NAMING_CONVENTION.separator).toBe("-saga-");
    expect(SAGA_ID_NAMING_CONVENTION.kindPrefixes).toEqual([
      "liquidation",
      "adl",
      "insurance-fund",
      "state-transition"
    ]);
  });

  it("test_returns_null_for_6_categories_of_unparseable_sagaIds", () => {
    // (1) 无 separator
    expect(parseSagaIdToInfo("liquidation-CASE-001-12345-1")).toBeNull();
    // (2) kind 候选不在 BusinessSagaKind 白名单
    expect(parseSagaIdToInfo("unknown-saga-CASE-001-12345-1")).toBeNull();
    // (3) stamp 部分缺失（rest 仅 caseId 段，少于 3 段）
    expect(parseSagaIdToInfo("adl-saga-CASE-001")).toBeNull();
    // (4) stamp 末段非纯数字
    expect(parseSagaIdToInfo("adl-saga-CASE-001-12345-X")).toBeNull();
    // (5) stamp 倒数第二段非纯数字
    expect(parseSagaIdToInfo("adl-saga-CASE-001-X-1")).toBeNull();
    // (6) caseId 段空（rest 以 - 起首）
    expect(parseSagaIdToInfo("adl-saga--12345-1")).toBeNull();
    // 边界：完全空字符串
    expect(parseSagaIdToInfo("")).toBeNull();
  });
});

describe("createCrossSagaCoordination > checkActiveSagaForCase", () => {
  it("test_returns_empty_array_when_no_active_saga_for_caseId", async () => {
    const store = createMockSagaStateStore();
    // 不同 caseId 的活跃 saga 应被过滤
    store.incomplete = [
      buildPersistedState(
        "liquidation-saga-OTHER-001-1735689600000-1",
        "in_progress",
        "2026-05-01T00:00:00.000Z"
      )
    ];
    const coord = createCrossSagaCoordination({ sagaStateStore: store });
    const result = await coord.checkActiveSagaForCase({ caseId: "CASE-001" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it("test_returns_active_sagas_for_caseId_with_filter_sort_and_per_call_override", async () => {
    const store = createMockSagaStateStore();
    store.incomplete = [
      buildPersistedState(
        "liquidation-saga-CASE-001-1735689600002-3",
        "in_progress",
        "2026-05-01T00:00:02.000Z"
      ),
      buildPersistedState(
        "adl-saga-CASE-001-1735689600000-1",
        "compensating",
        "2026-05-01T00:00:00.000Z"
      ),
      buildPersistedState(
        "insurance-fund-saga-CASE-001-1735689600001-2",
        "in_progress",
        "2026-05-01T00:00:01.000Z"
      ),
      // 不同 caseId — 应被过滤
      buildPersistedState(
        "liquidation-saga-CASE-002-1735689600000-1",
        "in_progress",
        "2026-05-01T00:00:00.000Z"
      )
    ];

    // (a) 无 filter — 返回 3 个同 caseId saga，按 startedAt 升序
    const coord = createCrossSagaCoordination({ sagaStateStore: store });
    const all = await coord.checkActiveSagaForCase({ caseId: "CASE-001" });
    expect(all.ok).toBe(true);
    if (all.ok) {
      expect(all.value).toHaveLength(3);
      expect(all.value.map(a => a.sagaKind)).toEqual([
        "adl",
        "insurance-fund",
        "liquidation"
      ]);
      // 验证 ActiveSagaInfo 5 字段完整性
      const first = all.value[0];
      expect(first?.caseId).toBe("CASE-001");
      expect(first?.sagaKind).toBe("adl");
      expect(first?.overallStatus).toBe("compensating");
      expect(first?.startedAt).toBe("2026-05-01T00:00:00.000Z");
      expect(first?.sagaId).toBe(createSagaId("adl-saga-CASE-001-1735689600000-1"));
    }

    // (b) per-call sagaKindFilter 过滤
    const liquidationOnly = await coord.checkActiveSagaForCase({
      caseId: "CASE-001",
      sagaKindFilter: ["liquidation"]
    });
    if (liquidationOnly.ok) {
      expect(liquidationOnly.value.map(a => a.sagaKind)).toEqual(["liquidation"]);
    }

    // (c) input.sagaKindFilter 优先级高于 options.sagaKindFilter
    const coordWithFactoryFilter = createCrossSagaCoordination(
      { sagaStateStore: store },
      { sagaKindFilter: ["liquidation"] }
    );
    // 工厂级 filter = liquidation；per-call filter = adl 应覆盖
    const overridden = await coordWithFactoryFilter.checkActiveSagaForCase({
      caseId: "CASE-001",
      sagaKindFilter: ["adl"]
    });
    if (overridden.ok) {
      expect(overridden.value.map(a => a.sagaKind)).toEqual(["adl"]);
    }

    // (d) options.sagaKindFilter 在 per-call 缺省时生效
    const factoryOnly = await coordWithFactoryFilter.checkActiveSagaForCase({
      caseId: "CASE-001"
    });
    if (factoryOnly.ok) {
      expect(factoryOnly.value.map(a => a.sagaKind)).toEqual(["liquidation"]);
    }
  });

  it("test_triggers_onDegradedFailure_for_unparseable_sagaIds_and_continues", async () => {
    // v2 修订核心 it：解析失败的 saga 静默跳过 + 触发 onDegradedFailure 回调；
    // 其他可解析的 saga 正常返回（防御式留痕模式）
    const store = createMockSagaStateStore();
    store.incomplete = [
      buildPersistedState(
        "liquidation-saga-CASE-001-1735689600000-1",
        "in_progress",
        "2026-05-01T00:00:00.000Z"
      ),
      // 不可解析 #1：无 separator
      buildPersistedState(
        "malformed-id-no-separator",
        "in_progress",
        "2026-05-01T00:00:00.000Z"
      ),
      // 不可解析 #2：kind 不在白名单
      buildPersistedState(
        "unknown-saga-CASE-001-12345-1",
        "in_progress",
        "2026-05-01T00:00:00.000Z"
      )
    ];
    const events: CrossSagaCoordinationDegradedFailureEvent[] = [];
    const coord = createCrossSagaCoordination(
      { sagaStateStore: store },
      {
        onDegradedFailure: e => {
          events.push(e);
        }
      }
    );

    const result = await coord.checkActiveSagaForCase({ caseId: "CASE-001" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 仅 1 个可解析的 saga 被返回
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.sagaKind).toBe("liquidation");
    }
    // 2 个解析失败的 saga 都触发了回调
    expect(events).toHaveLength(2);
    expect(events.every(e => e.kind === "unparseable_saga_id")).toBe(true);
    const observedSagaIds = events.map(e => e.sagaId).sort();
    expect(observedSagaIds).toEqual(
      ["malformed-id-no-separator", "unknown-saga-CASE-001-12345-1"].sort()
    );

    // 未配置 onDegradedFailure 时静默跳过不抛错
    const coordNoCallback = createCrossSagaCoordination({ sagaStateStore: store });
    const silentResult = await coordNoCallback.checkActiveSagaForCase({
      caseId: "CASE-001"
    });
    expect(silentResult.ok).toBe(true);
    if (silentResult.ok) {
      expect(silentResult.value).toHaveLength(1);
    }
  });

  it("test_wraps_listIncomplete_failure_into_SagaPortError_TQ_SAG_002", async () => {
    const store = createMockSagaStateStore();
    store.listFailure = {
      message: "TQ-INF-019: saga state store not initialized"
    };
    const coord = createCrossSagaCoordination({ sagaStateStore: store });
    const result = await coord.checkActiveSagaForCase({ caseId: "CASE-001" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TQ-SAG-002");
      expect(result.error.sagaId).toBe(createSagaId("cross-saga-coordination"));
      expect(result.error.stepName).toBe("check-active-saga-for-case");
      expect(result.error.message).toContain("cross-saga coordination listIncomplete failed");
      expect(result.error.message).toContain("TQ-INF-019");
      expect(result.error.cause).toEqual({
        storeError: { message: "TQ-INF-019: saga state store not initialized" }
      });
    }
  });
});
