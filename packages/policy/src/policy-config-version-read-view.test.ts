import { describe, expect, it } from "vitest";
import { createPolicyRegistry } from "./policy-registry.js";
import { registerDefaultRealPoliciesV1, registerDefaultStubPolicies } from "./default-policy-registration.js";
import { REAL_POLICY_CONFIG_V1, STUB_POLICY_CONFIG } from "./policy-config-fixtures.js";
import { createPolicyConfigActivationRegistry } from "./policy-config-activation-registry.js";
import { activatePolicyConfigVersion } from "./policy-config-activation.js";
import { rollbackToPreviousPolicyConfigVersion } from "./policy-config-rollback.js";
import { createDraftVersionRecord } from "./policy-config-version.js";
import {
  buildActivationAuditRecord,
  buildRollbackAuditRecord,
  createPolicyConfigVersionAuditRegistry
} from "./policy-config-version-audit-record.js";
import { buildPolicyConfigVersionReadView } from "./policy-config-version-read-view.js";
import { diffPolicyConfigs } from "./policy-bundle-diff.js";

const NOW = "2026-03-25T12:00:00.000Z";
const LATER = "2026-03-25T13:00:00.000Z";

describe("ReadView: active version present", () => {
  it("assembles complete read view with descriptors and audit", () => {
    const policyReg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(policyReg);
    const actReg = createPolicyConfigActivationRegistry();
    const auditReg = createPolicyConfigVersionAuditRegistry();

    actReg.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1"));
    const result = activatePolicyConfigVersion(
      { targetConfigVersion: "1.0.0", activatedBy: "op", activatedAt: NOW, allowOverrideActive: true },
      policyReg, actReg
    );
    const audit = buildActivationAuditRecord("a1", "op", NOW, result, null);
    auditReg.record(audit);

    const view = buildPolicyConfigVersionReadView(actReg, auditReg);
    expect(view.currentActiveVersion).toBe("1.0.0");
    expect(view.currentStatus).toBe("active");
    expect(view.currentDescriptors).not.toBeNull();
    expect(view.currentDescriptors!.ranking.policyName).toBe("score-descending");
    expect(view.currentDescriptors!.fundWaterfall.policyName).toBe("priority-sequential");
    expect(view.currentDescriptors!.candidateSelection.policyName).toBe("threshold-filter");
    expect(view.previousVersion).toBeNull();
    expect(view.lastAuditAction).toBe("activate");
    expect(view.lastAuditSummary).toContain("Activated");
    expect(view.lastChangedAt).toBe(NOW);
    expect(view.rollbackAvailable).toBe(false);
  });
});

describe("ReadView: rollbackAvailable tracking", () => {
  it("shows rollbackAvailable=true after version switch", () => {
    const policyReg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(policyReg);
    registerDefaultStubPolicies(policyReg);
    const actReg = createPolicyConfigActivationRegistry();
    const auditReg = createPolicyConfigVersionAuditRegistry();

    actReg.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1"));
    actReg.addVersion(createDraftVersionRecord(STUB_POLICY_CONFIG, "stub"));

    const r1 = activatePolicyConfigVersion(
      { targetConfigVersion: "1.0.0", activatedBy: "op", activatedAt: NOW, allowOverrideActive: true },
      policyReg, actReg
    );
    auditReg.record(buildActivationAuditRecord("a1", "op", NOW, r1, null));

    const r2 = activatePolicyConfigVersion(
      { targetConfigVersion: "0.1.0-stub", activatedBy: "op", activatedAt: LATER, allowOverrideActive: true },
      policyReg, actReg
    );
    const diff = diffPolicyConfigs(REAL_POLICY_CONFIG_V1, STUB_POLICY_CONFIG);
    auditReg.record(buildActivationAuditRecord("a2", "op", LATER, r2, diff));

    const view = buildPolicyConfigVersionReadView(actReg, auditReg);
    expect(view.currentActiveVersion).toBe("0.1.0-stub");
    expect(view.previousVersion).toBe("1.0.0");
    expect(view.rollbackAvailable).toBe(true);
    expect(view.lastAuditAction).toBe("activate");
    expect(view.lastAuditSummary).toContain("0.1.0-stub");
  });
});

describe("ReadView: after rollback", () => {
  it("reflects restored version with rollback audit", () => {
    const policyReg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(policyReg);
    registerDefaultStubPolicies(policyReg);
    const actReg = createPolicyConfigActivationRegistry();
    const auditReg = createPolicyConfigVersionAuditRegistry();

    actReg.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1"));
    actReg.addVersion(createDraftVersionRecord(STUB_POLICY_CONFIG, "stub"));

    activatePolicyConfigVersion(
      { targetConfigVersion: "1.0.0", activatedBy: "op", activatedAt: NOW, allowOverrideActive: true },
      policyReg, actReg
    );
    activatePolicyConfigVersion(
      { targetConfigVersion: "0.1.0-stub", activatedBy: "op", activatedAt: NOW, allowOverrideActive: true },
      policyReg, actReg
    );

    const rbResult = rollbackToPreviousPolicyConfigVersion(
      { rolledBackBy: "admin", rolledBackAt: LATER },
      policyReg, actReg
    );
    const diff = diffPolicyConfigs(STUB_POLICY_CONFIG, REAL_POLICY_CONFIG_V1);
    auditReg.record(buildRollbackAuditRecord("a3", "admin", LATER, rbResult, diff));

    const view = buildPolicyConfigVersionReadView(actReg, auditReg);
    expect(view.currentActiveVersion).toBe("1.0.0");
    expect(view.lastAuditAction).toBe("rollback");
    expect(view.lastAuditSummary).toContain("Rolled back");
  });
});

describe("ReadView: no active version", () => {
  it("returns empty view with null fields", () => {
    const actReg = createPolicyConfigActivationRegistry();
    const auditReg = createPolicyConfigVersionAuditRegistry();

    const view = buildPolicyConfigVersionReadView(actReg, auditReg);
    expect(view.currentActiveVersion).toBeNull();
    expect(view.currentStatus).toBeNull();
    expect(view.currentDescriptors).toBeNull();
    expect(view.previousVersion).toBeNull();
    expect(view.rollbackAvailable).toBe(false);
    expect(view.lastAuditAction).toBeNull();
  });
});
