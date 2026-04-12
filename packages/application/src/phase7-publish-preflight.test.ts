import { describe, expect, it } from "vitest";
import {
  buildContractFreezeBaseline,
  runPhase7PublishPreflight,
  validatePhase7PreflightConsistency
} from "./phase7-publish-preflight.js";
import type { PreflightCheckInputs } from "./phase7-publish-preflight.js";

const T = "2026-03-25T00:00:00.000Z";

const BASELINE = buildContractFreezeBaseline(
  "baseline-v1", ["api-v1"], ["event-v1.0.0"], ["TQ-DOM-001", "TQ-APP-001", "TQ-POL-001", "TQ-INF-001", "TQ-CON-001"], T
);

const cleanInputs = (): PreflightCheckInputs => ({
  config: { configVersionExists: true, prevalidationPassed: true, dryRunPassed: true, auditChainComplete: true, readViewConsistent: true },
  contracts: { apiContractVersionsUnchanged: true, eventContractVersionsUnchanged: true, errorCodeVersionsUnchanged: true },
  auditReplay: { replaySemanticsPassed: true, eventStoreAccessible: true }
});

// ─── contract freeze baseline ───────────────────────────────────────────────

describe("ContractFreezeBaseline", () => {
  it("builds with correct fields", () => {
    expect(BASELINE.baselineId).toBe("baseline-v1");
    expect(BASELINE.apiContractVersionSet).toHaveLength(1);
    expect(BASELINE.eventContractVersionSet).toHaveLength(1);
    expect(BASELINE.errorCodeVersionSet).toHaveLength(5);
    expect(BASELINE.summary).toContain("frozen");
  });
});

// ─── preflight: passed ──────────────────────────────────────────────────────

describe("PublishPreflight: passed path", () => {
  it("produces passed with no blocking/notices", () => {
    const result = runPhase7PublishPreflight("pf-pass", "1.0.0", BASELINE, cleanInputs(), T);
    expect(result.preflightStatus).toBe("passed");
    expect(result.blockingIssues.length).toBe(0);
    expect(result.nonBlockingNotices.length).toBe(0);
    expect(result.targetConfigVersion).toBe("1.0.0");
    expect(result.contractBaselineVersion).toBe("baseline-v1");
    expect(result.summary).toContain("PASSED");
    expect(result.summary).toContain("cleared");
  });
});

// ─── preflight: passed_with_notice ──────────────────────────────────────────

describe("PublishPreflight: passed_with_notice path", () => {
  it("produces passed_with_notice when audit chain incomplete but read view ok", () => {
    const inputs: PreflightCheckInputs = {
      ...cleanInputs(),
      config: { ...cleanInputs().config, auditChainComplete: false }
    };
    const result = runPhase7PublishPreflight("pf-notice", "1.0.0", BASELINE, inputs, T);
    expect(result.preflightStatus).toBe("blocked");
    expect(result.blockingIssues.length).toBeGreaterThan(0);
  });
});

// ─── preflight: blocked — config ────────────────────────────────────────────

describe("PublishPreflight: config blocking", () => {
  it("blocked when config version not exists", () => {
    const inputs: PreflightCheckInputs = { ...cleanInputs(), config: { ...cleanInputs().config, configVersionExists: false } };
    const result = runPhase7PublishPreflight("pf-no-ver", "1.0.0", BASELINE, inputs, T);
    expect(result.preflightStatus).toBe("blocked");
    expect(result.blockingIssues).toContain("Config version does not exist");
  });

  it("blocked when prevalidation failed", () => {
    const inputs: PreflightCheckInputs = { ...cleanInputs(), config: { ...cleanInputs().config, prevalidationPassed: false } };
    const result = runPhase7PublishPreflight("pf-preval", "1.0.0", BASELINE, inputs, T);
    expect(result.preflightStatus).toBe("blocked");
    expect(result.blockingIssues.some(i => i.includes("prevalidation"))).toBe(true);
  });

  it("blocked when dry-run failed", () => {
    const inputs: PreflightCheckInputs = { ...cleanInputs(), config: { ...cleanInputs().config, dryRunPassed: false } };
    const result = runPhase7PublishPreflight("pf-dryrun", "1.0.0", BASELINE, inputs, T);
    expect(result.preflightStatus).toBe("blocked");
    expect(result.blockingIssues.some(i => i.includes("dry-run"))).toBe(true);
  });

  it("blocked when audit chain incomplete", () => {
    const inputs: PreflightCheckInputs = { ...cleanInputs(), config: { ...cleanInputs().config, auditChainComplete: false } };
    const result = runPhase7PublishPreflight("pf-audit", "1.0.0", BASELINE, inputs, T);
    expect(result.preflightStatus).toBe("blocked");
    expect(result.blockingIssues.some(i => i.includes("audit chain"))).toBe(true);
  });

  it("blocked when read view inconsistent", () => {
    const inputs: PreflightCheckInputs = { ...cleanInputs(), config: { ...cleanInputs().config, readViewConsistent: false } };
    const result = runPhase7PublishPreflight("pf-readview", "1.0.0", BASELINE, inputs, T);
    expect(result.preflightStatus).toBe("blocked");
    expect(result.blockingIssues.some(i => i.includes("read view"))).toBe(true);
  });
});

// ─── preflight: blocked — contracts ─────────────────────────────────────────

describe("PublishPreflight: contract blocking", () => {
  it("blocked when API contract versions changed", () => {
    const inputs: PreflightCheckInputs = { ...cleanInputs(), contracts: { ...cleanInputs().contracts, apiContractVersionsUnchanged: false } };
    const result = runPhase7PublishPreflight("pf-api", "1.0.0", BASELINE, inputs, T);
    expect(result.preflightStatus).toBe("blocked");
    expect(result.blockingIssues.some(i => i.includes("API contract"))).toBe(true);
  });

  it("blocked when event contract versions changed", () => {
    const inputs: PreflightCheckInputs = { ...cleanInputs(), contracts: { ...cleanInputs().contracts, eventContractVersionsUnchanged: false } };
    const result = runPhase7PublishPreflight("pf-event", "1.0.0", BASELINE, inputs, T);
    expect(result.preflightStatus).toBe("blocked");
    expect(result.blockingIssues.some(i => i.includes("Event contract"))).toBe(true);
  });

  it("blocked when error code versions changed", () => {
    const inputs: PreflightCheckInputs = { ...cleanInputs(), contracts: { ...cleanInputs().contracts, errorCodeVersionsUnchanged: false } };
    const result = runPhase7PublishPreflight("pf-err", "1.0.0", BASELINE, inputs, T);
    expect(result.preflightStatus).toBe("blocked");
    expect(result.blockingIssues.some(i => i.includes("Error code"))).toBe(true);
  });
});

// ─── preflight: blocked — audit/replay ──────────────────────────────────────

describe("PublishPreflight: audit/replay blocking", () => {
  it("blocked when replay semantics not passed", () => {
    const inputs: PreflightCheckInputs = { ...cleanInputs(), auditReplay: { ...cleanInputs().auditReplay, replaySemanticsPassed: false } };
    const result = runPhase7PublishPreflight("pf-replay", "1.0.0", BASELINE, inputs, T);
    expect(result.preflightStatus).toBe("blocked");
    expect(result.blockingIssues.some(i => i.includes("Replay"))).toBe(true);
  });

  it("blocked when event store not accessible", () => {
    const inputs: PreflightCheckInputs = { ...cleanInputs(), auditReplay: { ...cleanInputs().auditReplay, eventStoreAccessible: false } };
    const result = runPhase7PublishPreflight("pf-store", "1.0.0", BASELINE, inputs, T);
    expect(result.preflightStatus).toBe("blocked");
    expect(result.blockingIssues.some(i => i.includes("Event store"))).toBe(true);
  });
});

// ─── consistency ────────────────────────────────────────────────────────────

describe("PublishPreflight: consistency", () => {
  it("passed path is consistent", () => {
    const result = runPhase7PublishPreflight("pf-con-p", "1.0.0", BASELINE, cleanInputs(), T);
    const c = validatePhase7PreflightConsistency(result);
    expect(c.consistent).toBe(true);
    expect(c.violations.length).toBe(0);
    expect(c.checkedInvariants).toBe(5);
  });

  it("blocked path is consistent", () => {
    const inputs: PreflightCheckInputs = { ...cleanInputs(), config: { ...cleanInputs().config, configVersionExists: false } };
    const result = runPhase7PublishPreflight("pf-con-b", "1.0.0", BASELINE, inputs, T);
    const c = validatePhase7PreflightConsistency(result);
    expect(c.consistent).toBe(true);
  });

  it("detects inconsistency: passed but has blocking", () => {
    const fakeResult = { ...runPhase7PublishPreflight("pf-con-x", "1.0.0", BASELINE, cleanInputs(), T), preflightStatus: "passed" as const, blockingIssues: ["fake issue"] };
    const c = validatePhase7PreflightConsistency(fakeResult);
    expect(c.consistent).toBe(false);
    expect(c.violations.some(v => v.includes("passed but blockingIssues"))).toBe(true);
  });
});

// ─── summary ────────────────────────────────────────────────────────────────

describe("PublishPreflight: summary", () => {
  it("passed summary contains cleared", () => {
    const result = runPhase7PublishPreflight("pf-sum", "1.0.0", BASELINE, cleanInputs(), T);
    expect(result.summary).toContain("PASSED");
    expect(result.summary).toContain("cleared");
  });

  it("blocked summary contains blocking info", () => {
    const inputs: PreflightCheckInputs = { ...cleanInputs(), config: { ...cleanInputs().config, configVersionExists: false } };
    const result = runPhase7PublishPreflight("pf-sum-b", "1.0.0", BASELINE, inputs, T);
    expect(result.summary).toContain("BLOCKED");
    expect(result.summary).toContain("NOT cleared");
  });
});
