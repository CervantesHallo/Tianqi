import type { RiskCaseId } from "@tianqi/shared";
import type { PolicyBundle } from "./policy-bundle.js";
import type { PolicyError } from "./policy-error.js";
import { policyDryRunError } from "./policy-error.js";
import type { RankingPolicyResult } from "./ranking-policy.js";
import type { FundWaterfallPolicyResult } from "./fund-waterfall-policy.js";
import type { CandidateSelectionPolicyResult } from "./candidate-selection-policy.js";

export type PolicyBundleDryRunResult = {
  readonly configVersion: string;
  readonly success: boolean;
  readonly rankingResult: RankingPolicyResult | null;
  readonly fundWaterfallResult: FundWaterfallPolicyResult | null;
  readonly candidateSelectionResult: CandidateSelectionPolicyResult | null;
  readonly errors: readonly PolicyError[];
  readonly summary: string;
};

const STUB_CASE_ID = "dry-run-stub-case" as RiskCaseId;

const validateResultContract = (
  result: { policyName: string; policyVersion: string; explanation: string },
  label: string
): string | null => {
  if (!result.policyName) return `${label}: policyName missing`;
  if (!result.policyVersion) return `${label}: policyVersion missing`;
  if (!result.explanation) return `${label}: explanation missing`;
  return null;
};

export const dryRunPolicyBundle = (bundle: PolicyBundle): PolicyBundleDryRunResult => {
  const errors: PolicyError[] = [];
  let rankingResult: RankingPolicyResult | null = null;
  let waterfallResult: FundWaterfallPolicyResult | null = null;
  let selectionResult: CandidateSelectionPolicyResult | null = null;

  try {
    rankingResult = bundle.rankingPolicy.rank({
      caseId: STUB_CASE_ID,
      candidates: [{ accountId: "dry-run-account", score: 1 }]
    });
    const rankCheck = validateResultContract(rankingResult, "ranking");
    if (rankCheck) errors.push(policyDryRunError(bundle.rankingPolicyDescriptor, rankCheck));
  } catch {
    errors.push(policyDryRunError(bundle.rankingPolicyDescriptor, "rank() threw exception"));
  }

  try {
    waterfallResult = bundle.fundWaterfallPolicy.allocate({
      caseId: STUB_CASE_ID,
      requestedAmount: "100",
      availableSources: [{ sourceId: "dry-run-source", sourceType: "stub", availableAmount: "1000", priority: 1 }]
    });
    const waterfallCheck = validateResultContract(waterfallResult, "fund_waterfall");
    if (waterfallCheck) errors.push(policyDryRunError(bundle.fundWaterfallPolicyDescriptor, waterfallCheck));
  } catch {
    errors.push(policyDryRunError(bundle.fundWaterfallPolicyDescriptor, "allocate() threw exception"));
  }

  try {
    selectionResult = bundle.candidateSelectionPolicy.select({
      caseId: STUB_CASE_ID,
      candidates: [{ accountId: "dry-run-account", score: 1 }],
      selectionCriteria: "dry-run"
    });
    const selectionCheck = validateResultContract(selectionResult, "candidate_selection");
    if (selectionCheck) errors.push(policyDryRunError(bundle.candidateSelectionPolicyDescriptor, selectionCheck));
  } catch {
    errors.push(policyDryRunError(bundle.candidateSelectionPolicyDescriptor, "select() threw exception"));
  }

  const success = errors.length === 0;
  const summary = success
    ? `Dry-run passed: all 3 policies callable, contracts valid (config ${bundle.configVersion})`
    : `Dry-run failed: ${errors.length} error(s) (config ${bundle.configVersion})`;

  return {
    configVersion: bundle.configVersion,
    success,
    rankingResult,
    fundWaterfallResult: waterfallResult,
    candidateSelectionResult: selectionResult,
    errors,
    summary
  };
};
