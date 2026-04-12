import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@tianqi/contracts";
import { createPolicyRegistry } from "./policy-registry.js";
import { validatePolicyConfigurationRoot, type PolicyConfigurationRoot } from "./policy-configuration-root.js";
import type { RankingPolicy, RankingPolicyResult } from "./ranking-policy.js";
import type { FundWaterfallPolicy, FundWaterfallPolicyResult } from "./fund-waterfall-policy.js";
import type { CandidateSelectionPolicy, CandidateSelectionPolicyResult } from "./candidate-selection-policy.js";
import type { PolicyDescriptor } from "./policy-descriptor.js";

const stubRanking: RankingPolicy = {
  descriptor: { policyType: "ranking", policyName: "default-rank", policyVersion: "1.0.0" },
  rank: () => ({ policyName: "default-rank", policyVersion: "1.0.0", rankedCandidates: [], explanation: "stub", decisionSummary: "stub" }) as RankingPolicyResult
};

const stubWaterfall: FundWaterfallPolicy = {
  descriptor: { policyType: "fund_waterfall", policyName: "default-waterfall", policyVersion: "1.0.0" },
  allocate: () => ({ policyName: "default-waterfall", policyVersion: "1.0.0", allocations: [], totalAllocated: "0", shortfallAmount: "0", explanation: "stub", decisionSummary: "stub" }) as FundWaterfallPolicyResult
};

const stubSelection: CandidateSelectionPolicy = {
  descriptor: { policyType: "candidate_selection", policyName: "default-selection", policyVersion: "1.0.0" },
  select: () => ({ policyName: "default-selection", policyVersion: "1.0.0", selectedCandidates: [], rejectedCandidates: [], excludedCount: 0, appliedThreshold: 0, explanation: "stub", decisionSummary: "stub" }) as CandidateSelectionPolicyResult
};

const buildValidConfig = (): PolicyConfigurationRoot => ({
  configVersion: "1.0.0",
  ranking: { policyType: "ranking", policyName: "default-rank", policyVersion: "1.0.0" },
  fundWaterfall: { policyType: "fund_waterfall", policyName: "default-waterfall", policyVersion: "1.0.0" },
  candidateSelection: { policyType: "candidate_selection", policyName: "default-selection", policyVersion: "1.0.0" },
  configSource: "test",
  createdAt: "2026-03-25T00:00:00.000Z"
});

const buildRegistryWithAll = () => {
  const reg = createPolicyRegistry();
  reg.register(stubRanking.descriptor, stubRanking);
  reg.register(stubWaterfall.descriptor, stubWaterfall);
  reg.register(stubSelection.descriptor, stubSelection);
  return reg;
};

describe("PolicyConfigurationRoot: complete config passes validation", () => {
  it("valid config with all policies registered", () => {
    const result = validatePolicyConfigurationRoot(buildValidConfig(), buildRegistryWithAll());
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });
});

describe("PolicyConfigurationRoot: missing policy config fails", () => {
  it("empty ranking name fails", () => {
    const config: PolicyConfigurationRoot = {
      ...buildValidConfig(),
      ranking: { policyType: "ranking", policyName: "", policyVersion: "1.0.0" }
    };
    const result = validatePolicyConfigurationRoot(config, buildRegistryWithAll());
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.errorType === "policy_config_incomplete")).toBe(true);
  });

  it("empty waterfall version fails", () => {
    const config: PolicyConfigurationRoot = {
      ...buildValidConfig(),
      fundWaterfall: { policyType: "fund_waterfall", policyName: "default-waterfall", policyVersion: "" }
    };
    const result = validatePolicyConfigurationRoot(config, buildRegistryWithAll());
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === ERROR_CODES.POLICY_CONFIG_INCOMPLETE)).toBe(true);
  });

  it("empty configVersion fails", () => {
    const config: PolicyConfigurationRoot = {
      ...buildValidConfig(),
      configVersion: ""
    };
    const result = validatePolicyConfigurationRoot(config, buildRegistryWithAll());
    expect(result.valid).toBe(false);
  });
});

describe("PolicyConfigurationRoot: type mismatch fails", () => {
  it("ranking descriptor with wrong policyType fails", () => {
    const config: PolicyConfigurationRoot = {
      ...buildValidConfig(),
      ranking: { policyType: "fund_waterfall" as PolicyDescriptor["policyType"], policyName: "default-rank", policyVersion: "1.0.0" }
    };
    const result = validatePolicyConfigurationRoot(config, buildRegistryWithAll());
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.errorType === "policy_type_mismatch")).toBe(true);
  });
});

describe("PolicyConfigurationRoot: unregistered policy fails", () => {
  it("ranking references unregistered policy", () => {
    const config: PolicyConfigurationRoot = {
      ...buildValidConfig(),
      ranking: { policyType: "ranking", policyName: "nonexistent", policyVersion: "1.0.0" }
    };
    const result = validatePolicyConfigurationRoot(config, buildRegistryWithAll());
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.errorType === "policy_config_unresolvable")).toBe(true);
    expect(result.errors.some((e) => e.code === ERROR_CODES.POLICY_CONFIG_UNRESOLVABLE)).toBe(true);
  });

  it("all three unregistered → three errors", () => {
    const reg = createPolicyRegistry();
    const result = validatePolicyConfigurationRoot(buildValidConfig(), reg);
    expect(result.valid).toBe(false);
    expect(result.errors.filter((e) => e.errorType === "policy_config_unresolvable").length).toBe(3);
  });
});

describe("PolicyConfigurationRoot: serialization", () => {
  it("config root is serializable to JSON and back", () => {
    const config = buildValidConfig();
    const json = JSON.stringify(config);
    const parsed = JSON.parse(json) as PolicyConfigurationRoot;
    expect(parsed.configVersion).toBe(config.configVersion);
    expect(parsed.ranking.policyName).toBe(config.ranking.policyName);
    expect(parsed.fundWaterfall.policyType).toBe("fund_waterfall");
    expect(parsed.candidateSelection.policyType).toBe("candidate_selection");
  });
});
