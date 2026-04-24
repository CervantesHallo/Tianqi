import { describe, expect, it } from "vitest";

import { ERROR_CODES } from "../error-code.js";
import { ERROR_LAYERS } from "./error-layer.js";
import {
  adapterInitializationFailedError,
  configFileUnreadableError,
  configHistoryDirectoryUnreadableError,
  externalEngineBaseUrlUnreachableError,
  externalEngineCircuitOpenError,
  externalEngineNonRetryableError,
  externalEngineRateLimitedError,
  externalEngineRetriesExhaustedError,
  externalEngineTimeoutError,
  InfrastructureError
} from "./inf.js";

describe("TQ-INF error namespace", () => {
  it("constructs the TQ-INF-002 sample via factory", () => {
    const cause = new Error("connection refused");
    const error = adapterInitializationFailedError("event-store-sqlite", "db handle absent", cause);
    expect(error).toBeInstanceOf(InfrastructureError);
    expect(error.code).toBe(ERROR_CODES.ADAPTER_INITIALIZATION_FAILED);
    expect(error.code).toBe("TQ-INF-002");
    expect(error.layer).toBe(ERROR_LAYERS.INFRASTRUCTURE);
    expect(error.context).toEqual({
      adapterName: "event-store-sqlite",
      reason: "db handle absent"
    });
    expect(error.cause).toBe(cause);
  });

  it("marks every InfrastructureError with layer=infrastructure regardless of construction path", () => {
    const error = new InfrastructureError(
      ERROR_CODES.ADAPTER_INITIALIZATION_FAILED,
      "manual construction",
      { adapterName: "x", reason: "y" }
    );
    expect(error.layer).toBe("infrastructure");
  });

  it("serializes context via JSON round-trip without structural loss", () => {
    const error = adapterInitializationFailedError("kafka-notif", "bootstrap.servers missing");
    const serialized = JSON.parse(JSON.stringify(error.context)) as Record<string, unknown>;
    expect(serialized).toEqual(error.context);
  });

  it("rejects non-TQ-INF codes at the type layer", () => {
    // @ts-expect-error — TQ-SAG-001 cannot be assigned to an InfrastructureErrorCode slot
    const invalid = new InfrastructureError(ERROR_CODES.SAGA_STEP_TIMEOUT, "wrong", {});
    expect(invalid).toBeInstanceOf(InfrastructureError);
  });

  it("constructs the TQ-INF-011 config-file unreadable via factory", () => {
    const cause = new Error("ENOENT: no such file or directory");
    const error = configFileUnreadableError(
      "config-file",
      "/etc/tianqi/config.yaml",
      "file not found",
      cause
    );
    expect(error).toBeInstanceOf(InfrastructureError);
    expect(error.code).toBe(ERROR_CODES.CONFIG_FILE_UNREADABLE);
    expect(error.code).toBe("TQ-INF-011");
    expect(error.layer).toBe(ERROR_LAYERS.INFRASTRUCTURE);
    expect(error.context).toEqual({
      adapterName: "config-file",
      filePath: "/etc/tianqi/config.yaml",
      reason: "file not found"
    });
    expect(error.cause).toBe(cause);
  });

  it("constructs the TQ-INF-012 config-history-directory unreadable via factory", () => {
    const cause = new Error("EACCES: permission denied, mkdir");
    const error = configHistoryDirectoryUnreadableError(
      "config-file",
      "/etc/tianqi/config.yaml.tianqi-history",
      "mkdir denied",
      cause
    );
    expect(error).toBeInstanceOf(InfrastructureError);
    expect(error.code).toBe(ERROR_CODES.CONFIG_HISTORY_DIRECTORY_UNREADABLE);
    expect(error.code).toBe("TQ-INF-012");
    expect(error.layer).toBe(ERROR_LAYERS.INFRASTRUCTURE);
    expect(error.context).toEqual({
      adapterName: "config-file",
      historyDirectory: "/etc/tianqi/config.yaml.tianqi-history",
      reason: "mkdir denied"
    });
    expect(error.cause).toBe(cause);
  });

  it("distinguishes TQ-INF-012 from TQ-INF-011 despite both being config-file I/O", () => {
    // Convention K: the file is a single YAML; the history directory is a tree of
    // YAML/JSONL/JSON files. Their remediation runbooks diverge — mkdir/chmod -R vs
    // chmod on one file — so the two codes stay split.
    expect(ERROR_CODES.CONFIG_FILE_UNREADABLE).toBe("TQ-INF-011");
    expect(ERROR_CODES.CONFIG_HISTORY_DIRECTORY_UNREADABLE).toBe("TQ-INF-012");
    expect(ERROR_CODES.CONFIG_FILE_UNREADABLE).not.toBe(
      ERROR_CODES.CONFIG_HISTORY_DIRECTORY_UNREADABLE
    );
  });

  it("constructs TQ-INF-013 external engine timeout with domain-level phase moniker", () => {
    const error = externalEngineTimeoutError("margin-engine-http", "request", 2_000, 2_004);
    expect(error).toBeInstanceOf(InfrastructureError);
    expect(error.code).toBe("TQ-INF-013");
    expect(error.layer).toBe(ERROR_LAYERS.INFRASTRUCTURE);
    expect(error.context).toEqual({
      adapterName: "margin-engine-http",
      timeoutPhase: "request",
      timeoutMs: 2_000,
      elapsedMs: 2_004
    });
  });

  it("constructs TQ-INF-014 retries exhausted with domain-level final failure category", () => {
    const error = externalEngineRetriesExhaustedError(
      "match-engine-http",
      4,
      3,
      "downstream_unavailable"
    );
    expect(error.code).toBe("TQ-INF-014");
    expect(error.context).toEqual({
      adapterName: "match-engine-http",
      attempts: 4,
      maxRetries: 3,
      finalFailureCategory: "downstream_unavailable"
    });
    // §6.5 discipline: the category is a domain moniker, NOT an HTTP status or a raw
    // socket error. This assertion is a soft guard against regressions that would be
    // tempting to write (e.g. passing `String(err.code)`).
    expect(String(error.context["finalFailureCategory"])).not.toMatch(/^[45]\d\d$/);
  });

  it("constructs TQ-INF-015 circuit-open with open timestamp and trip counter", () => {
    const openedAt = "2026-04-24T10:00:00.000Z";
    const error = externalEngineCircuitOpenError("position-engine-http", openedAt, 3);
    expect(error.code).toBe("TQ-INF-015");
    expect(error.context).toEqual({
      adapterName: "position-engine-http",
      openedAt,
      consecutiveFailures: 3
    });
  });

  it("constructs TQ-INF-016 rate-limited with quantified concurrency signal", () => {
    const error = externalEngineRateLimitedError("mark-price-engine-http", 5, 5);
    expect(error.code).toBe("TQ-INF-016");
    expect(error.context).toEqual({
      adapterName: "mark-price-engine-http",
      currentConcurrency: 5,
      cap: 5
    });
  });

  it("constructs TQ-INF-017 non-retryable with domain-level downstream category", () => {
    const error = externalEngineNonRetryableError(
      "fund-engine-http",
      "permission_denied",
      "caller lacks write capability on fund account"
    );
    expect(error.code).toBe("TQ-INF-017");
    expect(error.context).toEqual({
      adapterName: "fund-engine-http",
      downstreamCategory: "permission_denied",
      reason: "caller lacks write capability on fund account"
    });
    // §6.5: downstream category must not be a 4xx / 5xx raw status.
    expect(String(error.context["downstreamCategory"])).not.toMatch(/^\d\d\d$/);
  });

  it("keeps all five External Engine codes distinct and under the TQ-INF namespace", () => {
    // Convention K: five remediation tool-chains, five codes. Each failure mode has a
    // different runbook (timeout: check budgets / retry: investigate downstream /
    // circuit: engage the breaker dashboard / rate: raise cap or queue / non-retryable:
    // inspect request contract), so the namespace stays granular rather than collapsed.
    const codes = [
      ERROR_CODES.EXTERNAL_ENGINE_TIMEOUT,
      ERROR_CODES.EXTERNAL_ENGINE_RETRIES_EXHAUSTED,
      ERROR_CODES.EXTERNAL_ENGINE_CIRCUIT_OPEN,
      ERROR_CODES.EXTERNAL_ENGINE_RATE_LIMITED,
      ERROR_CODES.EXTERNAL_ENGINE_NON_RETRYABLE
    ];
    const unique = new Set(codes);
    expect(unique.size).toBe(5);
    for (const code of codes) {
      expect(code.startsWith("TQ-INF-")).toBe(true);
    }
  });

  it("constructs TQ-INF-018 base URL unreachable with domain-level reason", () => {
    const cause = new Error("ECONNREFUSED: localhost:65535");
    const error = externalEngineBaseUrlUnreachableError(
      "external-engine-http-base",
      "http://engine.internal:8080",
      "downstream_unavailable",
      cause
    );
    expect(error.code).toBe("TQ-INF-018");
    expect(error.layer).toBe(ERROR_LAYERS.INFRASTRUCTURE);
    expect(error.context).toEqual({
      adapterName: "external-engine-http-base",
      baseUrl: "http://engine.internal:8080",
      reason: "downstream_unavailable"
    });
    expect(error.cause).toBe(cause);
    // §6.5: reason is a domain moniker, not a raw socket error string. The cause
    // chain can carry the raw error but the context itself must stay clean.
    expect(String(error.context["reason"])).not.toMatch(/ECONNREFUSED|ENOTFOUND|EAI_/);
  });

  it("distinguishes TQ-INF-018 from TQ-INF-013 despite both being HTTP engine failures", () => {
    // Convention K: TQ-INF-018 is init-time unreachable (runbook: check URL, DNS,
    // TLS trust); TQ-INF-013 is runtime timeout (runbook: check budget configuration
    // against downstream latency histogram). The two runbooks overlap in the
    // "investigate downstream health" root step but diverge everywhere else.
    expect(ERROR_CODES.EXTERNAL_ENGINE_TIMEOUT).toBe("TQ-INF-013");
    expect(ERROR_CODES.EXTERNAL_ENGINE_BASE_URL_UNREACHABLE).toBe("TQ-INF-018");
    expect(ERROR_CODES.EXTERNAL_ENGINE_TIMEOUT).not.toBe(
      ERROR_CODES.EXTERNAL_ENGINE_BASE_URL_UNREACHABLE
    );
  });
});
