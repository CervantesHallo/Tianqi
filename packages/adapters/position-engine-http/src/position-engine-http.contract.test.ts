import { afterAll, beforeAll } from "vitest";

import {
  createMockDownstreamServer,
  defineExternalEngineContractTests,
  type ExternalEngineAdapterUnderTest,
  type ExternalEngineContractOptions,
  type MockDownstreamServer
} from "@tianqi/adapter-testkit";

import { createPositionEngineHttp } from "./position-engine-http.js";

// META-RULE P lower-tier mount for the Position business engine. The 21 Step-13
// stability contracts run unchanged on a real undici pool aimed at the testkit's
// shared mock downstream. Passing this proves the base's stability guarantees
// survive workspace:* propagation into a second business engine — exactly the
// "template repeatability" claim Step 16 was designed to demonstrate.

let mock: MockDownstreamServer;

beforeAll(async () => {
  mock = await createMockDownstreamServer();
});

afterAll(async () => {
  await mock.close();
});

const factory = (): ExternalEngineAdapterUnderTest =>
  createPositionEngineHttp({
    baseUrl: mock.url,
    // 400-599 avoidance from Step 14 §G; Step 15 inherited; Step 16 inherits unchanged.
    timeouts: { connectMs: 300, requestMs: 200, totalMs: 1000 },
    retry: { maxAttempts: 4, baseDelayMs: 10, maxDelayMs: 100 },
    circuitBreaker: { threshold: 3, resetTimeoutMs: 100 },
    rateLimit: { maxConcurrency: 5 },
    healthCheckTimeoutMs: 300
  }) as unknown as ExternalEngineAdapterUnderTest;

const options: ExternalEngineContractOptions = {
  injectTimeout: () => {
    mock.nextResponseWillHang();
  },
  injectError: (_adapter, _category, retryable) => {
    mock.nextResponseWillFail(retryable);
  },
  injectSlowResponse: (_adapter, delayMs) => {
    mock.nextResponseDelayed(delayMs);
  },
  injectSuccessAfterFailures: (_adapter, failureCount) => {
    mock.failNextNThenSucceed(failureCount);
  },
  resetInjections: () => {
    mock.reset();
  }
};

defineExternalEngineContractTests("position-engine-http", factory, options);
