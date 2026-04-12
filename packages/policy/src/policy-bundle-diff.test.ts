import { describe, expect, it } from "vitest";
import { REAL_POLICY_CONFIG_V1, STUB_POLICY_CONFIG } from "./policy-config-fixtures.js";
import { diffPolicyConfigs } from "./policy-bundle-diff.js";
import type { PolicyConfigurationRoot } from "./policy-configuration-root.js";

describe("BundleDiff: same version = no change", () => {
  it("returns all false flags and empty changes", () => {
    const diff = diffPolicyConfigs(REAL_POLICY_CONFIG_V1, REAL_POLICY_CONFIG_V1);
    expect(diff.rankingPolicyChanged).toBe(false);
    expect(diff.fundWaterfallPolicyChanged).toBe(false);
    expect(diff.candidateSelectionPolicyChanged).toBe(false);
    expect(diff.changedDescriptors.length).toBe(0);
    expect(diff.diffSummary).toContain("No policy changes");
  });
});

describe("BundleDiff: ranking changed", () => {
  it("detects ranking policy name change", () => {
    const modified: PolicyConfigurationRoot = {
      ...REAL_POLICY_CONFIG_V1,
      configVersion: "2.0.0",
      ranking: { policyType: "ranking", policyName: "weighted-rank", policyVersion: "2.0.0" }
    };
    const diff = diffPolicyConfigs(REAL_POLICY_CONFIG_V1, modified);
    expect(diff.rankingPolicyChanged).toBe(true);
    expect(diff.fundWaterfallPolicyChanged).toBe(false);
    expect(diff.candidateSelectionPolicyChanged).toBe(false);
    expect(diff.changedDescriptors.length).toBe(1);
    expect(diff.changedDescriptors[0]!.policyType).toBe("ranking");
    expect(diff.diffSummary).toContain("1 policy change");
    expect(diff.diffSummary).toContain("ranking");
  });
});

describe("BundleDiff: waterfall changed", () => {
  it("detects fund waterfall policy version change", () => {
    const modified: PolicyConfigurationRoot = {
      ...REAL_POLICY_CONFIG_V1,
      configVersion: "2.0.0",
      fundWaterfall: { policyType: "fund_waterfall", policyName: "priority-sequential", policyVersion: "2.0.0" }
    };
    const diff = diffPolicyConfigs(REAL_POLICY_CONFIG_V1, modified);
    expect(diff.fundWaterfallPolicyChanged).toBe(true);
    expect(diff.changedDescriptors.length).toBe(1);
    expect(diff.changedDescriptors[0]!.policyType).toBe("fund_waterfall");
  });
});

describe("BundleDiff: selection changed", () => {
  it("detects candidate selection policy change", () => {
    const modified: PolicyConfigurationRoot = {
      ...REAL_POLICY_CONFIG_V1,
      configVersion: "2.0.0",
      candidateSelection: { policyType: "candidate_selection", policyName: "whitelist-filter", policyVersion: "1.0.0" }
    };
    const diff = diffPolicyConfigs(REAL_POLICY_CONFIG_V1, modified);
    expect(diff.candidateSelectionPolicyChanged).toBe(true);
    expect(diff.changedDescriptors.length).toBe(1);
  });
});

describe("BundleDiff: all three changed", () => {
  it("detects all changes with correct summary", () => {
    const diff = diffPolicyConfigs(REAL_POLICY_CONFIG_V1, STUB_POLICY_CONFIG);
    expect(diff.rankingPolicyChanged).toBe(true);
    expect(diff.fundWaterfallPolicyChanged).toBe(true);
    expect(diff.candidateSelectionPolicyChanged).toBe(true);
    expect(diff.changedDescriptors.length).toBe(3);
    expect(diff.diffSummary).toContain("3 policy change(s)");
    expect(diff.fromConfigVersion).toBe("1.0.0");
    expect(diff.toConfigVersion).toBe("0.1.0-stub");
  });
});
