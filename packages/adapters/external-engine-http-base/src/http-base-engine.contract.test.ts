import { afterAll, beforeAll } from "vitest";

import {
  defineExternalEngineContractTests,
  type ExternalEngineAdapterUnderTest,
  type ExternalEngineContractOptions
} from "@tianqi/adapter-testkit";

import { createHttpBaseEngine } from "./http-base-engine.js";

import {
  startMockDownstreamServer,
  type MockDownstreamServer
} from "./helpers/mock-downstream-server.js";

// Step 14 contract mount — drives the full 21-it Step-13 contract suite against a
// real undici pool pointed at a local node:http mock downstream. This is the first
// time in Tianqi that the External Engine contract is exercised on a true network
// round-trip (ephemeral TCP socket on 127.0.0.1). Scheme A from Step 14 §C.2 —
// fault injection lives in the mock server, NEVER in the adapter source.

let mock: MockDownstreamServer;

beforeAll(async () => {
  mock = await startMockDownstreamServer();
});

afterAll(async () => {
  await mock.close();
});

// Map the contract's generic UnderTest to our concrete Adapter. Because the adapter
// is structurally compatible (META-RULE F: no runtime import from adapter-testkit),
// a direct structural cast is sufficient; no cross-package runtime coupling.
const factory = (): ExternalEngineAdapterUnderTest =>
  createHttpBaseEngine({
    baseUrl: mock.url,
    // Tight budgets keep the contract suite fast; real engine deployments will
    // inherit these defaults by omission.
    // Budgets deliberately avoid the 400-599 range — the Step 13 §6.5 regex guard
    // matches any word-boundary-delimited 4xx/5xx number in the serialised error
    // to catch raw HTTP status leaks. Keeping the budgets out of that range means
    // when the adapter emits timeoutMs/elapsedMs the legitimate numbers don't
    // look like an accidental HTTP status leak.
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

defineExternalEngineContractTests("external-engine-http-base", factory, options);
