export { buildPolicyKey, POLICY_TYPES } from "./policy-descriptor.js";
export type { PolicyDescriptor, PolicyType } from "./policy-descriptor.js";

export type {
  AdlCandidate,
  RankingPolicy,
  RankingPolicyInput,
  RankingPolicyResult
} from "./ranking-policy.js";

export type {
  FundAllocationEntry,
  FundSource,
  FundWaterfallPolicy,
  FundWaterfallPolicyInput,
  FundWaterfallPolicyResult
} from "./fund-waterfall-policy.js";

export type {
  CandidateSelectionPolicy,
  CandidateSelectionPolicyInput,
  CandidateSelectionPolicyResult,
  RejectedCandidate,
  SelectedCandidate
} from "./candidate-selection-policy.js";

export {
  auditWriteFailedError,
  configActivationPreflightFailedError,
  configAlreadyActiveError,
  configLifecycleInvalidError,
  configReadViewUnavailableError,
  configRollbackTargetMissingError,
  configVersionNotFoundError,
  policyBundleResolutionError,
  policyConfigIncompleteError,
  policyConfigUnresolvableError,
  policyDryRunError,
  policyNotRegisteredError,
  policyTypeMismatchError,
  policyVersionInvalidError
} from "./policy-error.js";
export type { PolicyError, PolicyErrorType } from "./policy-error.js";

export { createPolicyRegistry } from "./policy-registry.js";
export type { AnyPolicy, PolicyRegistryOperations } from "./policy-registry.js";

export { validatePolicyConfigurationRoot } from "./policy-configuration-root.js";
export type {
  PolicyConfigurationRoot,
  PolicyConfigurationValidationResult
} from "./policy-configuration-root.js";

export type { PolicyBundle } from "./policy-bundle.js";

export { resolvePolicyBundle } from "./policy-bundle-resolver.js";
export type {
  PolicyBundleResolutionFailure,
  PolicyBundleResolutionResult
} from "./policy-bundle-resolver.js";

export { prevalidatePolicyConfiguration } from "./policy-configuration-prevalidation.js";
export type { PolicyConfigurationPrevalidationResult } from "./policy-configuration-prevalidation.js";

export { dryRunPolicyBundle } from "./policy-bundle-dry-run.js";
export type { PolicyBundleDryRunResult } from "./policy-bundle-dry-run.js";

export { defaultRankingPolicyStub } from "./default-ranking-policy-stub.js";
export { defaultFundWaterfallPolicyStub } from "./default-fund-waterfall-policy-stub.js";
export { defaultCandidateSelectionPolicyStub } from "./default-candidate-selection-policy-stub.js";

export { scoreDescendingRankingPolicyV1 } from "./score-descending-ranking-policy-v1.js";
export { prioritySequentialFundWaterfallPolicyV1 } from "./priority-sequential-fund-waterfall-policy-v1.js";
export {
  createThresholdCandidateSelectionPolicyV1,
  DEFAULT_SELECTION_THRESHOLD,
  thresholdCandidateSelectionPolicyV1
} from "./threshold-candidate-selection-policy-v1.js";

export {
  registerAllDefaultPolicies,
  registerDefaultRealPoliciesV1,
  registerDefaultStubPolicies
} from "./default-policy-registration.js";

export { REAL_POLICY_CONFIG_V1, STUB_POLICY_CONFIG } from "./policy-config-fixtures.js";

export { createDraftVersionRecord } from "./policy-config-version.js";
export type {
  PolicyConfigVersionRecord,
  PolicyConfigVersionStatus
} from "./policy-config-version.js";

export { runPolicyConfigActivationPreflight } from "./policy-config-preflight.js";
export type { PolicyConfigPreflightResult } from "./policy-config-preflight.js";

export { createPolicyConfigActivationRegistry } from "./policy-config-activation-registry.js";
export type { PolicyConfigActivationRegistryOperations } from "./policy-config-activation-registry.js";

export { activatePolicyConfigVersion } from "./policy-config-activation.js";
export type {
  ActivatePolicyConfigVersionCommand,
  PolicyConfigActivationResult,
  PolicyConfigActivationStatus
} from "./policy-config-activation.js";

export { rollbackToPreviousPolicyConfigVersion } from "./policy-config-rollback.js";
export type { RollbackPolicyConfigVersionCommand } from "./policy-config-rollback.js";

export {
  buildActivationAuditRecord,
  buildRollbackAuditRecord,
  createPolicyConfigVersionAuditRegistry
} from "./policy-config-version-audit-record.js";
export type {
  PolicyConfigVersionAuditActionType,
  PolicyConfigVersionAuditRecord,
  PolicyConfigVersionAuditRegistryOperations
} from "./policy-config-version-audit-record.js";

export { diffPolicyConfigs } from "./policy-bundle-diff.js";
export type {
  PolicyBundleDiff,
  PolicyDescriptorChange
} from "./policy-bundle-diff.js";

export { buildPolicyConfigVersionReadView } from "./policy-config-version-read-view.js";
export type { PolicyConfigVersionReadView } from "./policy-config-version-read-view.js";

export {
  orchestratePolicyConfigActivation,
  orchestratePolicyConfigRollback
} from "./policy-config-activation-orchestrator.js";
export type { PolicyConfigActivationOutcome } from "./policy-config-activation-orchestrator.js";

export {
  PHASE3_CONFIG_VERSION_BASELINE_CORE_FIELDS,
  PHASE3_CONFIG_VERSION_BASELINE_SCENARIOS
} from "./policy-config-version-baseline.js";
export type {
  Phase3ConfigVersionBaselineCoreField,
  PolicyConfigVersionBaseline,
  PolicyConfigVersionBaselineDiffShape,
  PolicyConfigVersionBaselineReadViewShape
} from "./policy-config-version-baseline.js";

export { assertPolicyConfigVersionBaselineConsistency } from "./policy-config-version-baseline-consistency.js";
export type { PolicyConfigVersionBaselineConsistencyResult } from "./policy-config-version-baseline-consistency.js";

export {
  buildDifferenceReport,
  classifyFieldDrift,
  PHASE3_BLOCKING_DRIFT_FIELDS,
  PHASE3_NOTICE_DRIFT_FIELDS,
  PHASE3_POLICY_CONFIG_BASELINE_CORE_FIELDS
} from "./policy-config-difference-report.js";
export type {
  Phase3PolicyConfigBaselineCoreField,
  Phase3PolicyConfigDifferenceReport,
  Phase3ScenarioExpectedBaseline,
  Phase3ScenarioFieldSnapshot
} from "./policy-config-difference-report.js";

export {
  buildPhase3AcceptanceInputSnapshot,
  PHASE3_CONFIG_VERSION_SCENARIO_BASELINES,
  PHASE3_STRATEGY_SCENARIO_BASELINES,
  runPhase3PolicyConfigDifferenceMatrix
} from "./policy-config-difference-matrix.js";
export type {
  Phase3AcceptanceInputSnapshot,
  Phase3MatrixOverallStatus,
  Phase3PolicyConfigDifferenceMatrix
} from "./policy-config-difference-matrix.js";

export { assertPhase3PolicyConfigBaselineConsistency } from "./policy-config-matrix-consistency.js";
export type { Phase3MatrixConsistencyResult } from "./policy-config-matrix-consistency.js";

export {
  buildPhase3AcceptanceGateSummary,
  runPhase3AcceptanceGate
} from "./policy-config-acceptance-gate.js";
export type {
  Phase3AcceptanceGateChecklistItem,
  Phase3AcceptanceGateRecommendedDecision,
  Phase3AcceptanceGateResult,
  Phase3AcceptanceGateStatus
} from "./policy-config-acceptance-gate.js";

export {
  assemblePhase3FinalAcceptance,
  buildPhase3FinalAcceptanceSummary,
  buildPhase3PreCloseChecklist,
  determineFinalAcceptanceStatus,
  runPhase3FinalAcceptance,
  validatePhase3FinalAcceptanceConsistency
} from "./policy-config-final-acceptance.js";
export type {
  Phase3FinalAcceptanceConsistencyResult,
  Phase3FinalAcceptanceResult,
  Phase3FinalAcceptanceStatus,
  Phase3PreCloseChecklist,
  Phase3PreCloseChecklistItem
} from "./policy-config-final-acceptance.js";

export {
  assemblePhase3FinalCloseDecision,
  PHASE3_FINAL_REQUIRED_ARTIFACTS,
  runPhase3FinalCloseDecision,
  validatePhase3FinalCloseDecisionConsistency,
  verifyPhase3Artifacts
} from "./policy-config-final-close-decision.js";
export type {
  Phase3FinalCloseConsistencyResult,
  Phase3FinalCloseDecision,
  Phase3FinalCloseDecisionStatus,
  Phase3RequiredArtifact
} from "./policy-config-final-close-decision.js";
