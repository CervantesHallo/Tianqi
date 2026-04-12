import type { RiskCaseOrchestrationResult } from "./risk-case-orchestration-result.js";
import type { OrchestrationIdempotencyKey } from "./orchestration-idempotency.js";

export type OrchestrationResultReplayRegistryOperations = {
  recordResult(key: OrchestrationIdempotencyKey, result: RiskCaseOrchestrationResult): void;
  getRecordedResult(key: OrchestrationIdempotencyKey): RiskCaseOrchestrationResult | null;
};

const toKeyString = (key: OrchestrationIdempotencyKey): string =>
  `${key.caseId}::${key.actionType}::${key.requestId}`;

export const createOrchestrationResultReplayRegistry = (): OrchestrationResultReplayRegistryOperations => {
  const store = new Map<string, RiskCaseOrchestrationResult>();

  return {
    recordResult(key, result) {
      store.set(toKeyString(key), result);
    },
    getRecordedResult(key) {
      return store.get(toKeyString(key)) ?? null;
    }
  };
};
