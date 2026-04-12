import { ok, err } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";
import type { PolicyDescriptor, PolicyType } from "./policy-descriptor.js";
import { buildPolicyKey } from "./policy-descriptor.js";
import type { RankingPolicy } from "./ranking-policy.js";
import type { FundWaterfallPolicy } from "./fund-waterfall-policy.js";
import type { CandidateSelectionPolicy } from "./candidate-selection-policy.js";
import type { PolicyError } from "./policy-error.js";
import {
  policyNotRegisteredError,
  policyTypeMismatchError,
  policyVersionInvalidError
} from "./policy-error.js";

export type AnyPolicy = RankingPolicy | FundWaterfallPolicy | CandidateSelectionPolicy;

export type PolicyRegistryOperations = {
  register(descriptor: PolicyDescriptor, policy: AnyPolicy): Result<void, PolicyError>;
  resolve(descriptor: PolicyDescriptor): Result<AnyPolicy, PolicyError>;
  listByType(policyType: PolicyType): readonly PolicyDescriptor[];
};

export const createPolicyRegistry = (): PolicyRegistryOperations => {
  const entries = new Map<string, { readonly descriptor: PolicyDescriptor; readonly policy: AnyPolicy }>();

  return {
    register(descriptor, policy) {
      if (!descriptor.policyName.trim() || !descriptor.policyVersion.trim()) {
        return err(policyVersionInvalidError(descriptor));
      }
      if (policy.descriptor.policyType !== descriptor.policyType) {
        return err(policyTypeMismatchError(descriptor, policy.descriptor.policyType));
      }
      entries.set(buildPolicyKey(descriptor), { descriptor, policy });
      return ok(undefined);
    },

    resolve(descriptor) {
      const entry = entries.get(buildPolicyKey(descriptor));
      if (entry === undefined) {
        return err(policyNotRegisteredError(descriptor));
      }
      return ok(entry.policy);
    },

    listByType(policyType) {
      return [...entries.values()]
        .filter((e) => e.descriptor.policyType === policyType)
        .map((e) => e.descriptor);
    }
  };
};
