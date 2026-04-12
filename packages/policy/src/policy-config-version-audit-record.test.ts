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
import { diffPolicyConfigs } from "./policy-bundle-diff.js";

const NOW = "2026-03-25T12:00:00.000Z";
const LATER = "2026-03-25T13:00:00.000Z";

describe("AuditRecord: activation success produces complete record", () => {
  it("first activation generates audit with correct fields", () => {
    const policyReg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(policyReg);
    const actReg = createPolicyConfigActivationRegistry();
    actReg.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1"));

    const result = activatePolicyConfigVersion(
      { targetConfigVersion: "1.0.0", activatedBy: "operator", activatedAt: NOW, allowOverrideActive: true },
      policyReg, actReg
    );
    const audit = buildActivationAuditRecord("audit-001", "operator", NOW, result, null);

    expect(audit.auditId).toBe("audit-001");
    expect(audit.actionType).toBe("activate");
    expect(audit.fromVersion).toBeNull();
    expect(audit.toVersion).toBe("1.0.0");
    expect(audit.triggeredBy).toBe("operator");
    expect(audit.triggeredAt).toBe(NOW);
    expect(audit.preflightStatus).toBe(true);
    expect(audit.resultStatus).toBe("activated");
    expect(audit.summary).toContain("Activated");
    expect(audit.summary).toContain("initial");

    const json = JSON.stringify(audit);
    const parsed = JSON.parse(json);
    expect(parsed.auditId).toBe("audit-001");
  });
});

describe("AuditRecord: activation with version switch", () => {
  it("generates audit with diff summary on version switch", () => {
    const policyReg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(policyReg);
    registerDefaultStubPolicies(policyReg);
    const actReg = createPolicyConfigActivationRegistry();
    actReg.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1"));
    actReg.addVersion(createDraftVersionRecord(STUB_POLICY_CONFIG, "stub"));

    activatePolicyConfigVersion(
      { targetConfigVersion: "1.0.0", activatedBy: "op", activatedAt: NOW, allowOverrideActive: true },
      policyReg, actReg
    );
    const result = activatePolicyConfigVersion(
      { targetConfigVersion: "0.1.0-stub", activatedBy: "op", activatedAt: LATER, allowOverrideActive: true },
      policyReg, actReg
    );
    const diff = diffPolicyConfigs(REAL_POLICY_CONFIG_V1, STUB_POLICY_CONFIG);
    const audit = buildActivationAuditRecord("audit-002", "op", LATER, result, diff);

    expect(audit.fromVersion).toBe("1.0.0");
    expect(audit.toVersion).toBe("0.1.0-stub");
    expect(audit.bundleDiffSummary).toContain("policy change");
  });
});

describe("AuditRecord: rollback produces audit", () => {
  it("rollback generates audit with correct action type", () => {
    const policyReg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(policyReg);
    registerDefaultStubPolicies(policyReg);
    const actReg = createPolicyConfigActivationRegistry();
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
    const result = rollbackToPreviousPolicyConfigVersion(
      { rolledBackBy: "admin", rolledBackAt: LATER },
      policyReg, actReg
    );
    const diff = diffPolicyConfigs(STUB_POLICY_CONFIG, REAL_POLICY_CONFIG_V1);
    const audit = buildRollbackAuditRecord("audit-003", "admin", LATER, result, diff);

    expect(audit.actionType).toBe("rollback");
    expect(audit.triggeredBy).toBe("admin");
    expect(audit.resultStatus).toBe("activated");
    expect(audit.summary).toContain("Rolled back");
    expect(audit.bundleDiffSummary).toContain("policy change");
  });
});

describe("AuditRegistry: record and retrieve", () => {
  it("getLatest returns most recent audit", () => {
    const auditReg = createPolicyConfigVersionAuditRegistry();
    const r1 = buildActivationAuditRecord("a1", "op", NOW, {
      requestedVersion: "1.0.0", previousActiveVersion: null, currentActiveVersion: "1.0.0",
      activationStatus: "activated", preflightStatus: true, preflightSummary: "ok",
      bundleSummary: "", warnings: [], errors: [], rollbackAvailable: false
    }, null);
    const r2 = buildActivationAuditRecord("a2", "op", LATER, {
      requestedVersion: "2.0.0", previousActiveVersion: "1.0.0", currentActiveVersion: "2.0.0",
      activationStatus: "activated", preflightStatus: true, preflightSummary: "ok",
      bundleSummary: "", warnings: [], errors: [], rollbackAvailable: true
    }, null);
    auditReg.record(r1);
    auditReg.record(r2);

    expect(auditReg.getLatest()?.auditId).toBe("a2");
    expect(auditReg.getLatestByTargetVersion("1.0.0")?.auditId).toBe("a1");
    expect(auditReg.listAll().length).toBe(2);
  });
});
