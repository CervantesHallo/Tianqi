import { describe, expect, it } from "vitest";

import { projectCommandResultQueryToMetrics } from "./query-observation-metrics-projection.js";

describe("query observation metrics projection", () => {
  it("maps found query result to metrics labels", () => {
    const projection = projectCommandResultQueryToMetrics({
      status: "found",
      observability: {
        validation: "passed",
        versionMismatch: false,
        snapshotMissing: false,
        fallbackApplied: false
      }
    });

    expect(projection.metricName).toBe("tianqi_command_result_query_total");
    expect(projection.labels.outcome).toBe("found");
    expect(projection.labels.validation).toBe("passed");
  });

  it("maps version mismatch to metrics labels", () => {
    const projection = projectCommandResultQueryToMetrics({
      status: "unavailable",
      observability: {
        validation: "unsupported_version",
        versionMismatch: true,
        snapshotMissing: false,
        fallbackApplied: false
      }
    });

    expect(projection.labels.outcome).toBe("unavailable");
    expect(projection.labels.versionMismatch).toBe("true");
    expect(projection.labels.validation).toBe("unsupported_version");
  });

  it("maps missing snapshot to metrics labels", () => {
    const projection = projectCommandResultQueryToMetrics({
      status: "missing",
      observability: {
        validation: "not_performed",
        versionMismatch: false,
        snapshotMissing: true,
        fallbackApplied: false
      }
    });

    expect(projection.labels.outcome).toBe("missing");
    expect(projection.labels.snapshotMissing).toBe("true");
    expect(projection.labels.fallbackApplied).toBe("false");
  });
});
