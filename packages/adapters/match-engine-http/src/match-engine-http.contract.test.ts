import { afterAll, beforeAll } from "vitest";

import {
  createMockDownstreamServer,
  defineExternalEngineContractTests,
  type ExternalEngineAdapterUnderTest,
  type ExternalEngineContractOptions,
  type MockDownstreamServer
} from "@tianqi/adapter-testkit";

import { createMatchEngineHttp } from "./match-engine-http.js";

// META-RULE P lower-tier mount for the Match business engine. Independent of the
// Position contract mount in @tianqi/position-engine-http — the two engine
// adapters never share runtime objects, mock servers, or test fixtures
// (META-RULE F). Each engine spins up its own mock during beforeAll.

let mock: MockDownstreamServer;

beforeAll(async () => {
  mock = await createMockDownstreamServer();
});

afterAll(async () => {
  await mock.close();
});

const factory = (): ExternalEngineAdapterUnderTest =>
  createMatchEngineHttp({
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

defineExternalEngineContractTests("match-engine-http", factory, options);
