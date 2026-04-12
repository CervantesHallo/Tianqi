import { describe, expect, it } from "vitest";

import {
  COORDINATION_DIAGNOSTIC_RULES_VERSION
} from "./coordination-result-diagnostic-assessment-rules.js";
import {
  evaluateCoordinationDiagnosticResultReadCompatibility
} from "./coordination-result-diagnostic-read-compatibility.js";

describe("evaluateCoordinationDiagnosticResultReadCompatibility", () => {
  it("returns compatible_read for current default version", () => {
    const compatibility = evaluateCoordinationDiagnosticResultReadCompatibility({
      assessmentRulesVersion: COORDINATION_DIAGNOSTIC_RULES_VERSION
    });
    expect(compatibility.status).toBe("compatible_read");
  });

  it("returns compatible_with_notice for supported but non-default version", () => {
    const compatibility = evaluateCoordinationDiagnosticResultReadCompatibility({
      assessmentRulesVersion: "0.9.0"
    });
    expect(compatibility.status).toBe("compatible_with_notice");
  });

  it("returns missing_version when rules version is absent", () => {
    const compatibility = evaluateCoordinationDiagnosticResultReadCompatibility({
      assessmentRulesVersion: ""
    });
    expect(compatibility.status).toBe("missing_version");
  });

  it("returns incompatible_version for unknown version", () => {
    const compatibility = evaluateCoordinationDiagnosticResultReadCompatibility({
      assessmentRulesVersion: "8.8.8"
    });
    expect(compatibility.status).toBe("incompatible_version");
  });
});
