import { describe, expect, it } from "vitest";
import { createPolicyRegistry } from "./policy-registry.js";
import { registerDefaultRealPoliciesV1 } from "./default-policy-registration.js";
import { REAL_POLICY_CONFIG_V1 } from "./policy-config-fixtures.js";
import { runPolicyConfigActivationPreflight } from "./policy-config-preflight.js";
import { prioritySequentialFundWaterfallPolicyV1 } from "./priority-sequential-fund-waterfall-policy-v1.js";
import { thresholdCandidateSelectionPolicyV1 } from "./threshold-candidate-selection-policy-v1.js";
import type { PolicyConfigurationRoot } from "./policy-configuration-root.js";
import type { RankingPolicy, RankingPolicyResult } from "./ranking-policy.js";

describe("Preflight: real config passes all checks", () => {
  it("returns passed with all stages OK", () => {
    const reg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(reg);

    const result = runPolicyConfigActivationPreflight(REAL_POLICY_CONFIG_V1, reg);
    expect(result.passed).toBe(true);
    expect(result.validationPassed).toBe(true);
    expect(result.bundleResolved).toBe(true);
    expect(result.dryRunPassed).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.summary).toContain("passed");
  });
});

describe("Preflight: validation failure", () => {
  it("invalid config structure fails at validation stage", () => {
    const reg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(reg);

    const badConfig: PolicyConfigurationRoot = {
      ...REAL_POLICY_CONFIG_V1,
      ranking: { policyType: "ranking", policyName: "", policyVersion: "1.0.0" }
    };
    const result = runPolicyConfigActivationPreflight(badConfig, reg);
    expect(result.passed).toBe(false);
    expect(result.validationPassed).toBe(false);
    expect(result.bundleResolved).toBe(false);
    expect(result.dryRunPassed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("Preflight: bundle resolution failure", () => {
  it("unregistered policy fails at bundle stage", () => {
    const reg = createPolicyRegistry();

    const result = runPolicyConfigActivationPreflight(REAL_POLICY_CONFIG_V1, reg);
    expect(result.passed).toBe(false);
    expect(result.validationPassed).toBe(false);
    expect(result.bundleResolved).toBe(false);
  });
});

describe("Preflight: dry-run failure", () => {
  it("policy that violates contract fails at dry-run stage", () => {
    const reg = createPolicyRegistry();
    const badRanking: RankingPolicy = {
      descriptor: { policyType: "ranking", policyName: "score-descending", policyVersion: "1.0.0" },
      rank(): RankingPolicyResult {
        return {
          policyName: "",
          policyVersion: "1.0.0",
          rankedCandidates: [],
          explanation: "",
          decisionSummary: ""
        };
      }
    };
    reg.register(badRanking.descriptor, badRanking);
    reg.register(prioritySequentialFundWaterfallPolicyV1.descriptor, prioritySequentialFundWaterfallPolicyV1);
    reg.register(thresholdCandidateSelectionPolicyV1.descriptor, thresholdCandidateSelectionPolicyV1);

    const result = runPolicyConfigActivationPreflight(REAL_POLICY_CONFIG_V1, reg);
    expect(result.passed).toBe(false);
    expect(result.validationPassed).toBe(true);
    expect(result.bundleResolved).toBe(true);
    expect(result.dryRunPassed).toBe(false);
  });
});
