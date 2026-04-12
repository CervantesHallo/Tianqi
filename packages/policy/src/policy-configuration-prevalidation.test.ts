import { describe, expect, it } from "vitest";
import { createPolicyRegistry } from "./policy-registry.js";
import { prevalidatePolicyConfiguration } from "./policy-configuration-prevalidation.js";
import { defaultRankingPolicyStub } from "./default-ranking-policy-stub.js";
import { defaultFundWaterfallPolicyStub } from "./default-fund-waterfall-policy-stub.js";
import { defaultCandidateSelectionPolicyStub } from "./default-candidate-selection-policy-stub.js";
import type { PolicyConfigurationRoot } from "./policy-configuration-root.js";

const registerAllStubs = () => {
  const reg = createPolicyRegistry();
  reg.register(defaultRankingPolicyStub.descriptor, defaultRankingPolicyStub);
  reg.register(defaultFundWaterfallPolicyStub.descriptor, defaultFundWaterfallPolicyStub);
  reg.register(defaultCandidateSelectionPolicyStub.descriptor, defaultCandidateSelectionPolicyStub);
  return reg;
};

const validConfig: PolicyConfigurationRoot = {
  configVersion: "1.0.0",
  ranking: defaultRankingPolicyStub.descriptor,
  fundWaterfall: defaultFundWaterfallPolicyStub.descriptor,
  candidateSelection: defaultCandidateSelectionPolicyStub.descriptor,
  configSource: "test",
  createdAt: "2026-03-25T00:00:00.000Z"
};

describe("Prevalidation: complete config", () => {
  it("passes with all 3 types resolved and stub warnings", () => {
    const result = prevalidatePolicyConfiguration(validConfig, registerAllStubs());
    expect(result.isValid).toBe(true);
    expect(result.configVersion).toBe("1.0.0");
    expect(result.resolvedPolicyTypes.length).toBe(3);
    expect(result.resolvedPolicyTypes).toContain("ranking");
    expect(result.resolvedPolicyTypes).toContain("fund_waterfall");
    expect(result.resolvedPolicyTypes).toContain("candidate_selection");
    expect(result.resolvedPolicyKeys.length).toBe(3);
    expect(result.errors.length).toBe(0);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("stub");
    expect(result.summary).toContain("passed");
  });
});

describe("Prevalidation: missing policies", () => {
  it("missing ranking fails", () => {
    const reg = createPolicyRegistry();
    reg.register(defaultFundWaterfallPolicyStub.descriptor, defaultFundWaterfallPolicyStub);
    reg.register(defaultCandidateSelectionPolicyStub.descriptor, defaultCandidateSelectionPolicyStub);

    const result = prevalidatePolicyConfiguration(validConfig, reg);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.summary).toContain("failed");
  });

  it("all unregistered → errors for each", () => {
    const result = prevalidatePolicyConfiguration(validConfig, createPolicyRegistry());
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBe(3);
  });
});

describe("Prevalidation: invalid config", () => {
  it("empty name fails", () => {
    const config: PolicyConfigurationRoot = {
      ...validConfig,
      ranking: { policyType: "ranking", policyName: "", policyVersion: "1.0.0-stub" }
    };
    const result = prevalidatePolicyConfiguration(config, registerAllStubs());
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.errorType === "policy_config_incomplete")).toBe(true);
  });

  it("type mismatch fails", () => {
    const config: PolicyConfigurationRoot = {
      ...validConfig,
      ranking: { ...defaultRankingPolicyStub.descriptor, policyType: "fund_waterfall" }
    };
    const result = prevalidatePolicyConfiguration(config, registerAllStubs());
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.errorType === "policy_type_mismatch")).toBe(true);
  });
});
