// Application-level idempotency guard for orchestration commands.
// Backed by an in-memory registry for now; interface is designed for future persistence swap.

export type OrchestrationIdempotencyKey = {
  readonly caseId: string;
  readonly actionType: string;
  readonly requestId: string;
};

export type IdempotencyStatus =
  | "accepted"
  | "duplicate_rejected"
  | "replayed_same_result";

export type IdempotencyGuardResult = {
  readonly key: string;
  readonly status: IdempotencyStatus;
  readonly previousOrchestrationId: string | null;
};

export type OrchestrationIdempotencyRegistryOperations = {
  check(key: OrchestrationIdempotencyKey): IdempotencyGuardResult;
  record(key: OrchestrationIdempotencyKey, orchestrationId: string): void;
};

const toKeyString = (key: OrchestrationIdempotencyKey): string =>
  `${key.caseId}::${key.actionType}::${key.requestId}`;

export const createOrchestrationIdempotencyRegistry = (): OrchestrationIdempotencyRegistryOperations => {
  const store = new Map<string, string>();

  return {
    check(key) {
      const ks = toKeyString(key);
      const existing = store.get(ks);
      if (existing != null) {
        return { key: ks, status: "duplicate_rejected", previousOrchestrationId: existing };
      }
      return { key: ks, status: "accepted", previousOrchestrationId: null };
    },
    record(key, orchestrationId) {
      store.set(toKeyString(key), orchestrationId);
    }
  };
};
