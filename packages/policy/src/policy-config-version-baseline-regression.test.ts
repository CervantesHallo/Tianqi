import { describe, expect, it } from "vitest";
import { createPolicyRegistry } from "./policy-registry.js";
import {
  registerDefaultRealPoliciesV1,
  registerDefaultStubPolicies
} from "./default-policy-registration.js";
import { REAL_POLICY_CONFIG_V1, STUB_POLICY_CONFIG } from "./policy-config-fixtures.js";
import { createPolicyConfigActivationRegistry } from "./policy-config-activation-registry.js";
import { createPolicyConfigVersionAuditRegistry } from "./policy-config-version-audit-record.js";
import { createDraftVersionRecord } from "./policy-config-version.js";
import {
  orchestratePolicyConfigActivation,
  orchestratePolicyConfigRollback
} from "./policy-config-activation-orchestrator.js";
import { assertPolicyConfigVersionBaselineConsistency } from "./policy-config-version-baseline-consistency.js";
import {
  PHASE3_CONFIG_VERSION_BASELINE_SCENARIOS,
  PHASE3_CONFIG_VERSION_BASELINE_CORE_FIELDS
} from "./policy-config-version-baseline.js";
import type { PolicyConfigActivationOutcome } from "./policy-config-activation-orchestrator.js";
import type { PolicyConfigurationRoot } from "./policy-configuration-root.js";

const NOW = "2026-03-25T12:00:00.000Z";
const LATER = "2026-03-25T13:00:00.000Z";

const createAuditIdGen = (prefix: string) => {
  let n = 0;
  return () => `${prefix}-${++n}`;
};

const UNRESOLVABLE_CONFIG: PolicyConfigurationRoot = {
  configVersion: "99.0.0-bad",
  ranking: { policyType: "ranking", policyName: "non-existent", policyVersion: "0.0.0" },
  fundWaterfall: { policyType: "fund_waterfall", policyName: "non-existent", policyVersion: "0.0.0" },
  candidateSelection: { policyType: "candidate_selection", policyName: "non-existent", policyVersion: "0.0.0" },
  configSource: "test-unresolvable",
  createdAt: NOW
};

// ─── P1: first_activation_success ───────────────────────────────────────────

describe("Baseline P1: first activation success", () => {
  const baseline = PHASE3_CONFIG_VERSION_BASELINE_SCENARIOS.find((s) => s.baselineId === "P1")!;

  it("activates with correct status, no diff, no rollback", () => {
    const policyReg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(policyReg);
    const actReg = createPolicyConfigActivationRegistry();
    const auditReg = createPolicyConfigVersionAuditRegistry();
    actReg.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1"));

    const outcome = orchestratePolicyConfigActivation(
      { targetConfigVersion: "1.0.0", activatedBy: "op", activatedAt: NOW, allowOverrideActive: true },
      policyReg, actReg, auditReg, createAuditIdGen("p1")
    );

    expect(outcome.activationResult.activationStatus).toBe(baseline.expectedActivationStatus);
    expect(outcome.activationResult.preflightStatus).toBe(baseline.expectedPreflightPassed);
    expect(outcome.bundleDiff).toBeNull();
    expect(outcome.readView.currentActiveVersion).toBe("1.0.0");
    expect(outcome.readView.rollbackAvailable).toBe(baseline.expectedRollbackAvailable);
    expect(outcome.auditRecord.actionType).toBe(baseline.expectedAuditAction);
    expect(outcome.auditRecord.resultStatus).toBe("activated");

    const consistency = assertPolicyConfigVersionBaselineConsistency(outcome);
    expect(consistency.passed).toBe(true);
    expect(consistency.violations).toEqual([]);
  });
});

// ─── P2: version_switch_success ─────────────────────────────────────────────

describe("Baseline P2: version switch success", () => {
  const baseline = PHASE3_CONFIG_VERSION_BASELINE_SCENARIOS.find((s) => s.baselineId === "P2")!;

  it("switches version with correct diff, audit, and rollback flag", () => {
    const policyReg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(policyReg);
    registerDefaultStubPolicies(policyReg);
    const actReg = createPolicyConfigActivationRegistry();
    const auditReg = createPolicyConfigVersionAuditRegistry();
    actReg.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1"));
    actReg.addVersion(createDraftVersionRecord(STUB_POLICY_CONFIG, "stub"));

    orchestratePolicyConfigActivation(
      { targetConfigVersion: "1.0.0", activatedBy: "op", activatedAt: NOW, allowOverrideActive: true },
      policyReg, actReg, auditReg, createAuditIdGen("p2-init")
    );

    const outcome = orchestratePolicyConfigActivation(
      { targetConfigVersion: "0.1.0-stub", activatedBy: "op", activatedAt: LATER, allowOverrideActive: true },
      policyReg, actReg, auditReg, createAuditIdGen("p2")
    );

    expect(outcome.activationResult.activationStatus).toBe(baseline.expectedActivationStatus);
    expect(outcome.activationResult.preflightStatus).toBe(baseline.expectedPreflightPassed);
    expect(outcome.activationResult.previousActiveVersion).toBe("1.0.0");
    expect(outcome.activationResult.currentActiveVersion).toBe("0.1.0-stub");
    expect(outcome.readView.rollbackAvailable).toBe(baseline.expectedRollbackAvailable);

    expect(outcome.bundleDiff).not.toBeNull();
    expect(outcome.bundleDiff!.rankingPolicyChanged).toBe(baseline.expectedDiffShape!.rankingChanged);
    expect(outcome.bundleDiff!.fundWaterfallPolicyChanged).toBe(baseline.expectedDiffShape!.waterfallChanged);
    expect(outcome.bundleDiff!.candidateSelectionPolicyChanged).toBe(baseline.expectedDiffShape!.selectionChanged);
    expect(outcome.bundleDiff!.changedDescriptors.length).toBe(3);

    expect(outcome.auditRecord.actionType).toBe(baseline.expectedAuditAction);
    expect(outcome.auditRecord.fromVersion).toBe("1.0.0");
    expect(outcome.auditRecord.toVersion).toBe("0.1.0-stub");
    expect(outcome.auditRecord.bundleDiffSummary).toContain("policy change");

    const consistency = assertPolicyConfigVersionBaselineConsistency(outcome);
    expect(consistency.passed).toBe(true);
  });
});

// ─── P3: preflight_failure_rejected ─────────────────────────────────────────

describe("Baseline P3: preflight failure rejected", () => {
  const baseline = PHASE3_CONFIG_VERSION_BASELINE_SCENARIOS.find((s) => s.baselineId === "P3")!;

  it("rejects with no pollution to active registry", () => {
    const policyReg = createPolicyRegistry();
    const actReg = createPolicyConfigActivationRegistry();
    const auditReg = createPolicyConfigVersionAuditRegistry();
    actReg.addVersion(createDraftVersionRecord(UNRESOLVABLE_CONFIG, "bad"));

    const outcome = orchestratePolicyConfigActivation(
      { targetConfigVersion: "99.0.0-bad", activatedBy: "op", activatedAt: NOW, allowOverrideActive: true },
      policyReg, actReg, auditReg, createAuditIdGen("p3")
    );

    expect(outcome.activationResult.activationStatus).toBe(baseline.expectedActivationStatus);
    expect(outcome.activationResult.preflightStatus).toBe(baseline.expectedPreflightPassed);
    expect(outcome.activationResult.currentActiveVersion).toBeNull();
    expect(outcome.bundleDiff).toBeNull();
    expect(outcome.readView.currentActiveVersion).toBeNull();
    expect(outcome.readView.rollbackAvailable).toBe(baseline.expectedRollbackAvailable);
    expect(outcome.auditRecord.resultStatus).toBe("rejected");

    expect(actReg.getActiveVersion()).toBeNull();

    const consistency = assertPolicyConfigVersionBaselineConsistency(outcome);
    expect(consistency.passed).toBe(true);
  });
});

// ─── P4: rollback_success ───────────────────────────────────────────────────

describe("Baseline P4: rollback success", () => {
  const baseline = PHASE3_CONFIG_VERSION_BASELINE_SCENARIOS.find((s) => s.baselineId === "P4")!;

  it("rolls back with correct diff, audit, and read view", () => {
    const policyReg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(policyReg);
    registerDefaultStubPolicies(policyReg);
    const actReg = createPolicyConfigActivationRegistry();
    const auditReg = createPolicyConfigVersionAuditRegistry();
    actReg.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1"));
    actReg.addVersion(createDraftVersionRecord(STUB_POLICY_CONFIG, "stub"));

    orchestratePolicyConfigActivation(
      { targetConfigVersion: "1.0.0", activatedBy: "op", activatedAt: NOW, allowOverrideActive: true },
      policyReg, actReg, auditReg, createAuditIdGen("p4-init1")
    );
    orchestratePolicyConfigActivation(
      { targetConfigVersion: "0.1.0-stub", activatedBy: "op", activatedAt: NOW, allowOverrideActive: true },
      policyReg, actReg, auditReg, createAuditIdGen("p4-init2")
    );

    const outcome = orchestratePolicyConfigRollback(
      { rolledBackBy: "admin", rolledBackAt: LATER },
      policyReg, actReg, auditReg, createAuditIdGen("p4")
    );

    expect(outcome.activationResult.activationStatus).toBe(baseline.expectedActivationStatus);
    expect(outcome.activationResult.preflightStatus).toBe(baseline.expectedPreflightPassed);
    expect(outcome.activationResult.currentActiveVersion).toBe("1.0.0");
    expect(outcome.activationResult.previousActiveVersion).toBe("0.1.0-stub");
    expect(outcome.readView.currentActiveVersion).toBe("1.0.0");
    expect(outcome.readView.rollbackAvailable).toBe(baseline.expectedRollbackAvailable);

    expect(outcome.bundleDiff).not.toBeNull();
    expect(outcome.bundleDiff!.rankingPolicyChanged).toBe(baseline.expectedDiffShape!.rankingChanged);
    expect(outcome.bundleDiff!.fundWaterfallPolicyChanged).toBe(baseline.expectedDiffShape!.waterfallChanged);
    expect(outcome.bundleDiff!.candidateSelectionPolicyChanged).toBe(baseline.expectedDiffShape!.selectionChanged);
    expect(outcome.bundleDiff!.fromConfigVersion).toBe("0.1.0-stub");
    expect(outcome.bundleDiff!.toConfigVersion).toBe("1.0.0");

    expect(outcome.auditRecord.actionType).toBe(baseline.expectedAuditAction);
    expect(outcome.auditRecord.resultStatus).toBe("activated");
    expect(outcome.auditRecord.summary).toContain("Rolled back");

    const consistency = assertPolicyConfigVersionBaselineConsistency(outcome);
    expect(consistency.passed).toBe(true);
  });
});

// ─── P5: already_active ────────────────────────────────────────────────────

describe("Baseline P5: already active", () => {
  const baseline = PHASE3_CONFIG_VERSION_BASELINE_SCENARIOS.find((s) => s.baselineId === "P5")!;

  it("does not change state, does not produce diff", () => {
    const policyReg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(policyReg);
    const actReg = createPolicyConfigActivationRegistry();
    const auditReg = createPolicyConfigVersionAuditRegistry();
    actReg.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1"));

    orchestratePolicyConfigActivation(
      { targetConfigVersion: "1.0.0", activatedBy: "op", activatedAt: NOW, allowOverrideActive: true },
      policyReg, actReg, auditReg, createAuditIdGen("p5-init")
    );

    const outcome = orchestratePolicyConfigActivation(
      { targetConfigVersion: "1.0.0", activatedBy: "op", activatedAt: LATER, allowOverrideActive: true },
      policyReg, actReg, auditReg, createAuditIdGen("p5")
    );

    expect(outcome.activationResult.activationStatus).toBe(baseline.expectedActivationStatus);
    expect(outcome.activationResult.preflightStatus).toBe(baseline.expectedPreflightPassed);
    expect(outcome.activationResult.currentActiveVersion).toBe("1.0.0");
    expect(outcome.bundleDiff).toBeNull();
    expect(outcome.readView.currentActiveVersion).toBe("1.0.0");
    expect(outcome.readView.rollbackAvailable).toBe(baseline.expectedRollbackAvailable);
    expect(outcome.auditRecord.resultStatus).toBe("already_active");

    const consistency = assertPolicyConfigVersionBaselineConsistency(outcome);
    expect(consistency.passed).toBe(true);
  });
});

// ─── Consistency checker: violation detection ──────────────────────────────

describe("Consistency checker: detects violations", () => {
  it("detects readView / activationResult mismatch", () => {
    const mismatchedOutcome: PolicyConfigActivationOutcome = {
      activationResult: {
        requestedVersion: "1.0.0",
        previousActiveVersion: null,
        currentActiveVersion: "1.0.0",
        activationStatus: "activated",
        preflightStatus: true,
        preflightSummary: "ok",
        bundleSummary: "",
        warnings: [],
        errors: [],
        rollbackAvailable: false
      },
      auditRecord: {
        auditId: "x",
        actionType: "activate",
        fromVersion: null,
        toVersion: "1.0.0",
        triggeredAt: NOW,
        triggeredBy: "op",
        preflightStatus: true,
        resultStatus: "activated",
        summary: "ok",
        bundleDiffSummary: "N/A"
      },
      bundleDiff: null,
      readView: {
        currentActiveVersion: "WRONG",
        currentStatus: "active",
        currentDescriptors: null,
        previousVersion: null,
        lastAuditAction: "activate",
        lastAuditSummary: null,
        lastChangedAt: null,
        rollbackAvailable: false
      }
    };

    const result = assertPolicyConfigVersionBaselineConsistency(mismatchedOutcome);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]).toContain("currentActiveVersion");
  });

  it("detects already_active with spurious diff", () => {
    const outcome: PolicyConfigActivationOutcome = {
      activationResult: {
        requestedVersion: "1.0.0",
        previousActiveVersion: "1.0.0",
        currentActiveVersion: "1.0.0",
        activationStatus: "already_active",
        preflightStatus: true,
        preflightSummary: "ok",
        bundleSummary: "",
        warnings: [],
        errors: [],
        rollbackAvailable: false
      },
      auditRecord: {
        auditId: "x",
        actionType: "activate",
        fromVersion: "1.0.0",
        toVersion: "1.0.0",
        triggeredAt: NOW,
        triggeredBy: "op",
        preflightStatus: true,
        resultStatus: "already_active",
        summary: "ok",
        bundleDiffSummary: "N/A"
      },
      bundleDiff: {
        fromConfigVersion: "1.0.0",
        toConfigVersion: "1.0.0",
        rankingPolicyChanged: false,
        fundWaterfallPolicyChanged: false,
        candidateSelectionPolicyChanged: false,
        changedDescriptors: [],
        diffSummary: "none"
      },
      readView: {
        currentActiveVersion: "1.0.0",
        currentStatus: "active",
        currentDescriptors: null,
        previousVersion: null,
        lastAuditAction: "activate",
        lastAuditSummary: null,
        lastChangedAt: null,
        rollbackAvailable: false
      }
    };

    const result = assertPolicyConfigVersionBaselineConsistency(outcome);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes("already_active"))).toBe(true);
  });
});

// ─── Baseline core fields constant ─────────────────────────────────────────

describe("Baseline core fields constant", () => {
  it("contains all required fields", () => {
    const required = [
      "activationStatus", "configVersion", "previousVersion",
      "preflightPassed", "auditAction", "diffSummary",
      "currentActiveVersion", "rollbackAvailable"
    ];
    for (const f of required) {
      expect(PHASE3_CONFIG_VERSION_BASELINE_CORE_FIELDS).toContain(f);
    }
  });

  it("scenarios reference only declared audit actions", () => {
    for (const s of PHASE3_CONFIG_VERSION_BASELINE_SCENARIOS) {
      expect(["activate", "rollback"]).toContain(s.expectedAuditAction);
    }
  });
});
