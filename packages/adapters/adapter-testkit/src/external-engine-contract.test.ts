import {
  defineExternalEngineContractTests,
  type ExternalEngineContractOptions
} from "./external-engine-contract.js";
import {
  createReferenceExternalEngine,
  type ReferenceExternalEngine
} from "./fixtures/reference-external-engine.js";

// Self-test driver for defineExternalEngineContractTests. The reference engine exposes
// a `__referenceInjector` surface that the options callbacks cast into — a real
// Adapter (Step 14's external-engine-http-base) will provide its own options wire-up
// that manipulates a mock HTTP client instead. The testkit suite itself is entirely
// agnostic to whichever fault-injection strategy the mount site chooses.

const options: ExternalEngineContractOptions = {
  injectTimeout: (adapter) => {
    (adapter as ReferenceExternalEngine).__referenceInjector.timeoutNext();
  },
  injectError: (adapter, category, retryable) => {
    (adapter as ReferenceExternalEngine).__referenceInjector.errorNext(category, retryable);
  },
  injectSlowResponse: (adapter, delayMs) => {
    (adapter as ReferenceExternalEngine).__referenceInjector.slowNext(delayMs);
  },
  injectSuccessAfterFailures: (adapter, failureCount) => {
    (adapter as ReferenceExternalEngine).__referenceInjector.successAfterFailures(failureCount);
  },
  resetInjections: (adapter) => {
    (adapter as ReferenceExternalEngine).__referenceInjector.reset();
  }
};

defineExternalEngineContractTests("reference", () => createReferenceExternalEngine(), options);
