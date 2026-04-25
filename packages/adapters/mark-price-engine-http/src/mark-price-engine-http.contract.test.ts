import { afterAll, beforeAll } from "vitest";

import {
  createMockDownstreamServer,
  defineExternalEngineContractTests,
  type ExternalEngineAdapterUnderTest,
  type ExternalEngineContractOptions,
  type MockDownstreamServer
} from "@tianqi/adapter-testkit";

import { createMarkPriceEngineHttp } from "./mark-price-engine-http.js";

// META-RULE P lower-tier mount for the MarkPrice business engine. Step 13's 21
// stability contracts run unchanged on a real undici pool aimed at the testkit's
// shared mock downstream. Step 17 inherits the 400-599 timeout-avoidance window
// established in Step 14 §G and continued in Step 15 / 16 unchanged.

let mock: MockDownstreamServer;

beforeAll(async () => {
  mock = await createMockDownstreamServer();
});

afterAll(async () => {
  await mock.close();
});

const factory = (): ExternalEngineAdapterUnderTest =>
  createMarkPriceEngineHttp({
    baseUrl: mock.url,
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

defineExternalEngineContractTests("mark-price-engine-http", factory, options);
