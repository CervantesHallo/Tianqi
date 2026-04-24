import type { TraceId } from "@tianqi/shared";

// ExternalEngineContractProbe — testkit-only observation surface for External Engine
// Adapter stability state (五件套 / five-pack: timeout, retry, circuit breaker, rate
// limit, trace propagation).
//
// META-RULE M (testkit observation primitives) applies strictly: every field below
// exists solely so the contract suite can assert an invariant. There are NO write
// methods here — an Adapter must never let production callers "reset the circuit
// breaker" or "clear the rate limit queue" through the probe. Fault injection is a
// separate testkit concern (see ExternalEngineContractOptions callbacks).
//
// Adapters advertise compliance by returning the `__externalEngineProbe: true` brand
// together with the listed getter methods. Production callers MUST never depend on
// this probe; it is a contract-testing hook only.

export type CircuitBreakerState = "closed" | "open" | "half-open";

export type ExternalEngineRetryStats = {
  readonly attempts: number;
  readonly maxSeen: number;
};

export type ExternalEngineContractProbe = {
  readonly __externalEngineProbe: true;
  // Current state of the circuit breaker. Closed = calls pass through. Open = calls
  // refused immediately with TQ-INF-015. Half-open = one trial call allowed to probe
  // downstream recovery.
  getCircuitBreakerState(): CircuitBreakerState;
  // Number of in-flight calls at this instant. Must be ≥ 0 and ≤ the concurrency cap.
  getCurrentConcurrency(): number;
  // Highest value getCurrentConcurrency() ever observed during this Adapter's lifetime.
  // Useful for capacity-planning assertions and tuning the cap.
  getPeakConcurrency(): number;
  // The TraceId of the most recent call, or null if no call has happened yet.
  // Contract tests assert trace propagation by comparing this against the TraceId they
  // passed to call().
  getLastTraceId(): TraceId | null;
  // Cumulative retry statistics. `attempts` counts every retry attempt ever made across
  // all calls; `maxSeen` is the highest single-call attempt count observed. Together
  // they let the retry contract assert that backoff actually produced multiple attempts.
  getRetryStats(): ExternalEngineRetryStats;
  // ISO-8601 timestamp of the most recent circuit-breaker transition (closed → open,
  // open → half-open, etc), or null if the breaker has never transitioned. Required by
  // the §6.4 "熔断可观测" constraint — operators must see exactly when the breaker
  // moved, not merely where it is now.
  getLastCircuitTransitionAt(): string | null;
};
