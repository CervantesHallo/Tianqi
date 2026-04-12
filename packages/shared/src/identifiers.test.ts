import { describe, expect, it } from "vitest";

import {
  createADLCaseId,
  createAuditId,
  createConfigVersion,
  createEventId,
  createLiquidationCaseId,
  createRiskCaseId,
  createTraceId
} from "./identifiers.js";

describe("identifiers", () => {
  it("creates strongly-typed identifiers", () => {
    const riskCaseId = createRiskCaseId("case-001");
    const liquidationCaseId = createLiquidationCaseId("liq-case-001");
    const adlCaseId = createADLCaseId("adl-case-001");
    const eventId = createEventId("event-001");
    const auditId = createAuditId("audit-001");
    const traceId = createTraceId("trace-001");

    expect(riskCaseId).toBe("case-001");
    expect(liquidationCaseId).toBe("liq-case-001");
    expect(adlCaseId).toBe("adl-case-001");
    expect(eventId).toBe("event-001");
    expect(auditId).toBe("audit-001");
    expect(traceId).toBe("trace-001");
  });

  it("rejects invalid config version", () => {
    expect(() => createConfigVersion(0)).toThrow("ConfigVersion must be a positive integer");
  });
});
