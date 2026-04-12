export type PolicyType = "ranking" | "fund_waterfall" | "candidate_selection";

export const POLICY_TYPES: readonly PolicyType[] = [
  "ranking",
  "fund_waterfall",
  "candidate_selection"
] as const;

export type PolicyDescriptor = {
  readonly policyType: PolicyType;
  readonly policyName: string;
  readonly policyVersion: string;
};

export const buildPolicyKey = (d: PolicyDescriptor): string =>
  `${d.policyType}:${d.policyName}:${d.policyVersion}`;
