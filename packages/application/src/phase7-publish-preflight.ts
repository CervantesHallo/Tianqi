// Phase 7 publish preflight: config release guard + contract freeze baseline + blocking rules.

// ─── contract freeze baseline ───────────────────────────────────────────────

export type ContractFreezeBaseline = {
  readonly baselineId: string;
  readonly apiContractVersionSet: readonly string[];
  readonly eventContractVersionSet: readonly string[];
  readonly errorCodeVersionSet: readonly string[];
  readonly frozenAt: string;
  readonly summary: string;
};

export const buildContractFreezeBaseline = (
  baselineId: string,
  apiVersions: readonly string[],
  eventVersions: readonly string[],
  errorCodes: readonly string[],
  frozenAt: string
): ContractFreezeBaseline => ({
  baselineId,
  apiContractVersionSet: apiVersions,
  eventContractVersionSet: eventVersions,
  errorCodeVersionSet: errorCodes,
  frozenAt,
  summary: `Contract baseline [${baselineId}]: ${apiVersions.length} API, ${eventVersions.length} event, ${errorCodes.length} error code versions frozen`
});

// ─── preflight result ───────────────────────────────────────────────────────

export type PublishPreflightStatus = "passed" | "passed_with_notice" | "blocked";

export type Phase7PublishPreflightResult = {
  readonly preflightId: string;
  readonly targetConfigVersion: string;
  readonly contractBaselineVersion: string;
  readonly preflightStatus: PublishPreflightStatus;
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly checkedAt: string;
  readonly summary: string;
};

// ─── blocking rule inputs ───────────────────────────────────────────────────

export type ConfigReleaseCheckInput = {
  readonly configVersionExists: boolean;
  readonly prevalidationPassed: boolean;
  readonly dryRunPassed: boolean;
  readonly auditChainComplete: boolean;
  readonly readViewConsistent: boolean;
};

export type ContractCompatibilityCheckInput = {
  readonly apiContractVersionsUnchanged: boolean;
  readonly eventContractVersionsUnchanged: boolean;
  readonly errorCodeVersionsUnchanged: boolean;
};

export type AuditReplayCheckInput = {
  readonly replaySemanticsPassed: boolean;
  readonly eventStoreAccessible: boolean;
};

export type PreflightCheckInputs = {
  readonly config: ConfigReleaseCheckInput;
  readonly contracts: ContractCompatibilityCheckInput;
  readonly auditReplay: AuditReplayCheckInput;
};

// ─── blocking rule evaluator ────────────────────────────────────────────────

const evaluateConfigBlocking = (config: ConfigReleaseCheckInput): readonly string[] => {
  const issues: string[] = [];
  if (!config.configVersionExists) issues.push("Config version does not exist");
  if (!config.prevalidationPassed) issues.push("Config prevalidation failed");
  if (!config.dryRunPassed) issues.push("Config dry-run failed");
  if (!config.auditChainComplete) issues.push("Config audit chain incomplete");
  if (!config.readViewConsistent) issues.push("Config read view inconsistent");
  return issues;
};

const evaluateContractBlocking = (contracts: ContractCompatibilityCheckInput): readonly string[] => {
  const issues: string[] = [];
  if (!contracts.apiContractVersionsUnchanged) issues.push("API contract versions changed — frozen baseline broken");
  if (!contracts.eventContractVersionsUnchanged) issues.push("Event contract versions changed — frozen baseline broken");
  if (!contracts.errorCodeVersionsUnchanged) issues.push("Error code versions changed — frozen baseline broken");
  return issues;
};

const evaluateAuditReplayBlocking = (audit: AuditReplayCheckInput): readonly string[] => {
  const issues: string[] = [];
  if (!audit.replaySemanticsPassed) issues.push("Replay semantics not passed — minimum replayability unverified");
  if (!audit.eventStoreAccessible) issues.push("Event store not accessible");
  return issues;
};

// ─── preflight runner ───────────────────────────────────────────────────────

export const runPhase7PublishPreflight = (
  preflightId: string,
  targetConfigVersion: string,
  baseline: ContractFreezeBaseline,
  inputs: PreflightCheckInputs,
  checkedAt: string
): Phase7PublishPreflightResult => {
  const configBlocking = evaluateConfigBlocking(inputs.config);
  const contractBlocking = evaluateContractBlocking(inputs.contracts);
  const auditBlocking = evaluateAuditReplayBlocking(inputs.auditReplay);

  const blockingIssues = [...configBlocking, ...contractBlocking, ...auditBlocking];

  const nonBlockingNotices: string[] = [];
  if (inputs.config.readViewConsistent && !inputs.config.auditChainComplete) {
    nonBlockingNotices.push("Audit chain incomplete but read view consistent — review recommended");
  }

  const preflightStatus: PublishPreflightStatus =
    blockingIssues.length > 0 ? "blocked"
    : nonBlockingNotices.length > 0 ? "passed_with_notice"
    : "passed";

  return {
    preflightId,
    targetConfigVersion,
    contractBaselineVersion: baseline.baselineId,
    preflightStatus,
    blockingIssues,
    nonBlockingNotices,
    checkedAt,
    summary: buildPreflightSummary(preflightId, preflightStatus, blockingIssues, nonBlockingNotices)
  };
};

const buildPreflightSummary = (
  id: string, status: PublishPreflightStatus, blocking: readonly string[], notices: readonly string[]
): string => {
  const lines: string[] = [];
  if (status === "passed") { lines.push(`Publish preflight [${id}] PASSED: all checks passed`); lines.push("Release is cleared for deployment"); }
  else if (status === "passed_with_notice") { lines.push(`Publish preflight [${id}] PASSED WITH NOTICE`); lines.push("Release can proceed after reviewing notices"); }
  else { lines.push(`Publish preflight [${id}] BLOCKED: ${blocking.length} blocking issue(s)`); lines.push("Release is NOT cleared for deployment"); }
  if (blocking.length > 0) lines.push(`Blocking: ${blocking.join("; ")}`);
  if (notices.length > 0) lines.push(`Notices: ${notices.join("; ")}`);
  return lines.join("\n");
};

// ─── consistency validation ─────────────────────────────────────────────────

export type Phase7PreflightConsistencyResult = {
  readonly consistent: boolean;
  readonly violations: readonly string[];
  readonly checkedInvariants: number;
};

export const validatePhase7PreflightConsistency = (
  result: Phase7PublishPreflightResult
): Phase7PreflightConsistencyResult => {
  const violations: string[] = [];
  if (result.preflightStatus === "passed" && result.blockingIssues.length > 0) violations.push("passed but blockingIssues present");
  if (result.preflightStatus === "blocked" && result.blockingIssues.length === 0) violations.push("blocked but no blockingIssues");
  if (result.preflightStatus === "passed_with_notice" && result.nonBlockingNotices.length === 0 && result.blockingIssues.length === 0) violations.push("passed_with_notice but no notices and no blocking");
  if (result.preflightStatus === "passed" && result.nonBlockingNotices.length > 0) violations.push("passed but has nonBlockingNotices — should be passed_with_notice");
  if (!result.targetConfigVersion || result.targetConfigVersion.length === 0) violations.push("targetConfigVersion is empty");
  return { consistent: violations.length === 0, violations, checkedInvariants: 5 };
};
