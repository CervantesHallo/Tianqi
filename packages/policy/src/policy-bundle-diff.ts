import type { PolicyDescriptor, PolicyType } from "./policy-descriptor.js";
import { buildPolicyKey } from "./policy-descriptor.js";
import type { PolicyConfigurationRoot } from "./policy-configuration-root.js";

export type PolicyDescriptorChange = {
  readonly policyType: PolicyType;
  readonly fromDescriptor: PolicyDescriptor;
  readonly toDescriptor: PolicyDescriptor;
};

export type PolicyBundleDiff = {
  readonly fromConfigVersion: string;
  readonly toConfigVersion: string;
  readonly rankingPolicyChanged: boolean;
  readonly fundWaterfallPolicyChanged: boolean;
  readonly candidateSelectionPolicyChanged: boolean;
  readonly changedDescriptors: readonly PolicyDescriptorChange[];
  readonly diffSummary: string;
};

const descriptorsEqual = (a: PolicyDescriptor, b: PolicyDescriptor): boolean =>
  buildPolicyKey(a) === buildPolicyKey(b);

export const diffPolicyConfigs = (
  from: PolicyConfigurationRoot,
  to: PolicyConfigurationRoot
): PolicyBundleDiff => {
  const changes: PolicyDescriptorChange[] = [];

  const rankingChanged = !descriptorsEqual(from.ranking, to.ranking);
  const waterfallChanged = !descriptorsEqual(from.fundWaterfall, to.fundWaterfall);
  const selectionChanged = !descriptorsEqual(from.candidateSelection, to.candidateSelection);

  if (rankingChanged) {
    changes.push({ policyType: "ranking", fromDescriptor: from.ranking, toDescriptor: to.ranking });
  }
  if (waterfallChanged) {
    changes.push({ policyType: "fund_waterfall", fromDescriptor: from.fundWaterfall, toDescriptor: to.fundWaterfall });
  }
  if (selectionChanged) {
    changes.push({ policyType: "candidate_selection", fromDescriptor: from.candidateSelection, toDescriptor: to.candidateSelection });
  }

  const changeCount = changes.length;
  const diffSummary = changeCount === 0
    ? `No policy changes between ${from.configVersion} and ${to.configVersion}`
    : `${changeCount} policy change(s) from ${from.configVersion} to ${to.configVersion}: ` +
      changes.map((c) =>
        `${c.policyType} ${c.fromDescriptor.policyName}@${c.fromDescriptor.policyVersion}` +
        ` → ${c.toDescriptor.policyName}@${c.toDescriptor.policyVersion}`
      ).join(", ");

  return {
    fromConfigVersion: from.configVersion,
    toConfigVersion: to.configVersion,
    rankingPolicyChanged: rankingChanged,
    fundWaterfallPolicyChanged: waterfallChanged,
    candidateSelectionPolicyChanged: selectionChanged,
    changedDescriptors: changes,
    diffSummary
  };
};
