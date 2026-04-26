// Phase 9 / Step 3 — @tianqi/saga-state-store-memory：单进程内存
// SagaStateStorePort 实现。
//
// 适用场景：
//   - 开发机本地调试
//   - 单元测试 / 集成测试中的 fast-feedback 路径
//   - 应用层 SagaOrchestrator（Step 6+）的 in-memory 默认实现
//
// **不适用**于跨进程恢复 / 生产部署——那些场景必须用
// `@tianqi/saga-state-store-postgres`。
//
// 元规则 N（README Semantics 三条）在 README.md 留痕：
//   1. 持久化保证：进程结束即丢失全部状态（无任何持久化）
//   2. 一致性保证：单进程内所有 save/load/listIncomplete 看到同一份数据
//      （Map 共享内存）；多个 Adapter 实例**互不可见**（各自独立 Map）
//   3. 多实例语义：同进程多次 createInMemorySagaStateStore() 会得到独立
//      实例，互不共享状态——这与 postgres 的"多实例共享同一表"行为相反
//
// Step 5 state guard 教训复用：先判 shut_down 再判 created，避免"刚创建
// 又刚 shutdown"被误判为 not_initialized。

import type {
  AdapterFoundation,
  AdapterHealthStatus,
  PersistedSagaState,
  SagaId,
  SagaStateStoreError,
  SagaStateStorePort
} from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

type LifecycleState = "created" | "running" | "shut_down";

const ADAPTER_NAME = "saga-state-store-memory";

const infError = (
  code: "TQ-INF-019" | "TQ-INF-020",
  attemptedAction: string
): SagaStateStoreError => ({
  message: `${code}: saga state store ${ADAPTER_NAME} ${
    code === "TQ-INF-019" ? "not initialized" : "already shut down"
  } (action: ${attemptedAction})`
});

export type InMemorySagaStateStore = SagaStateStorePort & AdapterFoundation;

export type InMemorySagaStateStoreOptions = Readonly<Record<string, never>>;

export const createInMemorySagaStateStore = (
  _options?: InMemorySagaStateStoreOptions
): InMemorySagaStateStore => {
  // 每次 createInMemorySagaStateStore 调用都是独立 Map（多实例语义条款 3）
  const store = new Map<SagaId, PersistedSagaState>();
  let lifecycle: LifecycleState = "created";

  // 先判 shut_down 再判 created（Step 5 state guard 教训）
  const guardLifecycleForOperation = (
    attemptedAction: string
  ): SagaStateStoreError | null => {
    if (lifecycle === "shut_down") return infError("TQ-INF-020", attemptedAction);
    if (lifecycle === "created") return infError("TQ-INF-019", attemptedAction);
    return null;
  };

  return {
    adapterName: ADAPTER_NAME,
    async init(): Promise<void> {
      // init 幂等（与 event-store-memory 同模式）：
      //   - created → running
      //   - running → running（不变）
      //   - shut_down → 静默 no-op（lifecycle 保持 shut_down；要复用 adapter
      //     必须重新 createInMemorySagaStateStore）
      // 这样 contract test 在 afterEach shutdown 之前若调 init() 不会抛错，
      // 同时"shutdown 是终态"的语义不被破坏。
      if (lifecycle === "running") return;
      if (lifecycle === "shut_down") return;
      lifecycle = "running";
    },
    async shutdown(): Promise<void> {
      // shutdown 幂等：保留已写状态（内存仍可被引用至 GC）；只切换 lifecycle
      lifecycle = "shut_down";
    },
    async healthCheck(): Promise<AdapterHealthStatus> {
      // 元规则 I：healthCheck 不抛错；shut_down 后返回 healthy=false
      return {
        adapterName: ADAPTER_NAME,
        healthy: lifecycle === "running",
        details: {
          lifecycle,
          sagaCount: store.size
        },
        checkedAt: new Date().toISOString()
      };
    },
    async save(
      state: PersistedSagaState
    ): Promise<Result<void, SagaStateStoreError>> {
      const guardError = guardLifecycleForOperation("save");
      if (guardError) return err(guardError);
      // upsert 语义：直接 Map.set 覆盖前值（last-write-wins）
      store.set(state.sagaId, state);
      return ok(undefined);
    },
    async load(
      sagaId: SagaId
    ): Promise<Result<PersistedSagaState | null, SagaStateStoreError>> {
      const guardError = guardLifecycleForOperation("load");
      if (guardError) return err(guardError);
      const found = store.get(sagaId);
      return ok(found ?? null);
    },
    async listIncomplete(): Promise<
      Result<ReadonlyArray<PersistedSagaState>, SagaStateStoreError>
    > {
      const guardError = guardLifecycleForOperation("listIncomplete");
      if (guardError) return err(guardError);
      const incomplete: PersistedSagaState[] = [];
      for (const state of store.values()) {
        if (
          state.overallStatus === "in_progress" ||
          state.overallStatus === "compensating"
        ) {
          incomplete.push(state);
        }
      }
      return ok(incomplete);
    },
    async delete(sagaId: SagaId): Promise<Result<void, SagaStateStoreError>> {
      const guardError = guardLifecycleForOperation("delete");
      if (guardError) return err(guardError);
      store.delete(sagaId); // 幂等：不存在时也返回 ok
      return ok(undefined);
    }
  };
};
