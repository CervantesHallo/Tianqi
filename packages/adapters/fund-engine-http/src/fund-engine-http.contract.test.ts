import { afterAll, beforeAll } from "vitest";

import {
  createMockDownstreamServer,
  defineExternalEngineContractTests,
  type ExternalEngineAdapterUnderTest,
  type ExternalEngineContractOptions,
  type MockDownstreamServer
} from "@tianqi/adapter-testkit";

import { createFundEngineHttp } from "./fund-engine-http.js";

// META-RULE P lower-tier mount for the Fund business engine. Independent of the
// MarkPrice contract mount in @tianqi/mark-price-engine-http — the two engine
// adapters never share runtime objects, mock servers, or test fixtures
// (META-RULE F). Each engine spins up its own mock during beforeAll. This is
// the fifth time the same 21 stability contracts run on a business engine
// (margin / position / match / mark-price / fund) — Sprint E business engine
// closure.

let mock: MockDownstreamServer;

beforeAll(async () => {
  mock = await createMockDownstreamServer();
});

afterAll(async () => {
  await mock.close();
});

const factory = (): ExternalEngineAdapterUnderTest =>
  createFundEngineHttp({
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

defineExternalEngineContractTests("fund-engine-http", factory, options);
