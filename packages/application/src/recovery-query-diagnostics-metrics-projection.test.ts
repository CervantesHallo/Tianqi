import { describe, expect, it } from "vitest";

import { projectRecoveryQueryToMetrics } from "./recovery-query-diagnostics-metrics-projection.js";

describe("recovery query diagnostics metrics projection", () => {
  it("maps found diagnostics to metrics labels", () => {
    const projection = projectRecoveryQueryToMetrics({
      outcome: "found",
      statusCategory: "open",
      retryEligibilityCategory: "eligible_for_retry",
      hasNote: true,
      storeAccessed: true,
      fallbackApplied: false
    });

    expect(projection.metricName).toBe("tianqi_recovery_query_total");
    expect(projection.labels.outcome).toBe("found");
    expect(projection.labels.statusCategory).toBe("open");
    expect(projection.labels.retryEligibilityCategory).toBe("eligible_for_retry");
    expect(projection.labels.hasNote).toBe("true");
    expect(projection.labels.fallbackApplied).toBe("false");
  });

  it("maps missing diagnostics to metrics labels", () => {
    const projection = projectRecoveryQueryToMetrics({
      outcome: "missing",
      statusCategory: "none",
      retryEligibilityCategory: "not_applicable",
      hasNote: false,
      storeAccessed: true,
      fallbackApplied: false
    });

    expect(projection.labels.outcome).toBe("missing");
    expect(projection.labels.statusCategory).toBe("none");
    expect(projection.labels.retryEligibilityCategory).toBe("not_applicable");
    expect(projection.labels.hasNote).toBe("false");
  });

  it("maps manually resolved diagnostics categories", () => {
    const projection = projectRecoveryQueryToMetrics({
      outcome: "found",
      statusCategory: "manually_resolved",
      retryEligibilityCategory: "manual_repair_only",
      hasNote: true,
      storeAccessed: true,
      fallbackApplied: false
    });

    expect(projection.labels.outcome).toBe("found");
    expect(projection.labels.statusCategory).toBe("manually_resolved");
    expect(projection.labels.retryEligibilityCategory).toBe("manual_repair_only");
    expect(projection.labels.hasNote).toBe("true");
  });

  it("maps unavailable diagnostics to metrics labels", () => {
    const projection = projectRecoveryQueryToMetrics({
      outcome: "unavailable",
      statusCategory: "none",
      retryEligibilityCategory: "not_applicable",
      hasNote: false,
      storeAccessed: true,
      fallbackApplied: false
    });

    expect(projection.labels.outcome).toBe("unavailable");
    expect(projection.labels.statusCategory).toBe("none");
    expect(projection.labels.retryEligibilityCategory).toBe("not_applicable");
    expect(projection.labels.fallbackApplied).toBe("false");
  });
});
