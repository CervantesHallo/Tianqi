import { describe, expect, it } from "vitest";
import { createPolicyRegistry } from "./policy-registry.js";
import { registerDefaultRealPoliciesV1, registerDefaultStubPolicies } from "./default-policy-registration.js";
import { REAL_POLICY_CONFIG_V1, STUB_POLICY_CONFIG } from "./policy-config-fixtures.js";
import { createPolicyConfigActivationRegistry } from "./policy-config-activation-registry.js";
import { activatePolicyConfigVersion } from "./policy-config-activation.js";
import { createDraftVersionRecord } from "./policy-config-version.js";

const NOW = "2026-03-25T12:00:00.000Z";

const buildActivationCommand = (version: string, allowOverride = true) => ({
  targetConfigVersion: version,
  activatedBy: "test-operator",
  activatedAt: NOW,
  allowOverrideActive: allowOverride
});

describe("Activation: first activation succeeds", () => {
  it("activates a draft version after preflight passes", () => {
    const policyReg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(policyReg);
    const actReg = createPolicyConfigActivationRegistry();
    actReg.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "Real v1 config"));

    const result = activatePolicyConfigVersion(
      buildActivationCommand("1.0.0"),
      policyReg,
      actReg
    );
    expect(result.activationStatus).toBe("activated");
    expect(result.currentActiveVersion).toBe("1.0.0");
    expect(result.previousActiveVersion).toBeNull();
    expect(result.preflightStatus).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.rollbackAvailable).toBe(false);
    expect(result.bundleSummary).toContain("score-descending");

    const active = actReg.getActiveVersion();
    expect(active?.configVersion).toBe("1.0.0");
    expect(active?.status).toBe("active");
  });
});

describe("Activation: version not found", () => {
  it("rejects when target version does not exist", () => {
    const policyReg = createPolicyRegistry();
    const actReg = createPolicyConfigActivationRegistry();

    const result = activatePolicyConfigVersion(
      buildActivationCommand("nonexistent"),
      policyReg,
      actReg
    );
    expect(result.activationStatus).toBe("rejected");
    expect(result.errors.some((e) => e.errorType === "config_version_not_found")).toBe(true);
  });
});

describe("Activation: already active", () => {
  it("returns already_active when requesting the same version", () => {
    const policyReg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(policyReg);
    const actReg = createPolicyConfigActivationRegistry();
    actReg.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1"));

    activatePolicyConfigVersion(buildActivationCommand("1.0.0"), policyReg, actReg);
    const result = activatePolicyConfigVersion(buildActivationCommand("1.0.0"), policyReg, actReg);

    expect(result.activationStatus).toBe("already_active");
    expect(result.errors.some((e) => e.errorType === "config_already_active")).toBe(true);
  });
});

describe("Activation: preflight failure rejects", () => {
  it("rejects when policies are not registered", () => {
    const policyReg = createPolicyRegistry();
    const actReg = createPolicyConfigActivationRegistry();
    actReg.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1"));

    const result = activatePolicyConfigVersion(
      buildActivationCommand("1.0.0"),
      policyReg,
      actReg
    );
    expect(result.activationStatus).toBe("rejected");
    expect(result.preflightStatus).toBe(false);
    expect(result.errors.some((e) => e.errorType === "config_activation_preflight_failed")).toBe(true);

    const record = actReg.getVersion("1.0.0");
    expect(record?.status).toBe("rejected");
  });
});

describe("Activation: version switch with previous version tracking", () => {
  it("tracks previous version when switching from v1 to v2", () => {
    const policyReg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(policyReg);
    registerDefaultStubPolicies(policyReg);
    const actReg = createPolicyConfigActivationRegistry();

    actReg.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1 real"));
    actReg.addVersion(createDraftVersionRecord(STUB_POLICY_CONFIG, "v0 stub"));

    activatePolicyConfigVersion(buildActivationCommand("1.0.0"), policyReg, actReg);
    const result = activatePolicyConfigVersion(
      buildActivationCommand("0.1.0-stub"),
      policyReg,
      actReg
    );

    expect(result.activationStatus).toBe("activated");
    expect(result.previousActiveVersion).toBe("1.0.0");
    expect(result.currentActiveVersion).toBe("0.1.0-stub");
    expect(result.rollbackAvailable).toBe(true);

    const oldVersion = actReg.getVersion("1.0.0");
    expect(oldVersion?.status).toBe("rolled_back");
  });
});

describe("Activation: allowOverrideActive guard", () => {
  it("rejects when allowOverrideActive is false and active exists", () => {
    const policyReg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(policyReg);
    registerDefaultStubPolicies(policyReg);
    const actReg = createPolicyConfigActivationRegistry();
    actReg.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1"));
    actReg.addVersion(createDraftVersionRecord(STUB_POLICY_CONFIG, "stub"));

    activatePolicyConfigVersion(buildActivationCommand("1.0.0"), policyReg, actReg);
    const result = activatePolicyConfigVersion(
      buildActivationCommand("0.1.0-stub", false),
      policyReg,
      actReg
    );

    expect(result.activationStatus).toBe("rejected");
    expect(result.errors.some((e) => e.errorType === "config_lifecycle_invalid")).toBe(true);
    expect(actReg.getActiveVersion()?.configVersion).toBe("1.0.0");
  });
});
