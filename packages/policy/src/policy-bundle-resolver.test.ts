import { describe, expect, it } from "vitest";
import { createPolicyRegistry } from "./policy-registry.js";
import { resolvePolicyBundle } from "./policy-bundle-resolver.js";
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

describe("PolicyBundleResolver: successful resolution", () => {
  it("complete config resolves to a valid bundle", () => {
    const result = resolvePolicyBundle(validConfig, registerAllStubs());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.configVersion).toBe("1.0.0");
      expect(result.value.rankingPolicyDescriptor.policyName).toBe("default-score-descending");
      expect(result.value.fundWaterfallPolicyDescriptor.policyName).toBe("default-priority-fill");
      expect(result.value.candidateSelectionPolicyDescriptor.policyName).toBe("default-positive-score-filter");
      expect(result.value.rankingPolicy.descriptor.policyType).toBe("ranking");
      expect(result.value.fundWaterfallPolicy.descriptor.policyType).toBe("fund_waterfall");
      expect(result.value.candidateSelectionPolicy.descriptor.policyType).toBe("candidate_selection");
    }
  });
});

describe("PolicyBundleResolver: failure cases", () => {
  it("missing ranking policy fails", () => {
    const reg = createPolicyRegistry();
    reg.register(defaultFundWaterfallPolicyStub.descriptor, defaultFundWaterfallPolicyStub);
    reg.register(defaultCandidateSelectionPolicyStub.descriptor, defaultCandidateSelectionPolicyStub);

    const result = resolvePolicyBundle(validConfig, reg);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.errorType).toBe("bundle_resolution_failed");
      expect(result.error.errors.length).toBeGreaterThan(0);
    }
  });

  it("invalid descriptor fails", () => {
    const config: PolicyConfigurationRoot = {
      ...validConfig,
      ranking: { policyType: "ranking", policyName: "", policyVersion: "1.0.0" }
    };
    const result = resolvePolicyBundle(config, registerAllStubs());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.errors.some((e) => e.errorType === "policy_config_incomplete")).toBe(true);
    }
  });

  it("type mismatch in config fails", () => {
    const config: PolicyConfigurationRoot = {
      ...validConfig,
      ranking: { ...defaultRankingPolicyStub.descriptor, policyType: "fund_waterfall" }
    };
    const result = resolvePolicyBundle(config, registerAllStubs());
    expect(result.ok).toBe(false);
  });

  it("unregistered policy fails with structured error", () => {
    const config: PolicyConfigurationRoot = {
      ...validConfig,
      ranking: { policyType: "ranking", policyName: "nonexistent", policyVersion: "9.9.9" }
    };
    const result = resolvePolicyBundle(config, registerAllStubs());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.summary).toContain("failed");
    }
  });
});
