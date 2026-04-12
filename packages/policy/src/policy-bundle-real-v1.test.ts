import { describe, expect, it } from "vitest";
import { createPolicyRegistry } from "./policy-registry.js";
import { resolvePolicyBundle } from "./policy-bundle-resolver.js";
import { prevalidatePolicyConfiguration } from "./policy-configuration-prevalidation.js";
import { dryRunPolicyBundle } from "./policy-bundle-dry-run.js";
import { registerDefaultStubPolicies, registerDefaultRealPoliciesV1 } from "./default-policy-registration.js";
import { REAL_POLICY_CONFIG_V1, STUB_POLICY_CONFIG } from "./policy-config-fixtures.js";

describe("Real bundle: resolve + prevalidate + dry-run", () => {
  it("real config resolves to a valid bundle with correct descriptors", () => {
    const reg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(reg);

    const result = resolvePolicyBundle(REAL_POLICY_CONFIG_V1, reg);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.configVersion).toBe("1.0.0");
    expect(result.value.rankingPolicyDescriptor.policyName).toBe("score-descending");
    expect(result.value.fundWaterfallPolicyDescriptor.policyName).toBe("priority-sequential");
    expect(result.value.candidateSelectionPolicyDescriptor.policyName).toBe("threshold-filter");
  });

  it("real config passes prevalidation", () => {
    const reg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(reg);

    const result = prevalidatePolicyConfiguration(REAL_POLICY_CONFIG_V1, reg);
    expect(result.isValid).toBe(true);
    expect(result.resolvedPolicyTypes.length).toBe(3);
    expect(result.errors.length).toBe(0);
    expect(result.warnings.length).toBe(0);
  });

  it("real bundle dry-run succeeds with meaningful results", () => {
    const reg = createPolicyRegistry();
    registerDefaultRealPoliciesV1(reg);

    const resolved = resolvePolicyBundle(REAL_POLICY_CONFIG_V1, reg);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const result = dryRunPolicyBundle(resolved.value);
    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);

    expect(result.rankingResult).not.toBeNull();
    expect(result.rankingResult!.policyName).toBe("score-descending");
    expect(result.rankingResult!.policyVersion).toBe("1.0.0");
    expect(result.rankingResult!.rankedCandidates.length).toBe(1);
    expect(result.rankingResult!.explanation).toContain("Ranked");

    expect(result.fundWaterfallResult).not.toBeNull();
    expect(result.fundWaterfallResult!.policyName).toBe("priority-sequential");
    expect(result.fundWaterfallResult!.shortfallAmount).toBe("0");
    expect(result.fundWaterfallResult!.explanation).toContain("Fully funded");

    expect(result.candidateSelectionResult).not.toBeNull();
    expect(result.candidateSelectionResult!.policyName).toBe("threshold-filter");
    expect(result.candidateSelectionResult!.selectedCandidates.length).toBe(1);
    expect(result.candidateSelectionResult!.appliedThreshold).toBe(0);
    expect(result.candidateSelectionResult!.explanation).toContain("Threshold filter");
  });
});

describe("Stub bundle: still works after real policy addition", () => {
  it("stub config resolves and dry-runs successfully", () => {
    const reg = createPolicyRegistry();
    registerDefaultStubPolicies(reg);

    const resolved = resolvePolicyBundle(STUB_POLICY_CONFIG, reg);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    expect(resolved.value.configVersion).toBe("0.1.0-stub");

    const result = dryRunPolicyBundle(resolved.value);
    expect(result.success).toBe(true);
    expect(result.rankingResult!.policyName).toBe("default-score-descending");
    expect(result.fundWaterfallResult!.policyName).toBe("default-priority-fill");
    expect(result.candidateSelectionResult!.policyName).toBe("default-positive-score-filter");
  });

  it("stub prevalidation shows stub warning", () => {
    const reg = createPolicyRegistry();
    registerDefaultStubPolicies(reg);

    const result = prevalidatePolicyConfiguration(STUB_POLICY_CONFIG, reg);
    expect(result.isValid).toBe(true);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("stub");
  });
});

describe("Registry coexistence: stub + real policies", () => {
  it("both stub and real configs resolve from same registry", () => {
    const reg = createPolicyRegistry();
    registerDefaultStubPolicies(reg);
    registerDefaultRealPoliciesV1(reg);

    const stubBundle = resolvePolicyBundle(STUB_POLICY_CONFIG, reg);
    const realBundle = resolvePolicyBundle(REAL_POLICY_CONFIG_V1, reg);

    expect(stubBundle.ok).toBe(true);
    expect(realBundle.ok).toBe(true);

    if (stubBundle.ok && realBundle.ok) {
      expect(stubBundle.value.rankingPolicyDescriptor.policyVersion).toBe("1.0.0-stub");
      expect(realBundle.value.rankingPolicyDescriptor.policyVersion).toBe("1.0.0");
    }
  });

  it("listByType shows both stub and real descriptors", () => {
    const reg = createPolicyRegistry();
    registerDefaultStubPolicies(reg);
    registerDefaultRealPoliciesV1(reg);

    const rankings = reg.listByType("ranking");
    expect(rankings.length).toBe(2);
    const names = rankings.map((d) => d.policyName);
    expect(names).toContain("default-score-descending");
    expect(names).toContain("score-descending");
  });
});
