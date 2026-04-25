import { afterAll, beforeAll } from "vitest";

import {
  createMockDownstreamServer,
  defineExternalEngineContractTests,
  type ExternalEngineAdapterUnderTest,
  type ExternalEngineContractOptions,
  type MockDownstreamServer
} from "@tianqi/adapter-testkit";

import { createMarginEngineHttp } from "./margin-engine-http.js";

// Step 15 — META-RULE P lower-tier mount: the Margin business engine runs the
// full 21-it Step-13 external-engine contract suite against a real undici pool
// pointed at the testkit's mock downstream. Passing this proves the base
// adapter's stability contract is preserved when consumed by a business
// engine — no retry / circuit / rate-limit / trace behaviour silently
// regresses across the `workspace:*` boundary.
//
// The mock server is imported from @tianqi/adapter-testkit (Step 15's scheme B
// extraction), avoiding ~150 lines of duplication per business engine.

let mock: MockDownstreamServer;

beforeAll(async () => {
  mock = await createMockDownstreamServer();
});

afterAll(async () => {
  await mock.close();
});

const factory = (): ExternalEngineAdapterUnderTest =>
  createMarginEngineHttp({
    baseUrl: mock.url,
    // Budgets deliberately avoid the 400-599 range (§6.5 regex guard lesson
    // from Step 14 §G — legitimate timeout numbers must not look like raw HTTP
    // 4xx/5xx statuses). Step 16-17 inherit this rule.
    timeouts: { connectMs: 300, requestMs: 200, totalMs: 1000 },
    retry: { maxAttempts: 4, baseDelayMs: 10, maxDelayMs: 100 },
    circuitBreaker: { threshold: 3, resetTimeoutMs: 100 },
    rateLimit: { maxConcurrency: 5 },
    healthCheckTimeoutMs: 300
  }) as unknown as ExternalEngineAdapterUnderTest;

// The contract's `call({ operation: "lookup" })` hits the mock server at
// POST /lookup. The mock's default response is 200 + `{ ok: true }`, which the
// base-engine layer accepts as success. Our adapter's business-method parsers
// never run in this suite — the adapter's generic `call()` path (inherited
// from the base via delegation) is what the contract exercises. Business
// method parsers are instead exercised in margin-engine-http.test.ts.
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

defineExternalEngineContractTests("margin-engine-http", factory, options);
