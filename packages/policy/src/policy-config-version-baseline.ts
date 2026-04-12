import type { PolicyConfigActivationStatus } from "./policy-config-activation.js";
import type { PolicyConfigVersionAuditActionType } from "./policy-config-version-audit-record.js";

export type PolicyConfigVersionBaselineDiffShape = {
  readonly rankingChanged: boolean;
  readonly waterfallChanged: boolean;
  readonly selectionChanged: boolean;
} | null;

export type PolicyConfigVersionBaselineReadViewShape = {
  readonly hasActiveVersion: boolean;
  readonly rollbackAvailable: boolean;
};

export type PolicyConfigVersionBaseline = {
  readonly baselineId: string;
  readonly scenarioName: string;
  readonly expectedActivationStatus: PolicyConfigActivationStatus;
  readonly expectedPreflightPassed: boolean;
  readonly expectedDiffShape: PolicyConfigVersionBaselineDiffShape;
  readonly expectedReadViewShape: PolicyConfigVersionBaselineReadViewShape;
  readonly expectedAuditAction: PolicyConfigVersionAuditActionType;
  readonly expectedRollbackAvailable: boolean;
  readonly notes: string;
};

export const PHASE3_CONFIG_VERSION_BASELINE_CORE_FIELDS = [
  "activationStatus",
  "configVersion",
  "previousVersion",
  "preflightPassed",
  "auditAction",
  "diffSummary",
  "currentActiveVersion",
  "rollbackAvailable"
] as const;

export type Phase3ConfigVersionBaselineCoreField =
  typeof PHASE3_CONFIG_VERSION_BASELINE_CORE_FIELDS[number];

export const PHASE3_CONFIG_VERSION_BASELINE_SCENARIOS: readonly PolicyConfigVersionBaseline[] = [
  {
    baselineId: "P1",
    scenarioName: "first_activation_success",
    expectedActivationStatus: "activated",
    expectedPreflightPassed: true,
    expectedDiffShape: null,
    expectedReadViewShape: { hasActiveVersion: true, rollbackAvailable: false },
    expectedAuditAction: "activate",
    expectedRollbackAvailable: false,
    notes: "First activation with no previous version; no diff; rollback unavailable"
  },
  {
    baselineId: "P2",
    scenarioName: "version_switch_success",
    expectedActivationStatus: "activated",
    expectedPreflightPassed: true,
    expectedDiffShape: { rankingChanged: true, waterfallChanged: true, selectionChanged: true },
    expectedReadViewShape: { hasActiveVersion: true, rollbackAvailable: true },
    expectedAuditAction: "activate",
    expectedRollbackAvailable: true,
    notes: "Switch from real v1 to stub; all three policies change; rollback available"
  },
  {
    baselineId: "P3",
    scenarioName: "preflight_failure_rejected",
    expectedActivationStatus: "rejected",
    expectedPreflightPassed: false,
    expectedDiffShape: null,
    expectedReadViewShape: { hasActiveVersion: false, rollbackAvailable: false },
    expectedAuditAction: "activate",
    expectedRollbackAvailable: false,
    notes: "Unresolvable config fails preflight; active version unchanged; no diff"
  },
  {
    baselineId: "P4",
    scenarioName: "rollback_success",
    expectedActivationStatus: "activated",
    expectedPreflightPassed: true,
    expectedDiffShape: { rankingChanged: true, waterfallChanged: true, selectionChanged: true },
    expectedReadViewShape: { hasActiveVersion: true, rollbackAvailable: true },
    expectedAuditAction: "rollback",
    expectedRollbackAvailable: true,
    notes: "Rollback from stub to real v1; all three descriptors revert; rollback still available"
  },
  {
    baselineId: "P5",
    scenarioName: "already_active",
    expectedActivationStatus: "already_active",
    expectedPreflightPassed: true,
    expectedDiffShape: null,
    expectedReadViewShape: { hasActiveVersion: true, rollbackAvailable: false },
    expectedAuditAction: "activate",
    expectedRollbackAvailable: false,
    notes: "Activating the already-active version; no change; no diff; no side effects"
  }
];
