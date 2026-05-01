// Phase 9 / Step 14 — CrossSagaCoordination 模块（Sprint H 收官战 +
// Phase 9 后期复杂度峰值；拆两阶段流程第二次实战）。
//
// 跨 Saga 协调机制：在 Application 层提供"同 caseId 当前是否有活跃 Saga"
// 的查询能力，让业务调用方在启动新 Saga 前显式做防御。性质与 Step 10-13
// 完全不同——不是业务 Saga 实例化，而是协调机制；与 Step 9 saga-manual-
// intervention 同精神（编排器透明的辅助模块）。
//
// **业务现实判断（强制开局动作 4 实地核查结论）**：α 轻量场景。
//   - Tianqi 业务流程语义禁止"同 caseId 多 Saga 同时活跃"
//   - IdempotencyPort 已处理"命令层 requestId 重复"
//   - Saga 层真正缺失"同 caseId 已活跃 Saga 防御"
//   - 重量级跨 Saga 协调器无业务现实支撑，违反"克制 > 堆砌"
//
// 设计裁决（详见 docs/decisions/0002 Step 14 段 + docs/phase9/14）：
//   - 裁决 1 (α)：α 轻量场景；不构造重量级协调器
//   - 裁决 2 (A)：SagaStateStore.listIncomplete + 字符串前缀过滤
//   - 裁决 3 (α)：模块归属 packages/application/src/saga/cross-saga-coordination.ts
//     与既有 5 saga 模块同目录平级
//   - 裁决 4 (γ)：工厂闭包 createCrossSagaCoordination(ports, options?) +
//     单方法接口 checkActiveSagaForCase
//   - 裁决 5：0 新错误码（惯例 K 第十六次实战；listIncomplete 失败复用 TQ-SAG-002）
//   - 裁决 6：强守不引入新 Port（纯消费 SagaStateStorePort.listIncomplete）
//   - 裁决 7：unit ≤6 + 集成 ≤4 + 不挂载 defineSagaContractTests
//
// **v2 用户审视后修订（2026-05-01）**：判断 I.1 选方案 A —— sagaId 命名
// 约定从"事实约定"升级为"显式约定 + helper"。
//   - 新增 SAGA_ID_NAMING_CONVENTION 常量（命名约定的显式声明）
//   - 新增 parseSagaIdToInfo(sagaId) 纯函数（命名约定的可执行编码；
//     元规则 N pure helper export 第 2 次实战，首次 Step 7）
//   - 新增 CrossSagaCoordinationOptions.onDegradedFailure 回调（解析失败
//     时通知调用方；与 SagaOrchestrator.SagaDegradedFailureEvent /
//     SagaManualIntervention.ManualInterventionDegradedFailureEvent 同精神
//     但事件命名空间独立）
//
// **v2 元规则 B 锁定形态**（自 Step 14 起冻结，任何调整必须经 ADR 修订流程）：
//   1. BusinessSagaKind 4 字面量
//   2. SAGA_ID_NAMING_CONVENTION 常量结构
//   3. ParsedSagaIdInfo 3 字段
//   4. parseSagaIdToInfo 函数签名 + 解析行为
//   5. ActiveSagaInfo 5 字段
//   6. CrossSagaCoordinationDegradedFailureEvent 形态
//   7. CrossSagaCoordinationOptions 2 可选字段
//   8. CrossSagaCoordinationPorts 单 Port
//   9. CrossSagaCoordination.checkActiveSagaForCase 接口
//   10. createCrossSagaCoordination 工厂签名
//
// **编排器透明性证明**（强制开局动作 6 + 元规则 F）：
//   本文件 import 列表仅含：@tianqi/shared（Result）+ @tianqi/ports
//   （SagaStateStorePort + SagaPortError + SagaId + createSagaId）。
//   零 import "./saga-orchestrator.js" / "./saga-manual-intervention.js" /
//   "./liquidation-saga.js" / "./adl-saga.js" / "./insurance-fund-saga.js" /
//   "./state-transition-saga.js"。
//
// **不破坏 Step 10-13 关键证据**：4 业务 Saga 既有 sagaId 字符串恰好满足
// 新约定（grep 实地验证）：
//   - liquidation-saga-{caseId}-{stamp}    ✅
//   - adl-saga-{caseId}-{stamp}            ✅
//   - insurance-fund-saga-{caseId}-{stamp} ✅
//   - state-transition-saga-{caseId}-{stamp} ✅

import type { SagaErrorCode } from "@tianqi/contracts";
import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import type {
  SagaId,
  SagaPortError,
  SagaStateStorePort
} from "@tianqi/ports";
import { createSagaId } from "@tianqi/ports";

// ============================================================
// 1. BusinessSagaKind —— 4 业务 Saga 命名约定字面量
// ============================================================

/**
 * 4 业务 Saga 命名约定字面量。
 *
 * 与 Step 10-13 4 业务 Saga 模块的 sagaId 前缀一一对应：
 *   - "liquidation"      ↔ liquidation-saga.ts
 *   - "adl"              ↔ adl-saga.ts
 *   - "insurance-fund"   ↔ insurance-fund-saga.ts
 *   - "state-transition" ↔ state-transition-saga.ts
 *
 * **元规则 B 锁定（自 Step 14 起）**：本字面量集合一旦发布即冻结。
 * Phase 10+ 引入第 5 个业务 Saga 时**必须**经 ADR-0002 修订流程同步
 * 扩展本类型 + SAGA_ID_NAMING_CONVENTION.kindPrefixes 数组。
 */
export type BusinessSagaKind =
  | "liquidation"
  | "adl"
  | "insurance-fund"
  | "state-transition";

// ============================================================
// 2. SAGA_ID_NAMING_CONVENTION —— 命名约定显式声明
// ============================================================

/**
 * 4 业务 Saga sagaId 前缀映射数组（kindPrefixes 字段使用）。
 *
 * 与 BusinessSagaKind 字面量一一对应；本数组在运行时用于 parseSagaIdToInfo
 * 的 kind 验证。**元规则 B 锁定**：自 Step 14 起本数组冻结。
 */
const BUSINESS_SAGA_KIND_VALUES: ReadonlyArray<BusinessSagaKind> = [
  "liquidation",
  "adl",
  "insurance-fund",
  "state-transition"
] as const;

/**
 * sagaId 命名约定的显式声明（v2 新增）。
 *
 * 业务 Saga 内部 runForCase 构造 sagaId 时遵循模式：
 *   `{kind}-saga-{caseId}-{stamp}`
 *
 * 其中：
 *   - kind ∈ BusinessSagaKind 4 字面量之一
 *   - caseId 业务案件标识（不允许含 `-saga-` 子串；caseId 内可含 `-`）
 *   - stamp = `${Date.now()}-${invocationCounter}`（同进程内唯一递增；
 *     形如 `1735689600000-42`）
 *
 * **元规则 B 锁定（自 Step 14 起）**：
 *   - 既有 4 业务 Saga（Step 10-13）的 sagaId 构造必须继续满足本约定
 *   - Phase 10+ 引入第 5 个业务 Saga 时，sagaId 构造**必须**满足本约定
 *   - parseSagaIdToInfo 是本约定的可执行编码；本常量与 helper 一并冻结
 *   - 任何调整必须经 ADR-0002 修订流程
 *
 * 示例（与 Step 10-13 锁定一致）：
 *   liquidation-saga-{caseId}-{stamp}
 *   adl-saga-{caseId}-{stamp}
 *   insurance-fund-saga-{caseId}-{stamp}
 *   state-transition-saga-{caseId}-{stamp}
 */
export const SAGA_ID_NAMING_CONVENTION = {
  pattern: "{kind}-saga-{caseId}-{stamp}",
  separator: "-saga-",
  kindPrefixes: BUSINESS_SAGA_KIND_VALUES
} as const;

// ============================================================
// 3. ParsedSagaIdInfo + parseSagaIdToInfo —— 命名约定的可执行编码
// ============================================================

/**
 * parseSagaIdToInfo 解析结果。
 *
 * 字段：
 *   - sagaKind: 4 BusinessSagaKind 之一
 *   - caseId: 业务案件标识（可能含 `-`，但不含 `-saga-` 子串）
 *   - stamp: 形如 `{millis}-{counter}` 的两段数字 + 连字符字符串
 */
export type ParsedSagaIdInfo = {
  readonly sagaKind: BusinessSagaKind;
  readonly caseId: string;
  readonly stamp: string;
};

/**
 * 全数字字符串判定（stamp 段验证用）。
 */
const isAllDigits = (value: string): boolean =>
  value.length > 0 && /^\d+$/.test(value);

/**
 * BusinessSagaKind 候选验证。
 */
const isValidBusinessSagaKind = (value: string): value is BusinessSagaKind =>
  (BUSINESS_SAGA_KIND_VALUES as ReadonlyArray<string>).includes(value);

/**
 * 把 sagaId 字符串解析为结构化信息（v2 新增；命名约定的可执行编码）。
 *
 * 解析失败返回 null（不抛错；调用方决定如何处置）：
 *   - sagaId 不含 `-saga-` 分隔符
 *   - kind 部分（首个 `-saga-` 之前）不是 BusinessSagaKind 4 字面量之一
 *   - 剩余部分（首个 `-saga-` 之后）不能再拆出 stamp 段（最后两个 `-`
 *     分隔的段必须都是纯数字）
 *   - caseId 段为空
 *
 * **元规则 N（pure helper export）**：本函数是纯函数；export 让 unit
 * test 单独验证；元规则 N 第 2 次实战（首次 Step 7
 * isStepEligibleForCompensation / aggregateCompensationOutcome）。
 *
 * **元规则 B 锁定（v2，自 Step 14 起）**：本函数签名 + 行为冻结；后续
 * Step 任何 sagaId 命名约定调整必须经 ADR-0002 修订流程同步更新本函数
 * 与 SAGA_ID_NAMING_CONVENTION 常量。
 *
 * **不抛错原则**：解析失败永远返回 null；调用方（CrossSagaCoordination
 * 内部）收到 null 时通过 onDegradedFailure 回调通知运维（防御式留痕）。
 */
export const parseSagaIdToInfo = (sagaId: string): ParsedSagaIdInfo | null => {
  const idx = sagaId.indexOf(SAGA_ID_NAMING_CONVENTION.separator);
  if (idx < 0) return null;

  const kindCandidate = sagaId.slice(0, idx);
  if (!isValidBusinessSagaKind(kindCandidate)) return null;

  const rest = sagaId.slice(idx + SAGA_ID_NAMING_CONVENTION.separator.length);
  if (rest.length === 0) return null;

  // stamp 是 rest 末尾的两个 `-` 分隔的纯数字段（`{millis}-{counter}`）；
  // 剩下的部分（可能含若干 `-`）合并为 caseId
  const parts = rest.split("-");
  if (parts.length < 3) return null; // 至少 caseId(1) + millis + counter

  const lastIdx = parts.length - 1;
  const secondLastIdx = parts.length - 2;
  const lastPart = parts[lastIdx];
  const secondLastPart = parts[secondLastIdx];
  if (lastPart === undefined || secondLastPart === undefined) return null;
  if (!isAllDigits(lastPart) || !isAllDigits(secondLastPart)) return null;

  const stamp = `${secondLastPart}-${lastPart}`;
  const caseId = parts.slice(0, secondLastIdx).join("-");
  if (caseId.length === 0) return null;

  return { sagaKind: kindCandidate, caseId, stamp };
};

// ============================================================
// 4. ActiveSagaInfo —— 同 caseId 活跃 Saga 摘要
// ============================================================

/**
 * 同 caseId 当前活跃的 Saga 摘要信息。
 *
 * 5 字段（裁决 4 锁定）：
 *   - sagaId: 完整 sagaId 字符串（透传自 PersistedSagaState.sagaId）
 *   - caseId: 解析自 sagaId 的业务案件标识
 *   - sagaKind: 解析自 sagaId 的 BusinessSagaKind
 *   - startedAt: ISO-8601 UTC（取自 PersistedSagaState.sagaStartedAt）
 *   - overallStatus: "in_progress" | "compensating"（限定为活跃态；
 *     listIncomplete 已过滤终态）
 */
export type ActiveSagaInfo = {
  readonly sagaId: SagaId;
  readonly caseId: string;
  readonly sagaKind: BusinessSagaKind;
  readonly startedAt: string;
  readonly overallStatus: "in_progress" | "compensating";
};

// ============================================================
// 5. CrossSagaCoordinationDegradedFailureEvent —— 解析失败降级事件
// ============================================================

/**
 * 解析失败的降级事件（v2 新增）。
 *
 * 触发条件：listIncomplete() 返回的某个 saga 其 sagaId 不满足
 * SAGA_ID_NAMING_CONVENTION 约定，parseSagaIdToInfo 返回 null。
 *
 * 协调模块行为：
 *   - 静默跳过该 saga（不计入 ActiveSagaInfo[] 返回值）
 *   - 调用 onDegradedFailure 回调（如配置）通知运维
 *   - 不中止 checkActiveSagaForCase 调用（其他可解析的 saga 正常返回）
 *
 * 这是"防御式留痕"模式：解析失败不让调用方失败，但留痕便于运维诊断
 * 命名约定漂移（譬如 Phase 10+ 引入新 Saga 但忘记同步 BusinessSagaKind）。
 *
 * 与 SagaOrchestrator.SagaDegradedFailureEvent / SagaManualIntervention.
 * ManualInterventionDegradedFailureEvent 同精神（裁决 5 分级模式）但事件
 * 命名空间独立——避免协调模块的降级被误归到编排器或人工介入模块。
 */
export type CrossSagaCoordinationDegradedFailureEvent = {
  readonly kind: "unparseable_saga_id";
  readonly sagaId: string;
};

// ============================================================
// 6. CrossSagaCoordinationPorts —— 单 Port 最小依赖
// ============================================================

/**
 * 协调模块所需 Port（裁决 6 强守：仅 SagaStateStore，不引入新 Port）。
 */
export type CrossSagaCoordinationPorts = {
  readonly sagaStateStore: SagaStateStorePort;
};

// ============================================================
// 7. CrossSagaCoordinationOptions —— 工厂级可选配置
// ============================================================

/**
 * 协调模块工厂级可选配置（裁决 4 γ）。
 */
export type CrossSagaCoordinationOptions = {
  /**
   * 工厂级 sagaKind 过滤；undefined = 检查全部 4 种。
   *
   * 与 checkActiveSagaForCase 入参 input.sagaKindFilter 关系：
   *   - input.sagaKindFilter 优先级高（per-call override）
   *   - input.sagaKindFilter undefined 时，回退到 options.sagaKindFilter
   *   - 都 undefined 时，检查全部 4 种 BusinessSagaKind
   */
  readonly sagaKindFilter?: ReadonlyArray<BusinessSagaKind>;
  /**
   * sagaId 解析失败时的降级回调（v2 新增）。
   *
   * 调用方注入观察函数：通常是 logger.warn / metrics counter / 运维报警。
   * 协调模块本身不实现观察实现（元规则 F：协调模块不主动调 logger）。
   * undefined 表示不做任何降级动作（解析失败的 saga 仍静默跳过）。
   */
  readonly onDegradedFailure?: (
    event: CrossSagaCoordinationDegradedFailureEvent
  ) => void;
};

// ============================================================
// 8. CrossSagaCoordination —— 协调模块对外接口
// ============================================================

/**
 * 跨 Saga 协调模块对外接口。
 *
 * 单方法 checkActiveSagaForCase（裁决 4 γ）；与 saga-orchestrator
 * runSaga / saga-manual-intervention processDeadLetter 风格一致。
 */
export type CrossSagaCoordination = {
  /**
   * 检查同 caseId 当前是否有活跃 Saga。
   *
   * @param input.caseId 业务案件标识
   * @param input.sagaKindFilter 可选 per-call 过滤；优先级高于 options.sagaKindFilter
   * @returns 同 caseId 的全部活跃 Saga 摘要数组（按 startedAt 升序）；
   *          空数组表示当前无活跃 Saga（调用方可安全启动新 Saga）
   *
   * 使用场景：业务 Saga 调用方在 runForCase 前调用本方法防御重复触发：
   *
   * ```typescript
   * const active = await coord.checkActiveSagaForCase({ caseId });
   * if (!active.ok) return active;
   * if (active.value.length > 0) {
   *   // 已有活跃 Saga；调用方决定拒绝 / 等待 / 强制覆盖
   *   return err({ ... });
   * }
   * await liquidationSaga.runForCase(input);
   * ```
   *
   * 失败处置：
   *   - listIncomplete 失败 → err(SagaPortError code=TQ-SAG-002，
   *     message="cross-saga coordination listIncomplete failed: <detail>")；
   *     占位 sagaId / stepName 用于 SagaPortError 信封字段必填要求
   *   - 解析失败的 saga 静默跳过 + 触发 onDegradedFailure 回调（如配置）；
   *     其他可解析的 saga 正常返回
   */
  checkActiveSagaForCase(input: {
    readonly caseId: string;
    readonly sagaKindFilter?: ReadonlyArray<BusinessSagaKind>;
  }): Promise<Result<ReadonlyArray<ActiveSagaInfo>, SagaPortError>>;
};

// ============================================================
// 9. createCrossSagaCoordination —— 工厂闭包
// ============================================================

const COORDINATION_ERROR_CODE: SagaErrorCode = "TQ-SAG-002";
const COORDINATION_PLACEHOLDER_SAGA_ID = createSagaId("cross-saga-coordination");
const COORDINATION_STEP_NAME = "check-active-saga-for-case";

/**
 * 工厂闭包：创建跨 Saga 协调实例。
 *
 * @param ports 必需 SagaStateStorePort（裁决 6 单 Port 最小依赖）
 * @param options 可选 sagaKindFilter / onDegradedFailure
 *
 * 闭包不持有运行时状态（与 saga-orchestrator 持有 watchdog 状态不同；
 * 协调机制本身是无状态查询）；闭包形态保持与既有 saga 模块风格一致
 * （裁决 4 γ；一致性 > 微优化）。
 */
export const createCrossSagaCoordination = (
  ports: CrossSagaCoordinationPorts,
  options: CrossSagaCoordinationOptions = {}
): CrossSagaCoordination => {
  const onDegradedFailure = options.onDegradedFailure;
  const factoryFilter = options.sagaKindFilter;

  const checkActiveSagaForCase = async (input: {
    readonly caseId: string;
    readonly sagaKindFilter?: ReadonlyArray<BusinessSagaKind>;
  }): Promise<Result<ReadonlyArray<ActiveSagaInfo>, SagaPortError>> => {
    const listResult = await ports.sagaStateStore.listIncomplete();
    if (!listResult.ok) {
      // listIncomplete 失败 wrap 为 SagaPortError；占位字段（sagaId /
      // stepName）让信封字段必填要求得到满足；§6.5 转译纪律：message 是
      // 领域级摘要，cause 仅供编排器内部审计入存使用
      const wrapped: SagaPortError = {
        code: COORDINATION_ERROR_CODE,
        sagaId: COORDINATION_PLACEHOLDER_SAGA_ID,
        stepName: COORDINATION_STEP_NAME,
        message: `cross-saga coordination listIncomplete failed: ${listResult.error.message}`,
        cause: { storeError: listResult.error }
      };
      return err(wrapped);
    }

    // input.sagaKindFilter 优先（per-call override）；否则回退 options.sagaKindFilter
    const effectiveFilter = input.sagaKindFilter ?? factoryFilter;

    const active: ActiveSagaInfo[] = [];
    for (const persisted of listResult.value) {
      const parsed = parseSagaIdToInfo(persisted.sagaId);
      if (parsed === null) {
        // 解析失败：静默跳过 + 触发 onDegradedFailure 回调（如配置）
        onDegradedFailure?.({
          kind: "unparseable_saga_id",
          sagaId: persisted.sagaId
        });
        continue;
      }
      if (parsed.caseId !== input.caseId) continue;
      if (effectiveFilter !== undefined && !effectiveFilter.includes(parsed.sagaKind)) {
        continue;
      }
      // 防御性：listIncomplete 应已过滤终态，此处再核查一次保证类型边界
      if (
        persisted.overallStatus !== "in_progress" &&
        persisted.overallStatus !== "compensating"
      ) {
        continue;
      }
      active.push({
        sagaId: persisted.sagaId,
        caseId: parsed.caseId,
        sagaKind: parsed.sagaKind,
        startedAt: persisted.sagaStartedAt,
        overallStatus: persisted.overallStatus
      });
    }

    // 按 startedAt 升序（ISO-8601 UTC 字符串字典序与时间序一致）
    active.sort((a, b) => a.startedAt.localeCompare(b.startedAt));

    return ok(active);
  };

  return { checkActiveSagaForCase };
};
