import { describe, expect, it } from "vitest";
import { createPolicyRegistry } from "./policy-registry.js";
import { registerDefaultRealPoliciesV1, registerDefaultStubPolicies } from "./default-policy-registration.js";
import { REAL_POLICY_CONFIG_V1, STUB_POLICY_CONFIG } from "./policy-config-fixtures.js";
import { createPolicyConfigActivationRegistry } from "./policy-config-activation-registry.js";
import { activatePolicyConfigVersion } from "./policy-config-activation.js";
import { rollbackToPreviousPolicyConfigVersion } from "./policy-config-rollback.js";
import { createDraftVersionRecord } from "./policy-config-version.js";

const NOW = "2026-03-25T12:00:00.000Z";
const LATER = "2026-03-25T13:00:00.000Z";

const buildRollbackCommand = () => ({
  rolledBackBy: "test-operator",
  rolledBackAt: LATER
});

describe("Rollback: successful rollback", () => {
  it("rolls back from v2 to v1 after version switch", () => {
    const policyReg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(policyReg);
    registerDefaultStubPolicies(policyReg);
    const actReg = createPolicyConfigActivationRegistry();

    actReg.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1 real"));
    actReg.addVersion(createDraftVersionRecord(STUB_POLICY_CONFIG, "v0 stub"));

    activatePolicyConfigVersion(
      { targetConfigVersion: "1.0.0", activatedBy: "op", activatedAt: NOW, allowOverrideActive: true },
      policyReg, actReg
    );
    activatePolicyConfigVersion(
      { targetConfigVersion: "0.1.0-stub", activatedBy: "op", activatedAt: NOW, allowOverrideActive: true },
      policyReg, actReg
    );

    expect(actReg.getActiveVersion()?.configVersion).toBe("0.1.0-stub");

    const result = rollbackToPreviousPolicyConfigVersion(buildRollbackCommand(), policyReg, actReg);

    expect(result.activationStatus).toBe("activated");
    expect(result.currentActiveVersion).toBe("1.0.0");
    expect(result.previousActiveVersion).toBe("0.1.0-stub");
    expect(result.preflightStatus).toBe(true);
    expect(result.rollbackAvailable).toBe(true);

    expect(actReg.getActiveVersion()?.configVersion).toBe("1.0.0");
    expect(actReg.getVersion("0.1.0-stub")?.status).toBe("rolled_back");
  });
});

describe("Rollback: no active version", () => {
  it("rejects when no version is active", () => {
    const policyReg = createPolicyRegistry();
    const actReg = createPolicyConfigActivationRegistry();

    const result = rollbackToPreviousPolicyConfigVersion(buildRollbackCommand(), policyReg, actReg);
    expect(result.activationStatus).toBe("rejected");
    expect(result.errors.some((e) => e.errorType === "config_rollback_target_missing")).toBe(true);
  });
});

describe("Rollback: no previous version", () => {
  it("rejects when active version has no previous", () => {
    const policyReg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(policyReg);
    const actReg = createPolicyConfigActivationRegistry();
    actReg.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1"));
    activatePolicyConfigVersion(
      { targetConfigVersion: "1.0.0", activatedBy: "op", activatedAt: NOW, allowOverrideActive: true },
      policyReg, actReg
    );

    const result = rollbackToPreviousPolicyConfigVersion(buildRollbackCommand(), policyReg, actReg);
    expect(result.activationStatus).toBe("rejected");
    expect(result.errors.some((e) => e.errorType === "config_rollback_target_missing")).toBe(true);
  });
});

describe("Rollback: preflight failure on target", () => {
  it("rejects when rollback target fails preflight", () => {
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

    const emptyPolicyReg = createPolicyRegistry();
    registerDefaultStubPolicies(emptyPolicyReg);

    const result = rollbackToPreviousPolicyConfigVersion(buildRollbackCommand(), emptyPolicyReg, actReg);
    expect(result.activationStatus).toBe("rejected");
    expect(result.preflightStatus).toBe(false);
    expect(actReg.getActiveVersion()?.configVersion).toBe("0.1.0-stub");
  });
});

describe("Rollback: state updates correctly", () => {
  it("rolled back version is marked as rolled_back", () => {
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

    rollbackToPreviousPolicyConfigVersion(buildRollbackCommand(), policyReg, actReg);

    const v1 = actReg.getVersion("1.0.0");
    const stub = actReg.getVersion("0.1.0-stub");
    expect(v1?.status).toBe("active");
    expect(stub?.status).toBe("rolled_back");
    expect(actReg.getActiveVersion()?.configVersion).toBe("1.0.0");
  });
});
