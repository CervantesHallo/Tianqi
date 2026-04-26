// Phase 9 / Step 4 — @tianqi/dead-letter-store-memory：单进程内存
// DeadLetterStorePort 实现。
//
// 适用场景：
//   - 开发机本地调试
//   - 单元测试 / 集成测试中的 fast-feedback 路径
//   - 应用层 Step 9 人工介入接口的 in-memory 默认实现
//
// **不适用**于跨进程恢复 / 生产部署（合规要求长期保留）——那些场景必须
// 用 `@tianqi/dead-letter-store-postgres`。
//
// 元规则 N（README Semantics 三条）在 README.md 留痕：
//   1. 持久化保证：进程结束即丢失全部死信记录（无任何持久化）
//   2. 一致性保证：单进程内所有 enqueue / load / listPending /
//      listBySaga / markAsProcessed 看到同一份数据；多个 Adapter 实例
//      **互不可见**（各自独立 Map）
//   3. 多实例语义：同进程多次 createInMemoryDeadLetterStore() 返回
//      独立实例，互不共享状态——这与 postgres 的"多实例共享同一表"
//      行为相反
//
// 与 saga-state-store-memory 同模式：先判 shut_down 再判 created；
// init-after-shutdown 静默 no-op。

import type {
  AdapterFoundation,
  AdapterHealthStatus,
  DeadLetterEntry,
  DeadLetterId,
  DeadLetterStoreError,
  DeadLetterStorePort,
  SagaId
} from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

type LifecycleState = "created" | "running" | "shut_down";

const ADAPTER_NAME = "dead-letter-store-memory";

const infError = (
  code: "TQ-INF-022" | "TQ-INF-023",
  attemptedAction: string
): DeadLetterStoreError => ({
  message: `${code}: dead letter store ${ADAPTER_NAME} ${
    code === "TQ-INF-022" ? "not initialized" : "already shut down"
  } (action: ${attemptedAction})`
});

export type InMemoryDeadLetterStore = DeadLetterStorePort & AdapterFoundation;

export type InMemoryDeadLetterStoreOptions = Readonly<Record<string, never>>;

export const createInMemoryDeadLetterStore = (
  _options?: InMemoryDeadLetterStoreOptions
): InMemoryDeadLetterStore => {
  // 每次 createInMemoryDeadLetterStore 调用都是独立 Map（多实例语义条款 3）
  const store = new Map<DeadLetterId, DeadLetterEntry>();
  let lifecycle: LifecycleState = "created";

  // 先判 shut_down 再判 created（Step 5 state guard 教训）
  const guardLifecycleForOperation = (
    attemptedAction: string
  ): DeadLetterStoreError | null => {
    if (lifecycle === "shut_down") return infError("TQ-INF-023", attemptedAction);
    if (lifecycle === "created") return infError("TQ-INF-022", attemptedAction);
    return null;
  };

  return {
    adapterName: ADAPTER_NAME,
    async init(): Promise<void> {
      // 与 saga-state-store-memory 同模式：shut_down 终态；init 静默 no-op
      if (lifecycle === "running") return;
      if (lifecycle === "shut_down") return;
      lifecycle = "running";
    },
    async shutdown(): Promise<void> {
      lifecycle = "shut_down";
    },
    async healthCheck(): Promise<AdapterHealthStatus> {
      return {
        adapterName: ADAPTER_NAME,
        healthy: lifecycle === "running",
        details: {
          lifecycle,
          entryCount: store.size
        },
        checkedAt: new Date().toISOString()
      };
    },
    async enqueue(
      entry: DeadLetterEntry
    ): Promise<Result<void, DeadLetterStoreError>> {
      const guardError = guardLifecycleForOperation("enqueue");
      if (guardError) return err(guardError);
      // 同 entryId 重复 enqueue：直接覆盖（last-write-wins）；与 postgres
      // 的 ON CONFLICT 行为对齐——契约测试不假定特定行为，但实现侧应一
      // 致以避免 memory / postgres 行为偏差。
      store.set(entry.entryId, entry);
      return ok(undefined);
    },
    async load(
      entryId: DeadLetterId
    ): Promise<Result<DeadLetterEntry | null, DeadLetterStoreError>> {
      const guardError = guardLifecycleForOperation("load");
      if (guardError) return err(guardError);
      const found = store.get(entryId);
      return ok(found ?? null);
    },
    async listPending(): Promise<
      Result<ReadonlyArray<DeadLetterEntry>, DeadLetterStoreError>
    > {
      const guardError = guardLifecycleForOperation("listPending");
      if (guardError) return err(guardError);
      const pending: DeadLetterEntry[] = [];
      for (const entry of store.values()) {
        if (entry.status === "pending") {
          pending.push(entry);
        }
      }
      return ok(pending);
    },
    async listBySaga(
      sagaId: SagaId
    ): Promise<Result<ReadonlyArray<DeadLetterEntry>, DeadLetterStoreError>> {
      const guardError = guardLifecycleForOperation("listBySaga");
      if (guardError) return err(guardError);
      const matched: DeadLetterEntry[] = [];
      for (const entry of store.values()) {
        if (entry.sagaId === sagaId) {
          matched.push(entry);
        }
      }
      return ok(matched);
    },
    async markAsProcessed(
      entryId: DeadLetterId,
      processedBy: string,
      processingNotes?: string
    ): Promise<Result<void, DeadLetterStoreError>> {
      const guardError = guardLifecycleForOperation("markAsProcessed");
      if (guardError) return err(guardError);
      const existing = store.get(entryId);
      if (existing === undefined) {
        // 幂等：未知 entryId 不抛错（与 postgres UPDATE 影响 0 行同语义）
        return ok(undefined);
      }
      const updated: DeadLetterEntry = {
        ...existing,
        status: "processed",
        processedAt: new Date().toISOString(),
        processedBy,
        processingNotes: processingNotes ?? null
      };
      store.set(entryId, updated);
      return ok(undefined);
    }
  };
};
