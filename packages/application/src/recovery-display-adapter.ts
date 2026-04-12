import type { RecoveryDisplayView } from "./recovery-display-view.js";
import { assertRecoveryDisplayViewCompatibility } from "./recovery-display-view.js";

// Console/API currently share one external DTO in Phase 1.
// It is intentionally smaller than RecoveryDisplayView and only for outbound consumption.
export type RecoveryExternalDto = {
  readonly viewVersion: string;
  readonly recoveryReference: string;
  readonly sinkKind: "audit" | "metrics" | "none";
  readonly mainOutcome: string;
  readonly recordStatus: "open" | "manually_resolved" | "none";
  readonly retryEligibility: "eligible_for_retry" | "manual_repair_only" | "not_applicable";
  readonly hasNote: boolean;
  readonly needsAttention: boolean;
  readonly sinkStatus: {
    readonly audit?: "succeeded" | "failed" | "not_attempted";
    readonly metrics?: "succeeded" | "failed" | "not_attempted";
  };
  readonly summary: {
    readonly hasRecoveryRecord: boolean;
    readonly latestSinkStatus: "succeeded" | "failed" | "not_attempted" | "none";
    readonly queryOutcome: "found" | "missing" | "unavailable" | "not_applicable";
  };
  readonly observedAt?: string;
};

export const RECOVERY_ADAPTER_CHANGE_CLASSIFICATIONS = [
  "internal_only",
  "non_breaking_external",
  "breaking_external"
] as const;

export type RecoveryAdapterChangeClassification =
  (typeof RECOVERY_ADAPTER_CHANGE_CLASSIFICATIONS)[number];

export const RECOVERY_ADAPTER_CHANGE_REVIEW_ACTIONS = [
  "confirm_no_external_dto_field_change",
  "confirm_baseline_update_not_required",
  "confirm_view_version_bump_not_required",
  "confirm_docs_update_not_required_or_explain_why",
  "review_baseline_update_need",
  "review_rehearsal_update_need",
  "review_docs_update_need",
  "confirm_added_fields_optional_or_defaulted",
  "explain_why_view_version_bump_not_required",
  "mark_restricted_high_risk",
  "require_explicit_breaking_reason",
  "require_phase1_exception_rationale",
  "require_view_version_bump",
  "recommend_escalated_review_or_reject_in_phase1"
] as const;

export type RecoveryAdapterChangeReviewAction =
  (typeof RECOVERY_ADAPTER_CHANGE_REVIEW_ACTIONS)[number];

export const RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY = {
  internal_only: {
    touches_external_dto: false,
    touches_shared_core_fields: false,
    baseline_update: "not_required_by_default",
    view_version_bump: "not_required_by_default"
  },
  non_breaking_external: {
    touches_external_dto: true,
    touches_shared_core_fields: false,
    baseline_update: "review_required",
    view_version_bump: "case_by_case"
  },
  breaking_external: {
    touches_external_dto: true,
    touches_shared_core_fields: true,
    baseline_update: "required",
    view_version_bump: "required",
    phase1_policy: "restricted_high_risk"
  }
} as const;

export type RecoveryAdapterChangeReviewHint = {
  readonly classification: RecoveryAdapterChangeClassification;
  readonly aligns_with_policy: {
    readonly touches_external_dto: boolean;
    readonly touches_shared_core_fields: boolean;
    readonly baseline_update:
      | "not_required_by_default"
      | "review_required"
      | "required";
    readonly view_version_bump:
      | "not_required_by_default"
      | "case_by_case"
      | "required";
    readonly phase1_policy?: "restricted_high_risk";
  };
  readonly reviewer_actions: readonly RecoveryAdapterChangeReviewAction[];
};

export type RecoveryAdapterChangeReviewHints = {
  readonly [K in RecoveryAdapterChangeClassification]: RecoveryAdapterChangeReviewHint & {
    readonly classification: K;
  };
};

export const RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS: RecoveryAdapterChangeReviewHints = {
  internal_only: {
    classification: "internal_only",
    aligns_with_policy: RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.internal_only,
    reviewer_actions: [
      "confirm_no_external_dto_field_change",
      "confirm_baseline_update_not_required",
      "confirm_view_version_bump_not_required",
      "confirm_docs_update_not_required_or_explain_why"
    ]
  },
  non_breaking_external: {
    classification: "non_breaking_external",
    aligns_with_policy: RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.non_breaking_external,
    reviewer_actions: [
      "review_baseline_update_need",
      "review_rehearsal_update_need",
      "review_docs_update_need",
      "confirm_added_fields_optional_or_defaulted",
      "explain_why_view_version_bump_not_required"
    ]
  },
  breaking_external: {
    classification: "breaking_external",
    aligns_with_policy: RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.breaking_external,
    reviewer_actions: [
      "mark_restricted_high_risk",
      "require_explicit_breaking_reason",
      "require_phase1_exception_rationale",
      "require_view_version_bump",
      "recommend_escalated_review_or_reject_in_phase1"
    ]
  }
};

export const RECOVERY_DTO_FORK_POLICY = {
  defaultModel: "single_external_dto",
  forkMode: "lightweight_extension_only",
  sharedCoreFieldSemantics: "must_not_diverge",
  compatibilityGate: "must_use_display_compatibility_assertion",
  splitLocation: "external_adapter_layer_only"
} as const;

export const RECOVERY_EXTERNAL_SHARED_CORE_FIELDS = [
  "viewVersion",
  "recoveryReference",
  "sinkKind",
  "mainOutcome",
  "recordStatus",
  "retryEligibility",
  "hasNote",
  "needsAttention",
  "sinkStatus"
] as const;

export const RECOVERY_EXTERNAL_DTO_FIELDS = [
  "viewVersion",
  "recoveryReference",
  "sinkKind",
  "mainOutcome",
  "recordStatus",
  "retryEligibility",
  "hasNote",
  "needsAttention",
  "sinkStatus",
  "summary"
] as const;

export type RecoveryConsoleDtoExtension = {
  readonly consoleBadge?: "attention" | "normal";
};

export type RecoveryApiDtoExtension = {
  readonly apiContractTag?: "stable";
};

export type RecoveryConsoleDto = RecoveryExternalDto & RecoveryConsoleDtoExtension;
export type RecoveryApiDto = RecoveryExternalDto & RecoveryApiDtoExtension;

export const mapRecoveryExternalDtoToConsoleDto = (
  dto: RecoveryExternalDto,
  extension?: RecoveryConsoleDtoExtension
): RecoveryConsoleDto => ({
  ...dto,
  ...(extension ?? {})
});

export const mapRecoveryExternalDtoToApiDto = (
  dto: RecoveryExternalDto,
  extension?: RecoveryApiDtoExtension
): RecoveryApiDto => ({
  ...dto,
  ...(extension ?? {})
});

export const RECOVERY_DISPLAY_CHANGE_IMPACT_CHECKLIST_ITEMS = [
  "touches_shared_core_fields",
  "touches_external_dto_fields",
  "requires_view_version_bump",
  "requires_adapter_test_updates",
  "requires_version_rehearsal_update",
  "requires_docs_update"
] as const;

export type RecoveryDisplayChangeImpactChecklistItem =
  (typeof RECOVERY_DISPLAY_CHANGE_IMPACT_CHECKLIST_ITEMS)[number];

export type RecoveryDisplayChangeImpactChecklist = {
  readonly touches_shared_core_fields: boolean;
  readonly touches_external_dto_fields: boolean;
  readonly requires_view_version_bump: boolean;
  readonly requires_adapter_test_updates: boolean;
  readonly requires_version_rehearsal_update: boolean;
  readonly requires_docs_update: boolean;
};

export const createRecoveryDisplayChangeImpactChecklistTemplate =
  (): RecoveryDisplayChangeImpactChecklist => ({
    touches_shared_core_fields: false,
    touches_external_dto_fields: false,
    requires_view_version_bump: false,
    requires_adapter_test_updates: false,
    requires_version_rehearsal_update: false,
    requires_docs_update: false
  });

export const RECOVERY_DTO_BASELINE_UPDATE_RULES = {
  optional_additive_field_without_dto_exposure: "baseline_update_not_required_by_default",
  shared_core_field_value_domain_change: "baseline_update_required",
  shared_core_field_remove_or_rename: "forbidden_in_phase1",
  view_version_change: "baseline_update_required"
} as const;

export const RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE = {
  change_classification: "internal_only | non_breaking_external | breaking_external",
  baseline_rationale:
    "shared_core_field_domain_change | view_version_change | external_dto_exposure_added | docs_and_rehearsal_alignment",
  touched_shared_core_fields: false,
  touched_external_dto_fields: false,
  updated_adapter_tests: false,
  updated_version_rehearsal: false,
  updated_docs: false,
  requires_view_version_bump: false
} as const;

export type RecoveryDtoBaselineUpdateReasonExample = {
  readonly classification: RecoveryAdapterChangeClassification;
  readonly change_summary: string;
  readonly touched_shared_core_fields: boolean;
  readonly touched_external_dto_fields: boolean;
  readonly updated_baseline: boolean;
  readonly updated_rehearsal: boolean;
  readonly updated_docs: boolean;
  readonly requires_view_version_bump: boolean;
  readonly conclusion: string;
};

export const RECOVERY_BASELINE_AFFECTED_PATHS = [
  "append",
  "manual_resolve",
  "query",
  "display_adapter",
  "recovery_display_view",
  "docs",
  "tests"
] as const;

export type RecoveryBaselineAffectedPath = (typeof RECOVERY_BASELINE_AFFECTED_PATHS)[number];

export const RECOVERY_DTO_BASELINE_HISTORY_ENTRY_FIELDS = [
  "change_date",
  "change_summary",
  "classification",
  "affected_paths",
  "shared_core_fields_touched",
  "baseline_updated",
  "rehearsal_updated",
  "docs_updated",
  "view_version_bumped",
  "rationale",
  "review_notes"
] as const;

export type RecoveryDtoBaselineHistoryEntryTemplate = {
  readonly change_date: string;
  readonly change_summary: string;
  readonly classification: RecoveryAdapterChangeClassification;
  readonly affected_paths: readonly RecoveryBaselineAffectedPath[];
  readonly shared_core_fields_touched: boolean;
  readonly baseline_updated: boolean;
  readonly rehearsal_updated: boolean;
  readonly docs_updated: boolean;
  readonly view_version_bumped: boolean;
  readonly rationale: string;
  readonly review_notes: string;
};

export const RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE = {
  change_date: "YYYY-MM-DD",
  change_summary: "Describe the adapter/display baseline change in one sentence.",
  classification: "internal_only | non_breaking_external | breaking_external",
  affected_paths: ["display_adapter"],
  shared_core_fields_touched: false,
  baseline_updated: false,
  rehearsal_updated: false,
  docs_updated: false,
  view_version_bumped: false,
  rationale: "State why this change is needed and which rule applies.",
  review_notes: "State what was reviewed and key risk notes."
} as const;

export const RECOVERY_DTO_BASELINE_HISTORY_TO_REASON_ALIGNMENT = {
  classification: "change_classification",
  shared_core_fields_touched: "touched_shared_core_fields",
  rehearsal_updated: "updated_version_rehearsal",
  docs_updated: "updated_docs",
  view_version_bumped: "requires_view_version_bump",
  rationale: "baseline_rationale"
} as const;

export const RECOVERY_DTO_BASELINE_HISTORY_ARCHIVE_FIELDS = [
  "change_date",
  "change_summary",
  "affected_paths",
  "baseline_updated",
  "review_notes"
] as const;

export const RECOVERY_DTO_BASELINE_HISTORY_ENTRY_EXAMPLES = {
  non_breaking_external: {
    change_date: "2026-03-25",
    change_summary: "Added one optional external DTO field with default handling.",
    classification: "non_breaking_external",
    affected_paths: ["display_adapter", "query", "tests", "docs"],
    shared_core_fields_touched: false,
    baseline_updated: true,
    rehearsal_updated: true,
    docs_updated: true,
    view_version_bumped: false,
    rationale:
      "External DTO changed in a compatible way; baseline/rehearsal/docs updated and no viewVersion bump required.",
    review_notes:
      "Checked optional/default compatibility, checklist coverage, and baseline snapshot updates."
  },
  breaking_external_theoretical: {
    change_date: "2026-03-25",
    change_summary: "Theoretical: renaming shared core field mainOutcome.",
    classification: "breaking_external",
    affected_paths: ["display_adapter", "recovery_display_view", "tests", "docs"],
    shared_core_fields_touched: true,
    baseline_updated: true,
    rehearsal_updated: true,
    docs_updated: true,
    view_version_bumped: true,
    rationale:
      "Breaking shared core field semantics; Phase 1 restricted_high_risk and requires escalated review.",
    review_notes:
      "Marked as restricted_high_risk, explicit breaking reason documented, candidate for rejection in Phase 1."
  }
} as const;

export const RECOVERY_REVIEW_TRACE_FIELDS = [
  "review_scope",
  "rule_basis",
  "compatibility_checked",
  "baseline_checked",
  "rehearsal_checked",
  "docs_checked",
  "risk_note",
  "follow_up_needed"
] as const;

export type RecoveryReviewTraceField = (typeof RECOVERY_REVIEW_TRACE_FIELDS)[number];

export type RecoveryReviewTraceTemplate = {
  readonly review_scope: string;
  readonly rule_basis: string;
  readonly compatibility_checked: boolean;
  readonly baseline_checked: boolean;
  readonly rehearsal_checked: boolean;
  readonly docs_checked: boolean;
  readonly risk_note: string;
  readonly follow_up_needed: boolean;
};

export const RECOVERY_REVIEW_TRACE_TEMPLATE = {
  review_scope: "Scope reviewed for this adapter/display change.",
  rule_basis: "RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY + RECOVERY_DTO_BASELINE_UPDATE_RULES",
  compatibility_checked: false,
  baseline_checked: false,
  rehearsal_checked: false,
  docs_checked: false,
  risk_note: "Summarize risk and assumptions.",
  follow_up_needed: false
} as const;

export const RECOVERY_REVIEW_TRACE_EXAMPLES = {
  internal_only: {
    review_scope: "Adapter internal refactor only; no external DTO field change.",
    rule_basis:
      "Classification internal_only + checklist + review hints internal_only actions.",
    compatibility_checked: true,
    baseline_checked: true,
    rehearsal_checked: true,
    docs_checked: true,
    risk_note: "Low risk. No shared core field touched.",
    follow_up_needed: false
  },
  breaking_external_theoretical: {
    review_scope: "Theoretical breaking change on shared core field mainOutcome.",
    rule_basis:
      "Classification breaking_external + restricted_high_risk phase policy + escalation guidance.",
    compatibility_checked: true,
    baseline_checked: true,
    rehearsal_checked: true,
    docs_checked: true,
    risk_note: "High risk and restricted in Phase 1; escalate or reject.",
    follow_up_needed: true
  }
} as const;

type RecoveryDtoBaselineReasonTemplateField =
  keyof typeof RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE;

type RecoveryDtoBaselineRuleKey = keyof typeof RECOVERY_DTO_BASELINE_UPDATE_RULES;

export const RECOVERY_CADENCE_LEVELS = ["required", "recommended", "optional"] as const;

export type RecoveryCadenceLevel = (typeof RECOVERY_CADENCE_LEVELS)[number];

export type RecoveryReviewTraceUpdateCadenceGuidanceEntry = {
  readonly classification: RecoveryAdapterChangeClassification;
  readonly cadence: RecoveryCadenceLevel;
  readonly must_write_when: readonly string[];
  readonly skip_policy: string;
  readonly requires_restricted_high_risk_label?: boolean;
  readonly aligns_with_policy: {
    readonly touches_external_dto: boolean;
    readonly touches_shared_core_fields: boolean;
    readonly baseline_update: "not_required_by_default" | "review_required" | "required";
    readonly view_version_bump: "not_required_by_default" | "case_by_case" | "required";
    readonly phase1_policy?: "restricted_high_risk";
  };
  readonly linked_hint_actions: readonly RecoveryAdapterChangeReviewAction[];
  readonly linked_checklist_items: readonly RecoveryDisplayChangeImpactChecklistItem[];
  readonly linked_rationale_fields: readonly RecoveryDtoBaselineReasonTemplateField[];
};

export type RecoveryReviewTraceUpdateCadenceGuidance = {
  readonly [K in RecoveryAdapterChangeClassification]: RecoveryReviewTraceUpdateCadenceGuidanceEntry & {
    readonly classification: K;
  };
};

export const RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE: RecoveryReviewTraceUpdateCadenceGuidance =
  {
    internal_only: {
      classification: "internal_only",
      cadence: "optional",
      must_write_when: [
        "adapter_rule_judgement_changed",
        "compatibility_assertion_path_touched",
        "shared_core_field_judgement_touched"
      ],
      skip_policy:
        "Allowed only when external DTO is untouched; must still explain why classification is internal_only.",
      aligns_with_policy: RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.internal_only,
      linked_hint_actions: [
        "confirm_no_external_dto_field_change",
        "confirm_docs_update_not_required_or_explain_why"
      ],
      linked_checklist_items: ["touches_external_dto_fields", "touches_shared_core_fields"],
      linked_rationale_fields: ["change_classification"]
    },
    non_breaking_external: {
      classification: "non_breaking_external",
      cadence: "required",
      must_write_when: [
        "default_for_non_breaking_external_changes",
        "must_appear_together_with_baseline_reason",
        "external_dto_exposure_changed"
      ],
      skip_policy:
        "Not allowed by default; explicit exception rationale is required if review trace is missing.",
      aligns_with_policy: RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.non_breaking_external,
      linked_hint_actions: [
        "review_baseline_update_need",
        "review_rehearsal_update_need",
        "review_docs_update_need",
        "confirm_added_fields_optional_or_defaulted",
        "explain_why_view_version_bump_not_required"
      ],
      linked_checklist_items: [
        "touches_external_dto_fields",
        "requires_adapter_test_updates",
        "requires_version_rehearsal_update",
        "requires_docs_update"
      ],
      linked_rationale_fields: [
        "change_classification",
        "baseline_rationale",
        "updated_version_rehearsal",
        "updated_docs",
        "requires_view_version_bump"
      ]
    },
    breaking_external: {
      classification: "breaking_external",
      cadence: "required",
      must_write_when: [
        "always_required_for_breaking_external_in_phase1",
        "must_include_restricted_high_risk_marker",
        "must_not_be_replaced_by_verbal_explanation"
      ],
      skip_policy: "Not allowed. Full review trace is mandatory in this restricted high-risk class.",
      requires_restricted_high_risk_label: true,
      aligns_with_policy: RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.breaking_external,
      linked_hint_actions: [
        "mark_restricted_high_risk",
        "require_explicit_breaking_reason",
        "require_phase1_exception_rationale",
        "require_view_version_bump",
        "recommend_escalated_review_or_reject_in_phase1"
      ],
      linked_checklist_items: [
        "touches_shared_core_fields",
        "touches_external_dto_fields",
        "requires_view_version_bump",
        "requires_adapter_test_updates",
        "requires_version_rehearsal_update",
        "requires_docs_update"
      ],
      linked_rationale_fields: ["change_classification", "baseline_rationale", "requires_view_version_bump"]
    }
  };

export type RecoveryBaselineHistoryArchiveCadenceGuidanceEntry = {
  readonly classification: RecoveryAdapterChangeClassification;
  readonly cadence: RecoveryCadenceLevel;
  readonly archive_when: readonly string[];
  readonly skip_policy: string;
  readonly requires_restricted_high_risk_label?: boolean;
  readonly aligns_with_policy: {
    readonly touches_external_dto: boolean;
    readonly touches_shared_core_fields: boolean;
    readonly baseline_update: "not_required_by_default" | "review_required" | "required";
    readonly view_version_bump: "not_required_by_default" | "case_by_case" | "required";
    readonly phase1_policy?: "restricted_high_risk";
  };
  readonly linked_baseline_rules: readonly RecoveryDtoBaselineRuleKey[];
  readonly linked_checklist_items: readonly RecoveryDisplayChangeImpactChecklistItem[];
  readonly linked_reason_fields: readonly RecoveryDtoBaselineReasonTemplateField[];
};

export type RecoveryBaselineHistoryArchiveCadenceGuidance = {
  readonly global_required_when: readonly string[];
  readonly by_classification: {
    readonly [K in RecoveryAdapterChangeClassification]: RecoveryBaselineHistoryArchiveCadenceGuidanceEntry & {
      readonly classification: K;
    };
  };
};

export const RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE: RecoveryBaselineHistoryArchiveCadenceGuidance =
  {
    global_required_when: ["baseline_updated_true", "view_version_bumped_true"],
    by_classification: {
      internal_only: {
        classification: "internal_only",
        cadence: "optional",
        archive_when: [
          "optional_when_internal_only_and_no_external_dto_change",
          "recommended_when_classification_basis_needs_retrospective_explanation"
        ],
        skip_policy:
          "Usually acceptable when external DTO is untouched, but keep brief note if classification basis could be questioned.",
        aligns_with_policy: RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.internal_only,
        linked_baseline_rules: ["optional_additive_field_without_dto_exposure"],
        linked_checklist_items: ["touches_external_dto_fields"],
        linked_reason_fields: ["change_classification", "baseline_rationale"]
      },
      non_breaking_external: {
        classification: "non_breaking_external",
        cadence: "recommended",
        archive_when: [
          "recommended_when_external_dto_exposure_changed",
          "required_if_baseline_or_view_version_global_rules_triggered"
        ],
        skip_policy:
          "Avoid skipping by default; if skipped, provide explicit rationale referencing classification and baseline rules.",
        aligns_with_policy: RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.non_breaking_external,
        linked_baseline_rules: [
          "optional_additive_field_without_dto_exposure",
          "shared_core_field_value_domain_change",
          "view_version_change"
        ],
        linked_checklist_items: [
          "touches_external_dto_fields",
          "requires_adapter_test_updates",
          "requires_version_rehearsal_update",
          "requires_docs_update"
        ],
        linked_reason_fields: [
          "change_classification",
          "baseline_rationale",
          "updated_adapter_tests",
          "updated_version_rehearsal",
          "updated_docs"
        ]
      },
      breaking_external: {
        classification: "breaking_external",
        cadence: "required",
        archive_when: [
          "always_required_for_breaking_external_in_phase1",
          "required_for_shared_core_field_semantic_changes",
          "required_for_view_version_bump"
        ],
        skip_policy: "Not allowed. Breaking changes in Phase 1 must have explicit archived baseline history.",
        requires_restricted_high_risk_label: true,
        aligns_with_policy: RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY.breaking_external,
        linked_baseline_rules: [
          "shared_core_field_value_domain_change",
          "shared_core_field_remove_or_rename",
          "view_version_change"
        ],
        linked_checklist_items: [
          "touches_shared_core_fields",
          "touches_external_dto_fields",
          "requires_view_version_bump",
          "requires_adapter_test_updates",
          "requires_version_rehearsal_update",
          "requires_docs_update"
        ],
        linked_reason_fields: [
          "change_classification",
          "baseline_rationale",
          "updated_adapter_tests",
          "updated_version_rehearsal",
          "updated_docs",
          "requires_view_version_bump"
        ]
      }
    }
  };

export const RECOVERY_CADENCE_GUIDANCE_ALIGNMENT = {
  purpose: "execution_timing_guidance_only",
  does_not_replace: [
    "RECOVERY_DISPLAY_CHANGE_IMPACT_CHECKLIST_ITEMS",
    "RECOVERY_DTO_BASELINE_UPDATE_RULES",
    "RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS"
  ],
  review_trace_guidance_links: [
    "RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE",
    "RECOVERY_REVIEW_TRACE_ALIGNMENT",
    "RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE"
  ],
  baseline_history_guidance_links: [
    "RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE",
    "RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE",
    "RECOVERY_DTO_BASELINE_HISTORY_TO_REASON_ALIGNMENT"
  ]
} as const;

export const RECOVERY_CADENCE_GUIDANCE_EXAMPLES = {
  non_breaking_external_required_pair: {
    classification: "non_breaking_external",
    review_trace_cadence: "required",
    baseline_history_cadence: "required",
    scenario:
      "External DTO exposure changed and baseline snapshot updated; review trace and history entry must both be recorded.",
    note: "Fill review trace together with baseline reason and archive baseline history in the same PR."
  },
  internal_only_optional_lightweight: {
    classification: "internal_only",
    review_trace_cadence: "optional",
    baseline_history_cadence: "optional",
    scenario:
      "Internal adapter refactor only, no external DTO changes; lightweight trace or short note is acceptable.",
    note: "At minimum explain why internal_only classification is valid."
  },
  breaking_external_theoretical_required: {
    classification: "breaking_external",
    review_trace_cadence: "required",
    baseline_history_cadence: "required",
    scenario:
      "Theoretical breaking change touching shared core field semantics in Phase 1 restricted scope.",
    note: "Must mark restricted_high_risk and provide explicit rationale; usually escalate or reject."
  }
} as const;

export const RECOVERY_TRACE_CONSISTENCY_CHECKLIST_ITEMS = [
  "classification_declared",
  "warning_template_checked",
  "impact_checklist_checked",
  "pr_checklist_completed",
  "baseline_reason_filled_or_not_required_explained",
  "review_trace_filled_or_cadence_explained",
  "baseline_history_archived_or_cadence_explained",
  "docs_synced",
  "view_version_bump_decision_recorded",
  "rehearsal_and_baseline_tests_updated_or_not_required_explained"
] as const;

export type RecoveryTraceConsistencyChecklistItem =
  (typeof RECOVERY_TRACE_CONSISTENCY_CHECKLIST_ITEMS)[number];

export type RecoveryTraceConsistencyChecklist = {
  readonly classification_declared: boolean;
  readonly warning_template_checked: boolean;
  readonly impact_checklist_checked: boolean;
  readonly pr_checklist_completed: boolean;
  readonly baseline_reason_filled_or_not_required_explained: boolean;
  readonly review_trace_filled_or_cadence_explained: boolean;
  readonly baseline_history_archived_or_cadence_explained: boolean;
  readonly docs_synced: boolean;
  readonly view_version_bump_decision_recorded: boolean;
  readonly rehearsal_and_baseline_tests_updated_or_not_required_explained: boolean;
  readonly consistency_summary: string;
};

export const RECOVERY_TRACE_CONSISTENCY_CHECKLIST: RecoveryTraceConsistencyChecklist = {
  classification_declared: false,
  warning_template_checked: false,
  impact_checklist_checked: false,
  pr_checklist_completed: false,
  baseline_reason_filled_or_not_required_explained: false,
  review_trace_filled_or_cadence_explained: false,
  baseline_history_archived_or_cadence_explained: false,
  docs_synced: false,
  view_version_bump_decision_recorded: false,
  rehearsal_and_baseline_tests_updated_or_not_required_explained: false,
  consistency_summary: "Record final consistency decision and unresolved gaps."
};

export type RecoveryTraceDocumentReferenceSource =
  | "classification_policy"
  | "warning_template"
  | "impact_checklist"
  | "pr_checklist"
  | "baseline_rationale_template"
  | "review_hints"
  | "cadence_guidance"
  | "baseline_history_and_review_trace_docs";

export const RECOVERY_TRACE_DOCUMENT_REFERENCE_SOURCE_OPTIONS = [
  "classification_policy",
  "warning_template",
  "impact_checklist",
  "pr_checklist",
  "baseline_rationale_template",
  "review_hints",
  "cadence_guidance",
  "baseline_history_and_review_trace_docs"
] as const;

export type RecoveryTraceDocumentReferenceUnusedSource = {
  readonly source: RecoveryTraceDocumentReferenceSource;
  readonly reason: string;
};

export type RecoveryTraceDocumentReferenceTemplate = {
  readonly change_classification: RecoveryAdapterChangeClassification;
  readonly used_sources: readonly RecoveryTraceDocumentReferenceSource[];
  readonly not_used_sources_with_reason: readonly RecoveryTraceDocumentReferenceUnusedSource[];
  readonly reference_summary: string;
};

export const RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE: RecoveryTraceDocumentReferenceTemplate = {
  change_classification: "internal_only",
  used_sources: ["classification_policy", "impact_checklist", "pr_checklist"],
  not_used_sources_with_reason: [
    {
      source: "baseline_rationale_template",
      reason: "No baseline update context in this minimal placeholder."
    }
  ],
  reference_summary:
    "List rule sources used in this change review and explain why some sources were not applicable."
};

export const RECOVERY_TRACE_CONSISTENCY_ALIGNMENT = {
  purpose: "final_manual_consistency_pass",
  does_not_replace: [
    "RECOVERY_DISPLAY_CHANGE_IMPACT_CHECKLIST_ITEMS",
    "RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE",
    "RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE",
    "RECOVERY_REVIEW_TRACE_TEMPLATE",
    "RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE",
    "RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE"
  ],
  checklist_item_links: {
    classification_declared: [
      "RECOVERY_ADAPTER_CHANGE_CLASSIFICATIONS",
      "RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY"
    ],
    warning_template_checked: ["RECOVERY_SHARED_CORE_FIELD_CHANGE_WARNING_TEMPLATE"],
    impact_checklist_checked: ["RECOVERY_DISPLAY_CHANGE_IMPACT_CHECKLIST_ITEMS"],
    pr_checklist_completed: ["docs/15-recovery-display-pr-checklist-template.md"],
    baseline_reason_filled_or_not_required_explained: [
      "RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE",
      "RECOVERY_DTO_BASELINE_UPDATE_REASON_EXAMPLES"
    ],
    review_trace_filled_or_cadence_explained: [
      "RECOVERY_REVIEW_TRACE_TEMPLATE",
      "RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE"
    ],
    baseline_history_archived_or_cadence_explained: [
      "RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE",
      "RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE"
    ],
    docs_synced: [
      "docs/18-recovery-adapter-review-hints-and-baseline-rationale-examples.md",
      "docs/19-recovery-baseline-history-and-review-trace-semantics.md",
      "docs/20-recovery-review-trace-and-baseline-history-cadence-semantics.md"
    ],
    view_version_bump_decision_recorded: [
      "RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY",
      "RECOVERY_DTO_BASELINE_UPDATE_RULES"
    ],
    rehearsal_and_baseline_tests_updated_or_not_required_explained: [
      "RECOVERY_DTO_BASELINE_UPDATE_RULES",
      "packages/application/src/recovery-display-adapter.test.ts"
    ]
  }
} as const;

export const RECOVERY_TRACE_DOCUMENT_REFERENCE_ALIGNMENT = {
  purpose: "reference_source_convergence",
  does_not_replace: [
    "RECOVERY_TRACE_CONSISTENCY_CHECKLIST",
    "RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE",
    "RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE",
    "RECOVERY_REVIEW_TRACE_TEMPLATE"
  ],
  source_to_rule_or_doc: {
    classification_policy: "RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY",
    warning_template: "RECOVERY_SHARED_CORE_FIELD_CHANGE_WARNING_TEMPLATE",
    impact_checklist: "RECOVERY_DISPLAY_CHANGE_IMPACT_CHECKLIST_ITEMS",
    pr_checklist: "docs/15-recovery-display-pr-checklist-template.md",
    baseline_rationale_template: "RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE",
    review_hints: "RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS",
    cadence_guidance:
      "RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE + RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE",
    baseline_history_and_review_trace_docs:
      "docs/19-recovery-baseline-history-and-review-trace-semantics.md + docs/20-recovery-review-trace-and-baseline-history-cadence-semantics.md + docs/21-recovery-trace-consistency-checklist-and-document-reference-semantics.md"
  }
} as const;

export const RECOVERY_TRACE_CONSISTENCY_CHECKLIST_EXAMPLES = {
  non_breaking_external: {
    classification_declared: true,
    warning_template_checked: true,
    impact_checklist_checked: true,
    pr_checklist_completed: true,
    baseline_reason_filled_or_not_required_explained: true,
    review_trace_filled_or_cadence_explained: true,
    baseline_history_archived_or_cadence_explained: true,
    docs_synced: true,
    view_version_bump_decision_recorded: true,
    rehearsal_and_baseline_tests_updated_or_not_required_explained: true,
    consistency_summary:
      "non_breaking_external: trace/history both recorded with rationale, tests and docs aligned."
  },
  breaking_external_theoretical: {
    classification_declared: true,
    warning_template_checked: true,
    impact_checklist_checked: true,
    pr_checklist_completed: true,
    baseline_reason_filled_or_not_required_explained: true,
    review_trace_filled_or_cadence_explained: true,
    baseline_history_archived_or_cadence_explained: true,
    docs_synced: true,
    view_version_bump_decision_recorded: true,
    rehearsal_and_baseline_tests_updated_or_not_required_explained: true,
    consistency_summary:
      "breaking_external theoretical: restricted_high_risk flagged and treated as escalation/rejection candidate in Phase 1."
  }
} as const;

export const RECOVERY_TRACE_DOCUMENT_REFERENCE_EXAMPLES = {
  internal_only: {
    change_classification: "internal_only",
    used_sources: ["classification_policy", "impact_checklist", "pr_checklist", "cadence_guidance"],
    not_used_sources_with_reason: [
      {
        source: "baseline_rationale_template",
        reason: "No baseline update required for this internal-only change."
      },
      {
        source: "baseline_history_and_review_trace_docs",
        reason: "No baseline history archive triggered; cadence allows optional lightweight note."
      }
    ],
    reference_summary:
      "internal_only reference set kept minimal; documented why baseline rationale/history sources were not used."
  },
  breaking_external_theoretical: {
    change_classification: "breaking_external",
    used_sources: [
      "classification_policy",
      "warning_template",
      "impact_checklist",
      "pr_checklist",
      "baseline_rationale_template",
      "review_hints",
      "cadence_guidance",
      "baseline_history_and_review_trace_docs"
    ],
    not_used_sources_with_reason: [],
    reference_summary:
      "Theoretical restricted_high_risk case references all sources for escalation-level review evidence."
  }
} as const;

export const RECOVERY_TRACE_CLOSURE_MAINTENANCE_TRIGGERS = [
  "classification_policy_changed",
  "warning_template_changed",
  "impact_checklist_changed",
  "cadence_guidance_changed",
  "baseline_history_or_review_trace_fields_changed",
  "document_reference_source_options_changed",
  "rule_source_document_added",
  "shared_core_fields_changed"
] as const;

export type RecoveryTraceClosureMaintenanceTrigger =
  (typeof RECOVERY_TRACE_CLOSURE_MAINTENANCE_TRIGGERS)[number];

export type RecoveryTraceClosureMaintenanceTarget =
  | "trace_consistency_checklist"
  | "trace_document_reference_template"
  | "review_phrase_guidance";

export const RECOVERY_TRACE_CLOSURE_MAINTENANCE_GUIDANCE: {
  readonly purpose: "minimal_manual_closure_layer_maintenance";
  readonly required_trigger_checks: {
    readonly [K in RecoveryTraceClosureMaintenanceTrigger]: {
      readonly must_review_targets: readonly RecoveryTraceClosureMaintenanceTarget[];
      readonly why: string;
      readonly related_rules: readonly string[];
    };
  };
  readonly does_not_replace: readonly string[];
} = {
  purpose: "minimal_manual_closure_layer_maintenance",
  required_trigger_checks: {
    classification_policy_changed: {
      must_review_targets: [
        "trace_consistency_checklist",
        "trace_document_reference_template",
        "review_phrase_guidance"
      ],
      why:
        "Classification changes can invalidate closure checklist wording, document references, and phrase examples.",
      related_rules: [
        "RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY",
        "RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS",
        "RECOVERY_TRACE_CONSISTENCY_CHECKLIST"
      ]
    },
    warning_template_changed: {
      must_review_targets: ["trace_consistency_checklist", "trace_document_reference_template"],
      why: "Warning focus changed and may require updated final consistency checks and referenced sources.",
      related_rules: [
        "RECOVERY_SHARED_CORE_FIELD_CHANGE_WARNING_TEMPLATE",
        "RECOVERY_WARNING_TO_IMPACT_CHECKLIST_ALIGNMENT"
      ]
    },
    impact_checklist_changed: {
      must_review_targets: ["trace_consistency_checklist", "review_phrase_guidance"],
      why: "Impact checklist deltas can change closure item wording and phrase guidance references.",
      related_rules: [
        "RECOVERY_DISPLAY_CHANGE_IMPACT_CHECKLIST_ITEMS",
        "createRecoveryDisplayChangeImpactChecklistTemplate()"
      ]
    },
    cadence_guidance_changed: {
      must_review_targets: [
        "trace_consistency_checklist",
        "trace_document_reference_template",
        "review_phrase_guidance"
      ],
      why: "Cadence updates affect whether trace/history are required and how skip rationale should be phrased.",
      related_rules: [
        "RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE",
        "RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE"
      ]
    },
    baseline_history_or_review_trace_fields_changed: {
      must_review_targets: ["trace_consistency_checklist", "trace_document_reference_template"],
      why:
        "Field changes can invalidate closure checks and source references tied to baseline history or review trace.",
      related_rules: [
        "RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE",
        "RECOVERY_REVIEW_TRACE_TEMPLATE",
        "RECOVERY_DTO_BASELINE_HISTORY_TO_REASON_ALIGNMENT"
      ]
    },
    document_reference_source_options_changed: {
      must_review_targets: ["trace_document_reference_template", "review_phrase_guidance"],
      why: "Reference source set changes require synchronized template options and unused-source phrasing.",
      related_rules: [
        "RECOVERY_TRACE_DOCUMENT_REFERENCE_SOURCE_OPTIONS",
        "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE"
      ]
    },
    rule_source_document_added: {
      must_review_targets: ["trace_document_reference_template", "trace_consistency_checklist"],
      why:
        "When a new rule source document appears, verify whether source options and docs_synced checks must include it.",
      related_rules: [
        "RECOVERY_TRACE_DOCUMENT_REFERENCE_SOURCE_OPTIONS",
        "RECOVERY_TRACE_CONSISTENCY_ALIGNMENT"
      ]
    },
    shared_core_fields_changed: {
      must_review_targets: ["trace_consistency_checklist", "review_phrase_guidance"],
      why:
        "Shared core field shifts may change review attention and require updated baseline/viewVersion explanation phrases.",
      related_rules: [
        "RECOVERY_EXTERNAL_SHARED_CORE_FIELDS",
        "RECOVERY_SHARED_CORE_FIELD_CHANGE_WARNING_TEMPLATE"
      ]
    }
  },
  does_not_replace: [
    "RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY",
    "RECOVERY_DISPLAY_CHANGE_IMPACT_CHECKLIST_ITEMS",
    "RECOVERY_DTO_BASELINE_UPDATE_RULES",
    "RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS"
  ]
};

export const RECOVERY_REVIEW_PHRASE_GUIDANCE = {
  baseline_not_updated:
    "No baseline update is required because no external DTO/shared core field semantics changed.",
  view_version_not_bumped:
    "No viewVersion bump is required because compatibility remains additive and semantic meaning is unchanged.",
  classification_internal_only:
    "Classified as internal_only because external DTO exposure is unchanged and shared core fields are untouched.",
  classification_non_breaking_external:
    "Classified as non_breaking_external because external DTO changed in a compatible additive/defaulted way.",
  classification_breaking_external_restricted:
    "Classified as breaking_external with restricted_high_risk in Phase 1; escalation or rejection is expected.",
  unused_source_with_reason:
    "Source '<source>' was not used because '<reason>', and this is explicitly recorded.",
  cadence_optional_skip_explanation:
    "By cadence this trace/history update is optional; rationale for skipping is explicitly documented."
} as const;

export const RECOVERY_REVIEW_PHRASE_GUIDANCE_ALIGNMENT = {
  serves_templates: [
    "docs/15-recovery-display-pr-checklist-template.md",
    "RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS",
    "RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE",
    "RECOVERY_REVIEW_TRACE_TEMPLATE",
    "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE"
  ],
  does_not_replace: [
    "RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS",
    "RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE",
    "RECOVERY_REVIEW_TRACE_TEMPLATE",
    "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE"
  ],
  intent: "reduce_description_variance_without_changing_decision_logic"
} as const;

export const RECOVERY_REVIEW_PHRASE_EXAMPLES = {
  non_breaking_external: {
    classification_sentence:
      "Classified as non_breaking_external because external DTO changed additively with default compatibility.",
    baseline_sentence:
      "No baseline update is required because no shared core field semantic change occurred in this revision.",
    view_version_sentence:
      "No viewVersion bump is required because compatibility remains additive and semantic meaning is unchanged."
  },
  unused_source_reason: {
    source: "warning_template",
    sentence:
      "Source 'warning_template' was not used because this internal_only change did not touch shared core review focus.",
    note: "Unused source rationale recorded in document reference template."
  },
  breaking_external_theoretical: {
    sentence:
      "Classified as breaking_external with restricted_high_risk in Phase 1; this is treated as escalation or rejection candidate."
  }
} as const;

export const RECOVERY_TRACE_CLOSURE_REVIEW_CADENCE_GUIDANCE = {
  purpose: "manual_closure_layer_health_review_cadence",
  suggested_review_when: [
    "after_multiple_adapter_or_display_related_changes",
    "after_classification_or_cadence_or_warning_or_impact_rule_change",
    "after_new_rule_source_document_or_new_template_layer_added"
  ],
  trigger_details: {
    after_multiple_adapter_or_display_related_changes:
      "When several adapter/display changes accumulate, run one manual closure health review to confirm phrasing and references stay aligned.",
    after_classification_or_cadence_or_warning_or_impact_rule_change:
      "If classification/cadence/warning/impact rules change, run closure review once to verify consistency checklist and references remain current.",
    after_new_rule_source_document_or_new_template_layer_added:
      "When new rule source docs or template layers are added, review closure layer scope and source options for drift."
  },
  related_assets: [
    "RECOVERY_TRACE_CONSISTENCY_CHECKLIST",
    "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE",
    "RECOVERY_REVIEW_PHRASE_GUIDANCE",
    "RECOVERY_TRACE_CLOSURE_MAINTENANCE_GUIDANCE"
  ],
  execution_note:
    "This is guidance cadence only; no calendar, reminder, or workflow automation is introduced in Phase 1."
} as const;

export const RECOVERY_TERMINOLOGY_DRIFT_SIGNAL_KEYS = [
  "classification_phrase_divergence",
  "baseline_not_updated_phrase_divergence",
  "view_version_not_bumped_phrase_divergence",
  "unused_source_reason_granularity_split",
  "breaking_external_restricted_phrase_softening",
  "cadence_level_term_replacement"
] as const;

export type RecoveryTerminologyDriftSignalKey =
  (typeof RECOVERY_TERMINOLOGY_DRIFT_SIGNAL_KEYS)[number];

export const RECOVERY_TERMINOLOGY_DRIFT_SIGNALS: {
  readonly [K in RecoveryTerminologyDriftSignalKey]: {
    readonly watch_for: string;
    readonly aligned_phrase_key:
      | keyof typeof RECOVERY_REVIEW_PHRASE_GUIDANCE
      | "cadence_levels";
    readonly affected_assets: readonly string[];
  };
} = {
  classification_phrase_divergence: {
    watch_for: "Same classification appears with multiple inconsistent phrasings across PRs.",
    aligned_phrase_key: "classification_internal_only",
    affected_assets: ["RECOVERY_REVIEW_PHRASE_GUIDANCE", "RECOVERY_TRACE_CONSISTENCY_CHECKLIST"]
  },
  baseline_not_updated_phrase_divergence: {
    watch_for: "Inconsistent wording emerges for why baseline update is not required.",
    aligned_phrase_key: "baseline_not_updated",
    affected_assets: [
      "RECOVERY_REVIEW_PHRASE_GUIDANCE",
      "RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE"
    ]
  },
  view_version_not_bumped_phrase_divergence: {
    watch_for: "Inconsistent wording emerges for why viewVersion bump is not required.",
    aligned_phrase_key: "view_version_not_bumped",
    affected_assets: ["RECOVERY_REVIEW_PHRASE_GUIDANCE", "RECOVERY_DTO_BASELINE_UPDATE_RULES"]
  },
  unused_source_reason_granularity_split: {
    watch_for:
      "Unused-source reasons vary in granularity, making document reference rationale hard to compare.",
    aligned_phrase_key: "unused_source_with_reason",
    affected_assets: [
      "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE",
      "RECOVERY_TRACE_DOCUMENT_REFERENCE_EXAMPLES"
    ]
  },
  breaking_external_restricted_phrase_softening: {
    watch_for: "restricted_high_risk wording is weakened or omitted for breaking_external cases.",
    aligned_phrase_key: "classification_breaking_external_restricted",
    affected_assets: [
      "RECOVERY_REVIEW_PHRASE_GUIDANCE",
      "RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY"
    ]
  },
  cadence_level_term_replacement: {
    watch_for: "required/recommended/optional are replaced by undefined alternative terms.",
    aligned_phrase_key: "cadence_levels",
    affected_assets: ["RECOVERY_CADENCE_LEVELS", "RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE"]
  }
};

export const RECOVERY_TRACE_CLOSURE_RETROSPECTIVE_CHECKLIST_ITEMS = [
  "phrase_guidance_matches_actual_writing",
  "consistency_checklist_still_covers_key_gates",
  "document_reference_sources_still_current",
  "baseline_history_and_review_trace_examples_still_representative",
  "classification_hints_and_cadence_still_aligned",
  "terminology_drift_signals_reviewed"
] as const;

export type RecoveryTraceClosureRetrospectiveChecklistItem =
  (typeof RECOVERY_TRACE_CLOSURE_RETROSPECTIVE_CHECKLIST_ITEMS)[number];

export type RecoveryTraceClosureRetrospectiveChecklist = {
  readonly phrase_guidance_matches_actual_writing: boolean;
  readonly consistency_checklist_still_covers_key_gates: boolean;
  readonly document_reference_sources_still_current: boolean;
  readonly baseline_history_and_review_trace_examples_still_representative: boolean;
  readonly classification_hints_and_cadence_still_aligned: boolean;
  readonly terminology_drift_signals_reviewed: boolean;
  readonly retrospective_summary: string;
};

export const RECOVERY_TRACE_CLOSURE_RETROSPECTIVE_CHECKLIST: RecoveryTraceClosureRetrospectiveChecklist =
  {
    phrase_guidance_matches_actual_writing: false,
    consistency_checklist_still_covers_key_gates: false,
    document_reference_sources_still_current: false,
    baseline_history_and_review_trace_examples_still_representative: false,
    classification_hints_and_cadence_still_aligned: false,
    terminology_drift_signals_reviewed: false,
    retrospective_summary: "Record retrospective outcome and terminology drift observations."
  };

export const RECOVERY_TRACE_REVIEW_CADENCE_AND_MAINTENANCE_RELATION = {
  maintenance_guidance_answers: "when_to_update_closure_templates",
  review_cadence_answers: "when_to_review_overall_closure_layer_health",
  relation: "related_but_not_equivalent",
  does_not_replace_each_other: true
} as const;

export const RECOVERY_TRACE_CLOSURE_REVIEW_EXAMPLES = {
  rule_change_triggered_review: {
    trigger: "classification_or_cadence_rule_changed",
    action:
      "Run one closure health review, re-check consistency checklist coverage, and verify document reference source options.",
    note: "This is a manual review trigger, not a workflow automation event."
  },
  terminology_drift_triggered_retrospective: {
    trigger: "baseline_or_viewVersion_phrase_divergence_observed",
    action:
      "Run retrospective checklist and re-align wording to RECOVERY_REVIEW_PHRASE_GUIDANCE before next PR batch.",
    note: "Keep rationale logic unchanged; only normalize phrase usage."
  },
  breaking_external_theoretical: {
    trigger: "restricted_high_risk_wording_softened",
    action:
      "Treat as terminology drift and restore restricted_high_risk phrasing in review evidence and references."
  }
} as const;

export const RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE = {
  retrospective_scope: "Describe the reviewed closure assets and recent change window.",
  signals_observed: [] as readonly RecoveryTerminologyDriftSignalKey[],
  consistency_status: "consistent | minor_drift_observed | drift_requires_template_update",
  actions_recommended: ["Record concise recommended actions based on observed signals."],
  template_updates_needed: ["none | phrase_guidance | consistency_checklist | document_reference_template"],
  follow_up_needed: false,
  notes: "Capture conclusion notes and unresolved concerns."
} as const;

export type RecoveryDriftSignalResponsePhraseKey =
  | "minor_drift_no_template_update"
  | "multi_drift_update_phrase_guidance"
  | "outdated_reference_sources_update_options"
  | "checklist_gap_update_consistency_checklist"
  | "classification_hints_cadence_inconsistent_trigger_linked_check"
  | "breaking_external_restricted_phrase_softened_restore_immediately";

export const RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES: {
  readonly [K in RecoveryDriftSignalResponsePhraseKey]: string;
} = {
  minor_drift_no_template_update:
    "Minor terminology drift observed; no template update is required now, but wording will be normalized in upcoming reviews.",
  multi_drift_update_phrase_guidance:
    "Multiple terminology drifts were observed; update RECOVERY_REVIEW_PHRASE_GUIDANCE to restore consistent wording.",
  outdated_reference_sources_update_options:
    "Document reference sources appear outdated; update RECOVERY_TRACE_DOCUMENT_REFERENCE_SOURCE_OPTIONS and related examples.",
  checklist_gap_update_consistency_checklist:
    "Current mainstream scenario is not fully covered; update RECOVERY_TRACE_CONSISTENCY_CHECKLIST to close the gap.",
  classification_hints_cadence_inconsistent_trigger_linked_check:
    "Classification, review hints, and cadence wording diverged; trigger one linked template consistency review.",
  breaking_external_restricted_phrase_softened_restore_immediately:
    "restricted_high_risk wording was softened for breaking_external; restore the standard phrase immediately and add review trace clarification."
};

export const RECOVERY_RETROSPECTIVE_OUTCOME_AND_RESPONSE_ALIGNMENT = {
  outcome_references_checklist: "RECOVERY_TRACE_CLOSURE_RETROSPECTIVE_CHECKLIST",
  response_references_drift_signals: "RECOVERY_TERMINOLOGY_DRIFT_SIGNALS",
  template_updates_needed_links: [
    "RECOVERY_TRACE_CLOSURE_MAINTENANCE_GUIDANCE",
    "RECOVERY_TRACE_CLOSURE_REVIEW_CADENCE_GUIDANCE"
  ],
  follow_up_links: [
    "RECOVERY_REVIEW_TRACE_TEMPLATE",
    "RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE",
    "RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE",
    "RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE"
  ],
  does_not_replace: [
    "RECOVERY_TRACE_CLOSURE_RETROSPECTIVE_CHECKLIST",
    "RECOVERY_TERMINOLOGY_DRIFT_SIGNALS",
    "RECOVERY_REVIEW_PHRASE_GUIDANCE"
  ]
} as const;

export const RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_EXAMPLES = {
  minor_drift_no_template_update: {
    retrospective_scope: "Recent non_breaking_external review records.",
    signals_observed: ["baseline_not_updated_phrase_divergence"],
    consistency_status: "minor_drift_observed",
    actions_recommended: [
      "Normalize baseline-not-updated wording in upcoming PR descriptions."
    ],
    template_updates_needed: ["none"],
    follow_up_needed: false,
    notes: "Drift is minor and currently handled through phrase usage reminders."
  },
  breaking_external_theoretical: {
    retrospective_scope: "Theoretical restricted-high-risk wording review.",
    signals_observed: ["breaking_external_restricted_phrase_softening"],
    consistency_status: "drift_requires_template_update",
    actions_recommended: [
      "Restore restricted_high_risk phrase immediately and reinforce review trace rationale."
    ],
    template_updates_needed: ["phrase_guidance", "consistency_checklist"],
    follow_up_needed: true,
    notes: "Phase 1 restricted semantics must remain explicit."
  }
} as const;

export const RECOVERY_DRIFT_SIGNAL_RESPONSE_EXAMPLES = {
  outdated_document_reference_sources: {
    signal: "unused_source_reason_granularity_split",
    phrase:
      "Document reference sources appear outdated; update RECOVERY_TRACE_DOCUMENT_REFERENCE_SOURCE_OPTIONS and related examples.",
    template_updates_needed: ["document_reference_template"],
    follow_up_note: "Refresh source options and keep unused-source rationale wording aligned."
  },
  breaking_external_theoretical: {
    signal: "breaking_external_restricted_phrase_softening",
    phrase:
      "restricted_high_risk wording was softened for breaking_external; restore the standard phrase immediately and add review trace clarification."
  }
} as const;

export const RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE = {
  retrospective_id: "retro-YYYYMMDD-001",
  retrospective_scope: "Summarize reviewed scope for this retrospective outcome.",
  change_window_summary: "Describe the recent change window in one sentence.",
  signals_observed_count: 0,
  consistency_status: "consistent | minor_drift_observed | drift_requires_template_update",
  template_updates_needed: ["none | phrase_guidance | consistency_checklist | document_reference_template"],
  follow_up_needed: false,
  archived_at: "YYYY-MM-DDTHH:mm:ss.sssZ",
  comparison_note: "Summarize whether this outcome differs from the previous retrospective."
} as const;

export const RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE = {
  previous_reference: "retro-previous-id",
  current_reference: "retro-current-id",
  signals_changed: false,
  consistency_changed: false,
  template_update_need_changed: false,
  follow_up_changed: false,
  notable_summary: "Summarize key differences between previous and current retrospective outcomes."
} as const;

export const RECOVERY_RETROSPECTIVE_COMPARISON_SEMANTICS = {
  signals_changed:
    "True when observed signal set/count differs from the previous retrospective outcome.",
  consistency_changed:
    "True when consistency_status differs from the previous retrospective outcome.",
  template_update_need_changed:
    "True when template_updates_needed differs from the previous retrospective outcome.",
  follow_up_changed:
    "True when follow_up_needed differs from the previous retrospective outcome.",
  judgement_mode: "manual_reporting_only"
} as const;

export const RECOVERY_RETROSPECTIVE_ARCHIVE_AND_COMPARISON_ALIGNMENT = {
  archive_based_on: "RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE",
  comparison_based_on: "retrospective_outcome_minimal_summary",
  links_to_checklist: "RECOVERY_TRACE_CLOSURE_RETROSPECTIVE_CHECKLIST",
  links_to_drift_signals: "RECOVERY_TERMINOLOGY_DRIFT_SIGNALS",
  links_to_maintenance_and_cadence: [
    "RECOVERY_TRACE_CLOSURE_MAINTENANCE_GUIDANCE",
    "RECOVERY_TRACE_CLOSURE_REVIEW_CADENCE_GUIDANCE"
  ],
  links_to_follow_up_templates: [
    "RECOVERY_REVIEW_TRACE_TEMPLATE",
    "RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE"
  ],
  does_not_replace: [
    "RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE",
    "RECOVERY_TRACE_CLOSURE_RETROSPECTIVE_CHECKLIST"
  ],
  decision_logic_source: "existing_retrospective_judgement_only"
} as const;

export const RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_EXAMPLES = {
  no_significant_change: {
    retrospective_id: "retro-20260327-001",
    retrospective_scope: "Review phrase guidance and document reference usage consistency.",
    change_window_summary: "Two non_breaking_external updates with stable wording.",
    signals_observed_count: 1,
    consistency_status: "consistent",
    template_updates_needed: ["none"],
    follow_up_needed: false,
    archived_at: "2026-03-27T10:00:00.000Z",
    comparison_note: "No notable delta versus previous retrospective."
  },
  new_template_update_and_follow_up: {
    retrospective_id: "retro-20260328-002",
    retrospective_scope: "Review drift around outdated document reference source usage.",
    change_window_summary: "Observed source option mismatch in recent review records.",
    signals_observed_count: 2,
    consistency_status: "drift_requires_template_update",
    template_updates_needed: ["document_reference_template", "phrase_guidance"],
    follow_up_needed: true,
    archived_at: "2026-03-28T09:30:00.000Z",
    comparison_note: "Template update demand and follow-up requirement increased from previous cycle."
  },
  breaking_external_theoretical: {
    retrospective_id: "retro-20260328-003",
    retrospective_scope: "Theoretical restricted_high_risk wording consistency check.",
    change_window_summary: "breaking_external phrase softening was observed in one draft review.",
    signals_observed_count: 1,
    consistency_status: "drift_requires_template_update",
    template_updates_needed: ["phrase_guidance", "consistency_checklist"],
    follow_up_needed: true,
    archived_at: "2026-03-28T11:00:00.000Z",
    comparison_note: "restricted_high_risk phrase must be restored immediately."
  }
} as const;

export const RECOVERY_RETROSPECTIVE_COMPARISON_EXAMPLES = {
  no_significant_change: {
    previous_reference: "retro-20260327-000",
    current_reference: "retro-20260327-001",
    signals_changed: false,
    consistency_changed: false,
    template_update_need_changed: false,
    follow_up_changed: false,
    notable_summary: "No significant difference from previous retrospective."
  },
  new_update_need_and_follow_up: {
    previous_reference: "retro-20260327-001",
    current_reference: "retro-20260328-002",
    signals_changed: true,
    consistency_changed: true,
    template_update_need_changed: true,
    follow_up_changed: true,
    notable_summary: "New template update needs and follow-up were introduced."
  },
  breaking_external_theoretical: {
    previous_reference: "retro-20260328-002",
    current_reference: "retro-20260328-003",
    signals_changed: true,
    consistency_changed: false,
    template_update_need_changed: true,
    follow_up_changed: false,
    notable_summary: "restricted_high_risk wording risk remains explicitly tracked."
  }
} as const;

export type RecoveryRetrospectiveFieldStabilityTier =
  | "stable_core_fields"
  | "controlled_summary_fields"
  | "free_text_fields";

export const RECOVERY_RETROSPECTIVE_ARCHIVE_FIELD_STABILITY_POLICY = {
  stable_core_fields: [
    "retrospective_id",
    "retrospective_scope",
    "consistency_status",
    "template_updates_needed",
    "follow_up_needed",
    "archived_at",
    "signals_observed_count"
  ],
  controlled_summary_fields: ["change_window_summary", "comparison_note"],
  free_text_fields: [] as const,
  stable_core_change_sensitivity: "high_sensitive"
} as const;

export const RECOVERY_RETROSPECTIVE_COMPARISON_FIELD_STABILITY_POLICY = {
  stable_core_fields: [
    "previous_reference",
    "current_reference",
    "signals_changed",
    "consistency_changed",
    "template_update_need_changed",
    "follow_up_changed"
  ],
  controlled_summary_fields: ["notable_summary"],
  free_text_fields: [] as const,
  stable_core_change_sensitivity: "high_sensitive"
} as const;

export const RECOVERY_RETROSPECTIVE_CONTROLLED_SUMMARY_WRITING_GUIDANCE = {
  change_window_summary: {
    sentence_recommendation: "1-2_sentences",
    structure: "state_if_change_exists_then_state_what_changed",
    terminology_rule: "avoid_new_terms_use_existing_phrase_guidance",
    phrase_source_preference: [
      "RECOVERY_REVIEW_PHRASE_GUIDANCE",
      "RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES"
    ]
  },
  comparison_note: {
    sentence_recommendation: "1-2_sentences",
    structure: "state_if_significant_delta_exists_then_state_delta_briefly",
    terminology_rule: "avoid_new_terms_use_existing_phrase_guidance",
    phrase_source_preference: [
      "RECOVERY_REVIEW_PHRASE_GUIDANCE",
      "RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES"
    ]
  },
  notable_summary: {
    sentence_recommendation: "1-2_sentences",
    structure: "state_if_update_need_or_follow_up_changed_then_state_what_changed",
    terminology_rule: "avoid_new_terms_use_existing_phrase_guidance",
    phrase_source_preference: [
      "RECOVERY_REVIEW_PHRASE_GUIDANCE",
      "RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES"
    ]
  },
  avoid: [
    "long_narrative_paragraph",
    "undefined_judgement_terms",
    "new_unaligned_terminology"
  ]
} as const;

export const RECOVERY_RETROSPECTIVE_ARCHIVE_CHANGE_NOTE_TEMPLATE = {
  touched_fields: ["field_name_1", "field_name_2"],
  touched_stability_tier: "stable_core_fields | controlled_summary_fields | free_text_fields",
  affects_existing_examples: false,
  requires_docs_update: false,
  requires_tests_update: false,
  affects_manual_comparison_readability: false,
  note: "Summarize the archive/comparison template change in one to two short sentences."
} as const;

export const RECOVERY_RETROSPECTIVE_ARCHIVE_CHANGE_NOTE_ALIGNMENT = {
  field_stability_policy: [
    "RECOVERY_RETROSPECTIVE_ARCHIVE_FIELD_STABILITY_POLICY",
    "RECOVERY_RETROSPECTIVE_COMPARISON_FIELD_STABILITY_POLICY"
  ],
  controlled_summary_guidance: "RECOVERY_RETROSPECTIVE_CONTROLLED_SUMMARY_WRITING_GUIDANCE",
  related_templates: [
    "RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE",
    "RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE"
  ],
  related_phrase_sources: [
    "RECOVERY_REVIEW_PHRASE_GUIDANCE",
    "RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES"
  ],
  does_not_replace: [
    "RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE",
    "RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE",
    "RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE",
    "RECOVERY_TRACE_CLOSURE_RETROSPECTIVE_CHECKLIST"
  ]
} as const;

export const RECOVERY_RETROSPECTIVE_CONTROLLED_SUMMARY_EXAMPLES = {
  comparison_note_no_significant_change:
    "No significant delta is observed compared with the previous retrospective.",
  notable_summary_new_update_and_follow_up:
    "Template update need and follow-up requirement are newly introduced in this cycle.",
  breaking_external_theoretical:
    "restricted_high_risk wording remains explicit and no weakening is accepted."
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE = {
  suggested_review_when: [
    "field_stability_policy_changed",
    "controlled_summary_writing_guidance_changed",
    "phrase_guidance_or_drift_response_changed",
    "mainstream_scenario_not_covered_by_existing_examples"
  ],
  trigger_details: {
    field_stability_policy_changed:
      "When archive/comparison field stability tiers change, review example coverage and wording immediately.",
    controlled_summary_writing_guidance_changed:
      "When controlled summary writing rules change, review examples for sentence shape and terminology reuse.",
    phrase_guidance_or_drift_response_changed:
      "When phrase guidance or drift response phrases change, align examples to updated canonical wording.",
    mainstream_scenario_not_covered_by_existing_examples:
      "When new mainstream maintenance scenarios emerge, add one minimal example for direct reuse."
  },
  related_assets: [
    "RECOVERY_RETROSPECTIVE_ARCHIVE_FIELD_STABILITY_POLICY",
    "RECOVERY_RETROSPECTIVE_COMPARISON_FIELD_STABILITY_POLICY",
    "RECOVERY_RETROSPECTIVE_CONTROLLED_SUMMARY_WRITING_GUIDANCE",
    "RECOVERY_REVIEW_PHRASE_GUIDANCE",
    "RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES"
  ],
  execution_note:
    "This is a manual maintenance suggestion, not an automated reminder or content generation system."
} as const;

export type RecoveryRetrospectiveChangeNotePhraseKey =
  | "stable_core_untouched"
  | "controlled_summary_touched_core_semantics_unchanged"
  | "example_update_required"
  | "docs_update_required"
  | "tests_update_required"
  | "manual_comparison_readability_not_affected"
  | "manual_comparison_readability_affected_add_note"
  | "breaking_restricted_theoretical";

export const RECOVERY_RETROSPECTIVE_CHANGE_NOTE_PHRASES: {
  readonly [K in RecoveryRetrospectiveChangeNotePhraseKey]: string;
} = {
  stable_core_untouched: "No stable core fields are touched in this archive/comparison change.",
  controlled_summary_touched_core_semantics_unchanged:
    "Only controlled summary fields are touched; core semantics remain unchanged.",
  example_update_required:
    "Existing examples are insufficient for the current mainstream scenario; add one minimal example.",
  docs_update_required:
    "Documentation is updated to keep archive/comparison guidance and examples aligned.",
  tests_update_required:
    "Tests are updated to preserve archive/comparison template and wording consistency.",
  manual_comparison_readability_not_affected:
    "Manual comparison readability is not affected by this change.",
  manual_comparison_readability_affected_add_note:
    "Manual comparison readability is affected; add a concise clarification note.",
  breaking_restricted_theoretical:
    "Theoretical restricted_high_risk breaking scenario: keep explicit restricted wording and add trace note."
};

export const RECOVERY_RETROSPECTIVE_EXAMPLE_AND_CHANGE_NOTE_ALIGNMENT = {
  example_maintenance_does_not_replace: [
    "RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE",
    "RECOVERY_REVIEW_TRACE_TEMPLATE",
    "RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE"
  ],
  change_note_phrases_do_not_replace:
    "RECOVERY_RETROSPECTIVE_CONTROLLED_SUMMARY_WRITING_GUIDANCE",
  phrase_sources: [
    "RECOVERY_REVIEW_PHRASE_GUIDANCE",
    "RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES"
  ],
  template_alignment: "RECOVERY_RETROSPECTIVE_ARCHIVE_CHANGE_NOTE_TEMPLATE"
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_EXAMPLES = {
  controlled_summary_only_no_example_update: {
    trigger: "controlled_summary_writing_guidance_changed",
    decision: "no_example_update_needed",
    note: "Controlled summary wording stayed aligned; existing examples remain representative."
  },
  mainstream_scenario_requires_example_update: {
    trigger: "mainstream_scenario_not_covered_by_existing_examples",
    decision: "add_minimal_example",
    note: "A new mainstream archive/comparison scenario appeared and needs one reusable example."
  },
  breaking_external_theoretical: {
    trigger: "phrase_guidance_or_drift_response_changed",
    decision: "keep_restricted_wording_example",
    note: "Theoretical restricted_high_risk wording must remain explicit in maintained examples."
  }
} as const;

export const RECOVERY_RETROSPECTIVE_CHANGE_NOTE_PHRASE_EXAMPLES = {
  controlled_summary_only_no_example_update:
    "Only controlled summary fields are touched; core semantics remain unchanged. Existing examples remain sufficient.",
  mainstream_scenario_requires_example_update:
    "Existing examples are insufficient for the current mainstream scenario; add one minimal example.",
  breaking_external_theoretical:
    "Theoretical restricted_high_risk breaking scenario: keep explicit restricted wording and add trace note."
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_STATUSES = [
  "active",
  "historical_reference",
  "retired"
] as const;

export type RecoveryRetrospectiveExampleStatus =
  (typeof RECOVERY_RETROSPECTIVE_EXAMPLE_STATUSES)[number];

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_GUIDANCE = {
  lifecycle_focus: "retire_replace_or_keep_with_note",
  retire_or_replace_when: [
    "field_stability_change_makes_example_non_representative",
    "controlled_summary_guidance_change_makes_wording_non_recommended",
    "new_mainstream_example_replaces_old_primary_example"
  ],
  keep_as_historical_when: [
    "old_example_still_explains_context_but_is_not_preferred",
    "theoretical_or_restricted_example_needed_for_boundary_explanation"
  ],
  trigger_details: {
    field_stability_change_makes_example_non_representative:
      "If field stability policy changes and current example no longer reflects recommended structure, retire or replace it.",
    controlled_summary_guidance_change_makes_wording_non_recommended:
      "If controlled summary writing guidance changes and wording drifts from recommended phrasing, replace or label as historical.",
    new_mainstream_example_replaces_old_primary_example:
      "If a new mainstream scenario is better representative, keep old one as historical_reference or retire it with replacement note.",
    old_example_still_explains_context_but_is_not_preferred:
      "Keep as historical_reference with explicit non-preferred note.",
    theoretical_or_restricted_example_needed_for_boundary_explanation:
      "Keep theoretical/restricted examples with explicit note; do not introduce extra lifecycle status."
  },
  execution_note:
    "This is lifecycle guidance only, not an example repository platform or automated migration system."
} as const;

export const RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE = {
  example_status: "active | historical_reference | retired",
  reason: "Why this example stays active, becomes historical, or is retired.",
  recommended_replacement: "example_key_or_none",
  still_useful_for: "Where this example is still useful.",
  not_recommended_for: "Where this example should no longer be used."
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_ALIGNMENT = {
  lifecycle_does_not_replace: "RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE",
  lifecycle_answers: "whether_existing_example_should_remain_recommended",
  maintenance_answers: "when_examples_should_be_reviewed_for_update",
  related_assets: [
    "RECOVERY_RETROSPECTIVE_ARCHIVE_FIELD_STABILITY_POLICY",
    "RECOVERY_RETROSPECTIVE_COMPARISON_FIELD_STABILITY_POLICY",
    "RECOVERY_RETROSPECTIVE_CONTROLLED_SUMMARY_WRITING_GUIDANCE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE"
  ],
  theoretical_restricted_note_rule:
    "Use note-based theoretical/restricted marking without adding extra lifecycle status."
} as const;

export const RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_EXAMPLES = {
  historical_reference_example: {
    example_status: "historical_reference",
    reason: "This older wording helps explain past context but is no longer the preferred active phrasing.",
    recommended_replacement: "mainstream_scenario_requires_example_update",
    still_useful_for: "Understanding transition from older to current archive/comparison wording.",
    not_recommended_for: "Copying as current preferred writing in new change notes."
  },
  retired_example: {
    example_status: "retired",
    reason: "Field stability and controlled summary guidance changed, so this example no longer matches recommended writing.",
    recommended_replacement: "controlled_summary_only_no_example_update",
    still_useful_for: "Historical audit context only.",
    not_recommended_for: "Current archive/comparison explanation and change note writing."
  },
  breaking_external_theoretical: {
    example_status: "historical_reference",
    reason: "Theoretical restricted_high_risk example is kept only for boundary explanation.",
    recommended_replacement: "breaking_external_theoretical",
    still_useful_for: "Explaining restricted semantics in Phase 1.",
    not_recommended_for: "General active writing guidance."
  }
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_TEMPLATE = {
  from_status: "active | historical_reference | retired",
  to_status: "active | historical_reference | retired",
  reason: "State why lifecycle status changed.",
  recommended_replacement: "example_key_or_none",
  still_useful_for: "If applicable, where previous example remains useful.",
  review_after: "on_next_rule_or_phrase_or_mainstream_change",
  notes: "Add one to two short notes for lifecycle transition context."
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_REVIEW_CADENCE_GUIDANCE = {
  historical_reference_review_when: [
    "field_stability_or_controlled_summary_guidance_changed",
    "phrase_guidance_or_drift_response_changed",
    "mainstream_scenario_shifted"
  ],
  retired_review_when: [
    "recommended_replacement_changed",
    "restricted_or_theoretical_boundary_semantics_changed"
  ],
  active_review_source: "RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE",
  execution_note: "Manual review suggestion only; no reminder system or scheduler is introduced."
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_ALIGNMENT = {
  lifecycle_change_note_answers: "why_status_changed_now",
  historical_note_answers: "why_current_status_is_kept",
  lifecycle_change_note_does_not_replace: "RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE",
  lifecycle_review_cadence_does_not_replace: "RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE",
  related_assets: [
    "RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_GUIDANCE"
  ]
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS = {
  active_to_historical_reference: {
    guidance: "recommended_when_old_example_is_useful_for_context_but_not_preferred",
    allowed: true
  },
  active_to_retired: {
    guidance: "recommended_when_rule_or_writing_guidance_change_makes_example_non_representative",
    allowed: true
  },
  historical_reference_to_retired: {
    guidance: "recommended_when_example_no_longer_has_context_or_teaching_value",
    allowed: true
  },
  historical_reference_to_active: {
    guidance: "restricted_case_by_case_only_with_explicit_reason_and_alignment_review",
    allowed: true
  },
  retired_to_active: {
    guidance: "not_recommended_theoretical_only_with_explicit_reactivation_rationale",
    allowed: false
  }
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_EXAMPLES = {
  active_to_historical_reference: {
    from_status: "active",
    to_status: "historical_reference",
    reason: "A newer example better represents current mainstream writing while this one remains useful for transition context.",
    recommended_replacement: "mainstream_scenario_requires_example_update",
    still_useful_for: "Understanding previous wording choices during migration period.",
    review_after: "on_next_mainstream_scenario_shift",
    notes: "Historical reference only; no longer first-choice example."
  },
  historical_reference_to_retired: {
    from_status: "historical_reference",
    to_status: "retired",
    reason: "Field stability and phrase guidance updates made this historical example no longer useful for current maintenance.",
    recommended_replacement: "controlled_summary_only_no_example_update",
    still_useful_for: "Legacy context lookup only.",
    review_after: "on_replacement_change",
    notes: "Retired from recommended references."
  },
  retired_to_active_theoretical: {
    from_status: "retired",
    to_status: "active",
    reason:
      "Theoretical restricted_high_risk reactivation example; requires explicit rationale and is not recommended in normal maintenance.",
    recommended_replacement: "breaking_external_theoretical",
    still_useful_for: "Boundary explanation only.",
    review_after: "on_restricted_boundary_semantics_change",
    notes: "Theoretical-only path; avoid routine reuse."
  }
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASES = {
  transition_recommended: {
    active_to_historical_reference:
      "Move to historical_reference because a newer example is now preferred while this one still helps context explanation.",
    active_to_retired:
      "Move to retired because current rule or wording guidance changed and this example is no longer representative.",
    historical_reference_to_retired:
      "Move to retired because this historical example no longer provides sufficient context value."
  },
  transition_restricted: {
    historical_reference_to_active:
      "Restricted recovery to active is allowed case-by-case only with explicit reason and alignment review.",
    retired_to_active_theoretical:
      "Retired to active is theoretical restricted_high_risk and not recommended for normal lifecycle maintenance."
  },
  replacement_provided:
    "Replacement example is provided and should be used as the primary reference.",
  still_context_valuable: "This example still provides contextual explanation value.",
  not_preferred_primary: "This example is no longer recommended as primary writing guidance.",
  review_after_rule_or_phrase_change:
    "Review again after rule, phrase, or mainstream scenario changes."
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASE_ALIGNMENT = {
  serves_template: "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_TEMPLATE",
  field_alignment: {
    from_to_status: ["transition_recommended", "transition_restricted"],
    reason: ["transition_recommended", "transition_restricted"],
    recommended_replacement: ["replacement_provided"],
    still_useful_for: ["still_context_valuable"],
    review_after: ["review_after_rule_or_phrase_change"],
    notes: ["not_preferred_primary"]
  },
  does_not_replace: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_GUIDANCE",
    "RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE"
  ],
  purpose: "reduce_high_frequency_lifecycle_change_note_sentence_variance"
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_TEMPLATE = {
  assertion_slots: [
    "transition_pair_allowed",
    "reason_provided",
    "replacement_or_none_provided",
    "still_useful_for_or_notes_provided",
    "boundary_semantics_checked"
  ],
  transition_cases: {
    active_to_historical_reference: {
      from_status: "active",
      to_status: "historical_reference",
      boundary: "recommended"
    },
    active_to_retired: {
      from_status: "active",
      to_status: "retired",
      boundary: "recommended"
    },
    historical_reference_to_retired: {
      from_status: "historical_reference",
      to_status: "retired",
      boundary: "recommended"
    },
    historical_reference_to_active: {
      from_status: "historical_reference",
      to_status: "active",
      boundary: "restricted_allowed"
    },
    retired_to_active: {
      from_status: "retired",
      to_status: "active",
      boundary: "theoretical_not_recommended"
    }
  },
  assertion_notes: {
    replacement_rule: "Use recommended_replacement or explicit none.",
    reason_rule: "Reason must be explicitly written.",
    boundary_rule: "Restricted or not_recommended transitions must keep explicit boundary wording."
  },
  execution_note:
    "Regression assertion skeleton only; no automatic transition engine or lifecycle state machine."
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_ALIGNMENT = {
  source_semantics: "RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS",
  source_template: "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_TEMPLATE",
  role: "assert_existing_boundary_rules_in_reusable_example_checks",
  does_not_add_rules: "regression_template_reuses_existing_semantics_only"
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASE_EXAMPLES = {
  active_to_historical_reference_reuse: {
    from_status: "active",
    to_status: "historical_reference",
    reason_phrase:
      "Move to historical_reference because a newer example is now preferred while this one still helps context explanation.",
    replacement_phrase: "Replacement example is provided and should be used as the primary reference.",
    still_useful_phrase: "This example still provides contextual explanation value.",
    notes_phrase: "This example is no longer recommended as primary writing guidance.",
    review_after_phrase: "Review again after rule, phrase, or mainstream scenario changes."
  }
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_EXAMPLES = {
  historical_reference_to_retired_minimal: {
    transition_key: "historical_reference_to_retired",
    transition_pair_allowed: true,
    reason_provided: true,
    replacement_or_none_provided: true,
    still_useful_for_or_notes_provided: true,
    boundary_semantics_checked: true,
    boundary: "recommended"
  },
  retired_to_active_theoretical: {
    transition_key: "retired_to_active",
    transition_pair_allowed: true,
    reason_provided: true,
    replacement_or_none_provided: true,
    still_useful_for_or_notes_provided: true,
    boundary_semantics_checked: true,
    boundary: "theoretical_not_recommended"
  }
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST = {
  checks: [
    "from_status_and_to_status_explicit",
    "reason_provided",
    "recommended_replacement_or_none_explicit",
    "still_useful_for_or_notes_semantics_provided",
    "aligned_with_transition_semantics",
    "historical_note_reference_checked",
    "maintenance_guidance_reference_checked",
    "regression_example_update_need_checked",
    "restricted_or_theoretical_boundary_marked"
  ],
  execution_note:
    "Manual completion checklist only; reduce missing fields and cross-template misalignment."
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST_ALIGNMENT = {
  serves_templates: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_TEMPLATE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_TEMPLATE"
  ],
  reuses_existing_rules: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASE_ALIGNMENT",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_ALIGNMENT"
  ],
  does_not_replace: [
    "RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS"
  ],
  purpose: "reduce_fill_omission_and_lifecycle_template_alignment_gaps"
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE = {
  transition_key: "active_to_historical_reference | active_to_retired | historical_reference_to_retired",
  lifecycle_change_note_reference: "change_note_key_or_path",
  historical_note_reference: "historical_note_key_or_not_needed",
  maintenance_guidance_reference: "guidance_key_or_not_needed",
  regression_template_reference: "regression_case_key_or_not_needed",
  omitted_references_reason: "Explain why specific references are not required.",
  theoretical_or_restricted_boundary: "yes_or_no_with_short_reason"
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_ALIGNMENT = {
  local_scope: "lifecycle_template_family_only",
  local_scope_templates: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_TEMPLATE",
    "RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_TEMPLATE"
  ],
  does_not_replace_document_reference_template: "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE",
  broader_source_tracking_stays_in: [
    "RECOVERY_TRACE_DOCUMENT_REFERENCE_SOURCE_OPTIONS",
    "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE"
  ],
  purpose: "close_lifecycle_local_template_reference_gaps_without_expanding_scope"
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST_EXAMPLES = {
  active_to_historical_reference: {
    from_status: "active",
    to_status: "historical_reference",
    reason_provided: true,
    recommended_replacement_or_none_explicit: true,
    still_useful_for_or_notes_semantics_provided: true,
    aligned_with_transition_semantics: true,
    historical_note_reference_checked: true,
    maintenance_guidance_reference_checked: true,
    regression_example_update_need_checked: true,
    restricted_or_theoretical_boundary_marked: false
  },
  retired_to_active_theoretical: {
    from_status: "retired",
    to_status: "active",
    reason_provided: true,
    recommended_replacement_or_none_explicit: true,
    still_useful_for_or_notes_semantics_provided: true,
    aligned_with_transition_semantics: true,
    historical_note_reference_checked: true,
    maintenance_guidance_reference_checked: true,
    regression_example_update_need_checked: true,
    restricted_or_theoretical_boundary_marked: true
  }
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_EXAMPLES = {
  historical_reference_to_retired: {
    transition_key: "historical_reference_to_retired",
    lifecycle_change_note_reference: "historical_reference_to_retired",
    historical_note_reference: "retired_example",
    maintenance_guidance_reference: "RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE",
    regression_template_reference: "historical_reference_to_retired",
    omitted_references_reason: "All local lifecycle templates are referenced for traceability.",
    theoretical_or_restricted_boundary: "no"
  },
  retired_to_active_theoretical: {
    transition_key: "retired_to_active",
    lifecycle_change_note_reference: "retired_to_active_theoretical",
    historical_note_reference: "breaking_external_theoretical",
    maintenance_guidance_reference: "RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE",
    regression_template_reference: "retired_to_active",
    omitted_references_reason:
      "No omission; restricted theoretical path keeps all lifecycle references explicit.",
    theoretical_or_restricted_boundary: "yes_restricted_high_risk_theoretical_only"
  }
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_GUIDANCE = {
  review_focus: "lifecycle_checklist_and_cross_template_reference",
  suggested_review_when: [
    "lifecycle_transition_semantics_boundary_changed",
    "historical_note_template_semantics_changed",
    "maintenance_guidance_semantics_changed",
    "regression_template_semantics_changed",
    "repeated_semantics_same_but_field_style_divergence_feedback",
    "theoretical_or_restricted_boundary_wording_changed"
  ],
  execution_note:
    "Manual review cadence guidance only; this is not an automated reminder or workflow system."
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_ALIGNMENT = {
  scope_answers: "when_to_revisit_lifecycle_checklist_and_cross_template_reference",
  does_not_replace: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_REVIEW_CADENCE_GUIDANCE",
    "RECOVERY_TRACE_CLOSURE_REVIEW_CADENCE_GUIDANCE"
  ],
  related_assets: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS"
  ],
  purpose: "keep_lifecycle_closure_layers_reviewed_without_expanding_scope"
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES = {
  reason_too_generic: "Reason is too generic; specify what changed and why status changed now.",
  replacement_missing_or_none_not_explicit:
    "recommended_replacement is missing; provide replacement key or explicitly mark none.",
  still_useful_for_or_notes_too_empty:
    "still_useful_for/notes is too empty; add minimal context value or boundary note.",
  historical_note_reference_missing:
    "historical_note_reference appears required but is missing; add reference or explain not needed.",
  maintenance_guidance_reference_missing:
    "maintenance_guidance_reference appears required but is missing; add reference or explain not needed.",
  theoretical_or_restricted_boundary_missing:
    "Theoretical/restricted boundary is not explicit; add boundary wording directly.",
  omitted_references_reason_too_vague:
    "omitted_references_reason is too vague; state exactly which template was omitted and why.",
  lifecycle_phrase_not_reused:
    "Lifecycle wording is semantically valid but phrase reuse is weak; prefer existing lifecycle change note phrases."
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_ALIGNMENT = {
  aligned_with_checklist: "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST",
  aligned_with_cross_template_reference: "RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE",
  does_not_replace: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASES",
    "RECOVERY_REVIEW_PHRASE_GUIDANCE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_TEMPLATE"
  ],
  purpose: "highlight_filling_deviation_reminders_only"
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_EXAMPLES = {
  checklist_review_trigger: {
    trigger: "repeated_semantics_same_but_field_style_divergence_feedback",
    action:
      "Run a local review on lifecycle completion checklist and cross-template reference fields for phrasing consistency.",
    scope: "lifecycle_closure_layers_only"
  },
  theoretical_boundary_trigger: {
    trigger: "theoretical_or_restricted_boundary_wording_changed",
    action:
      "Recheck restricted/theoretical checklist and reference examples, especially retired_to_active_theoretical path.",
    scope: "restricted_theoretical_lifecycle_examples"
  }
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_EXAMPLES = {
  cross_template_reference_missing_historical_note: {
    transition_key: "historical_reference_to_retired",
    drift_phrase: "historical_note_reference appears required but is missing; add reference or explain not needed.",
    recommended_fix: "Set historical_note_reference to retired_example or explain not needed in omitted_references_reason."
  },
  retired_to_active_theoretical_boundary_missing: {
    transition_key: "retired_to_active",
    drift_phrase: "Theoretical/restricted boundary is not explicit; add boundary wording directly.",
    recommended_fix:
      "Add explicit restricted_high_risk theoretical wording in theoretical_or_restricted_boundary and related notes."
  }
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_TEMPLATE = {
  record_scope: "lifecycle_closure_layers_only",
  record_type: "cadence_review | filling_drift | mixed",
  trigger_reason: "Why this cadence/drift review was triggered.",
  signals_observed: "List concise observed signals.",
  impact_on_templates: "Which lifecycle templates are impacted.",
  follow_up_needed: "yes_or_no_with_short_reason",
  recommended_action: "One concise next action.",
  archived_note: "Short archive note for future manual lookup."
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_ALIGNMENT = {
  serves_assets: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_GUIDANCE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES"
  ],
  does_not_replace: [
    "RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE",
    "RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE",
    "RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST"
  ],
  purpose: "capture_small_cadence_drift_review_traces_in_lifecycle_closure_layers_only"
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DRIFT_EXAMPLE_REVIEW_GUIDANCE = {
  review_focus: "drift_phrase_reuse_examples",
  suggested_review_when: [
    "filling_drift_phrases_changed",
    "checklist_or_cross_template_fields_changed",
    "theoretical_or_restricted_boundary_wording_changed",
    "same_drift_intent_expressed_with_multiple_phrases"
  ],
  execution_note:
    "Manual example review guidance only; no automatic reminder or inspection system is introduced."
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_REVIEW_ALIGNMENT = {
  record_template_answers: "what_happened_in_this_cadence_or_drift_review",
  example_review_guidance_answers: "which_drift_reuse_examples_should_be_revisited",
  related_assets: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_GUIDANCE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_TEMPLATE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DRIFT_EXAMPLE_REVIEW_GUIDANCE"
  ],
  does_not_replace: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_GUIDANCE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES"
  ]
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_EXAMPLES = {
  cadence_review_record: {
    record_scope: "lifecycle_closure_layers_only",
    record_type: "cadence_review",
    trigger_reason: "lifecycle_transition_semantics_boundary_changed",
    signals_observed: "Checklist and cross-template references require boundary wording refresh.",
    impact_on_templates:
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST and RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE",
    follow_up_needed: "yes_update_local_examples",
    recommended_action: "Update lifecycle closure examples and keep wording aligned.",
    archived_note: "Local cadence review completed for lifecycle closure layers."
  },
  retired_to_active_mixed_record: {
    record_scope: "lifecycle_closure_layers_only",
    record_type: "mixed",
    trigger_reason: "theoretical_or_restricted_boundary_wording_changed",
    signals_observed: "retired_to_active theoretical wording drifted from restricted_high_risk phrase.",
    impact_on_templates:
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_EXAMPLES and related theoretical lifecycle notes",
    follow_up_needed: "yes_theoretical_boundary_recheck",
    recommended_action: "Reapply explicit restricted_high_risk wording in theoretical examples.",
    archived_note: "Theoretical path reviewed; regular lifecycle path remains unchanged."
  }
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DRIFT_EXAMPLE_REVIEW_EXAMPLES = {
  cross_template_reference_drift_trigger: {
    trigger: "checklist_or_cross_template_fields_changed",
    action: "Review drift example phrases for historical_note_reference and maintenance_guidance_reference.",
    scope: "cross_template_reference_examples"
  },
  retired_to_active_theoretical_trigger: {
    trigger: "theoretical_or_restricted_boundary_wording_changed",
    action: "Review retired_to_active theoretical drift example and keep restricted_high_risk wording explicit.",
    scope: "theoretical_restricted_examples"
  }
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_TEMPLATE =
  {
    classifications: {
      cadence_only: {
        applies_when: "Primary signal is cadence review refresh without major drift phrase rewrite.",
        recommended_record_type: "cadence_review",
        recommended_trigger_reason_style: "Use cadence trigger wording such as *_semantics_changed.",
        typically_impacts_templates: true,
        typically_follow_up_needed: false
      },
      drift_only: {
        applies_when: "Primary signal is filling drift phrase deviation while cadence boundaries stay stable.",
        recommended_record_type: "filling_drift",
        recommended_trigger_reason_style:
          "Use drift trigger wording such as same_drift_intent_expressed_with_multiple_phrases.",
        typically_impacts_templates: true,
        typically_follow_up_needed: true
      },
      mixed: {
        applies_when: "Cadence and drift signals both appear in one local lifecycle review.",
        recommended_record_type: "mixed",
        recommended_trigger_reason_style:
          "Use combined trigger wording that mentions both cadence boundary and phrase drift.",
        typically_impacts_templates: true,
        typically_follow_up_needed: true
      },
      theoretical_restricted: {
        applies_when: "Theoretical/restricted boundary wording requires explicit recheck in local lifecycle examples.",
        recommended_record_type: "mixed",
        recommended_trigger_reason_style:
          "Use explicit restricted_high_risk theoretical trigger wording in trigger_reason.",
        typically_impacts_templates: true,
        typically_follow_up_needed: true
      }
    },
    execution_note:
      "Classification short template only; not a classification engine or automated decision system."
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_ALIGNMENT =
  {
    step37_record_template_answers: "record_structure_for_single_cadence_or_drift_entry",
    classification_template_answers: "which_local_record_class_to_use_and_how_to_write_it",
    based_on_record_fields: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_TEMPLATE.record_type",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_TEMPLATE.trigger_reason"
    ],
    does_not_replace: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_GUIDANCE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES"
    ],
    purpose: "stabilize_minimal_record_classification_wording_for_manual_archival_entries"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH = {
  index_scope: "lifecycle_closure_layer_navigation_patch",
  entries: {
    lifecycle_change_note: {
      constants: ["RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_TEMPLATE"],
      docs: ["docs/29-recovery-example-lifecycle-change-note-and-review-cadence-semantics.md"]
    },
    lifecycle_review_cadence: {
      constants: ["RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_REVIEW_CADENCE_GUIDANCE"],
      docs: ["docs/29-recovery-example-lifecycle-change-note-and-review-cadence-semantics.md"]
    },
    lifecycle_phrases: {
      constants: [
        "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASES",
        "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES"
      ],
      docs: [
        "docs/30-recovery-example-lifecycle-change-note-phrases-and-regression-template-semantics.md",
        "docs/32-recovery-lifecycle-checklist-cross-reference-review-cadence-and-filling-drift-semantics.md"
      ]
    },
    regression_template: {
      constants: ["RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_TEMPLATE"],
      docs: ["docs/30-recovery-example-lifecycle-change-note-phrases-and-regression-template-semantics.md"]
    },
    lifecycle_completion_checklist: {
      constants: ["RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST"],
      docs: ["docs/31-recovery-lifecycle-completion-checklist-and-cross-template-reference-semantics.md"]
    },
    cross_template_reference: {
      constants: ["RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE"],
      docs: ["docs/31-recovery-lifecycle-completion-checklist-and-cross-template-reference-semantics.md"]
    },
    cadence_drift_record: {
      constants: [
        "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_TEMPLATE",
        "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_TEMPLATE"
      ],
      docs: ["docs/33-recovery-lifecycle-cadence-drift-record-and-example-review-semantics.md"]
    },
    drift_example_review_guidance: {
      constants: ["RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DRIFT_EXAMPLE_REVIEW_GUIDANCE"],
      docs: ["docs/33-recovery-lifecycle-cadence-drift-record-and-example-review-semantics.md"]
    },
    lifecycle_examples_and_theoretical_restricted: {
      constants: [
        "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASE_EXAMPLES",
        "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_EXAMPLES",
        "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_EXAMPLES",
        "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DRIFT_EXAMPLE_REVIEW_EXAMPLES"
      ],
      docs: [
        "docs/30-recovery-example-lifecycle-change-note-phrases-and-regression-template-semantics.md",
        "docs/32-recovery-lifecycle-checklist-cross-reference-review-cadence-and-filling-drift-semantics.md",
        "docs/33-recovery-lifecycle-cadence-drift-record-and-example-review-semantics.md"
      ]
    }
  },
  execution_note: "Minimal navigation patch only; not a knowledge base or automated index system."
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_ALIGNMENT = {
  document_reference_template_scope: "single_change_or_single_review_reference_trace",
  doc_index_patch_scope: "lifecycle_closure_layer_overview_navigation",
  does_not_replace_document_reference_template: "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE",
  related_assets: [
    "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH"
  ],
  purpose: "keep_local_lifecycle_assets_navigable_without_expanding_to_global_index_system"
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_EXAMPLES =
  {
    drift_only: {
      classification: "drift_only",
      recommended_record_type: "filling_drift",
      trigger_reason_style: "same_drift_intent_expressed_with_multiple_phrases",
      note: "Use when drift phrasing diverges but cadence boundaries are unchanged."
    },
    theoretical_restricted: {
      classification: "theoretical_restricted",
      recommended_record_type: "mixed",
      trigger_reason_style: "theoretical_or_restricted_boundary_wording_changed_restricted_high_risk",
      note: "Theoretical-only path; keep restricted_high_risk wording explicit."
    }
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_EXAMPLES = {
  minimal_reference: {
    focus: "drift_only_follow_up_navigation",
    start_entry: "cadence_drift_record",
    linked_entries: [
      "drift_example_review_guidance",
      "lifecycle_completion_checklist",
      "cross_template_reference"
    ],
    note: "Use this patch to quickly locate local lifecycle closure assets."
  }
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_CHECKLIST = {
  triggers: [
    "new_lifecycle_closure_template_or_constant_added",
    "lifecycle_docs_renamed_split_or_merged",
    "lifecycle_template_family_relationship_changed",
    "theoretical_or_restricted_example_location_changed",
    "indexed_item_becomes_historical_or_restricted_only"
  ],
  execution_note:
    "Manual index maintenance checklist only; not an automated index maintenance system."
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_ALIGNMENT = {
  step38_doc_index_patch_answers: "what_lifecycle_closure_assets_are_currently_indexed",
  maintenance_checklist_answers: "when_doc_index_patch_should_be_reviewed_or_updated",
  related_assets: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_ALIGNMENT"
  ],
  does_not_replace: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH",
    "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE"
  ],
  purpose: "stabilize_minimal_doc_index_maintenance_triggers_for_lifecycle_closure_navigation"
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASES = {
  cadence_only: {
    classification_summary:
      "Classify as cadence_only when cadence boundary refresh is primary and drift wording remains stable.",
    trigger_reason_phrase:
      "Use cadence trigger wording such as lifecycle_transition_semantics_boundary_changed.",
    impact_on_templates_phrase: "Template impact is usually present and should be explicitly listed.",
    follow_up_needed_phrase:
      "Follow-up is usually optional unless local lifecycle wording alignment still has open items."
  },
  drift_only: {
    classification_summary:
      "Classify as drift_only when drift phrasing divergence is primary and cadence boundary remains unchanged.",
    trigger_reason_phrase:
      "Use drift trigger wording such as same_drift_intent_expressed_with_multiple_phrases.",
    impact_on_templates_phrase: "Template impact is usually present for drift-related lifecycle examples.",
    follow_up_needed_phrase:
      "Follow-up is usually needed to converge phrase reuse across lifecycle drift examples."
  },
  mixed: {
    classification_summary:
      "Classify as mixed when cadence refresh and drift convergence are both required in one review.",
    trigger_reason_phrase:
      "Use combined trigger wording that includes cadence boundary and drift phrase signals.",
    impact_on_templates_phrase: "Template impact is usually present across checklist/reference and drift assets.",
    follow_up_needed_phrase:
      "Follow-up is usually needed to finish both cadence and drift alignment actions."
  },
  theoretical_restricted: {
    classification_summary:
      "Classify as theoretical_restricted for restricted_high_risk theoretical path wording maintenance.",
    trigger_reason_phrase:
      "Use explicit restricted_high_risk theoretical trigger wording in trigger_reason.",
    impact_on_templates_phrase: "Template impact is usually present in theoretical lifecycle example assets.",
    follow_up_needed_phrase:
      "Follow-up is usually needed until restricted_high_risk wording is explicitly restored."
  }
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASE_ALIGNMENT = {
  serves_template:
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_TEMPLATE",
  aligns_with_record_fields: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_TEMPLATE.record_type",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_TEMPLATE.trigger_reason"
  ],
  does_not_replace: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_TEMPLATE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES",
    "RECOVERY_REVIEW_PHRASE_GUIDANCE"
  ],
  purpose: "reduce_lifecycle_cadence_drift_record_classification_sentence_variance"
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_EXAMPLES = {
  doc_rename_trigger: {
    trigger: "lifecycle_docs_renamed_split_or_merged",
    action: "Review doc index patch entries and update docs paths for renamed lifecycle docs.",
    scope: "lifecycle_closure_navigation_patch"
  }
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASE_EXAMPLES = {
  mixed_reuse: {
    classification: "mixed",
    classification_summary:
      "Classify as mixed when cadence refresh and drift convergence are both required in one review.",
    trigger_reason_phrase:
      "Use combined trigger wording that includes cadence boundary and drift phrase signals.",
    impact_on_templates_phrase: "Template impact is usually present across checklist/reference and drift assets.",
    follow_up_needed_phrase:
      "Follow-up is usually needed to finish both cadence and drift alignment actions."
  },
  theoretical_restricted_reuse: {
    classification: "theoretical_restricted",
    classification_summary:
      "Classify as theoretical_restricted for restricted_high_risk theoretical path wording maintenance.",
    trigger_reason_phrase:
      "Use explicit restricted_high_risk theoretical trigger wording in trigger_reason.",
    impact_on_templates_phrase: "Template impact is usually present in theoretical lifecycle example assets.",
    follow_up_needed_phrase:
      "Follow-up is usually needed until restricted_high_risk wording is explicitly restored."
  }
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_TEMPLATE = {
  review_scope: "lifecycle_navigation_closure_layers_only",
  review_focus: "doc_index_maintenance | classification_phrases | mixed",
  signals_observed: "Concise navigation-related signals observed in this review.",
  consistency_status: "consistent | partially_diverged | needs_alignment",
  template_or_phrase_updates_needed: "List minimal template/phrase updates or none.",
  follow_up_needed: "yes_or_no_with_short_reason",
  review_note: "Short note for lifecycle navigation retrospective trace."
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_ALIGNMENT = {
  serves_assets: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_CHECKLIST",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASES"
  ],
  does_not_replace: [
    "RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_TEMPLATE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_TEMPLATE"
  ],
  purpose: "capture_small_navigation_layer_reviews_for_doc_index_and_classification_phrase_consistency"
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_GUIDANCE = {
  review_focus: "lifecycle_navigation_phrase_clarity_and_consistency",
  suggested_review_when: [
    "doc_index_navigation_phrase_clarity_degraded",
    "classification_phrases_no_longer_match_current_record_writing",
    "maintenance_checklist_trigger_wording_became_ambiguous",
    "theoretical_or_restricted_navigation_wording_weakened",
    "multiple_near_synonym_navigation_phrases_coexist"
  ],
  execution_note:
    "Manual retrospective guidance only; no automatic navigation checker or phrase scanner is introduced."
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_ALIGNMENT = {
  scope_answers: "whether_navigation_layer_wording_is_starting_to_diverge",
  does_not_replace: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_CHECKLIST",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH",
    "RECOVERY_REVIEW_PHRASE_GUIDANCE",
    "RECOVERY_TERMINOLOGY_DRIFT_SIGNALS"
  ],
  related_assets: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASES",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_CHECKLIST",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_GUIDANCE"
  ],
  purpose: "stabilize_navigation_phrase_retrospective_without_expanding_to_global_phrase_governance"
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_EXAMPLES = {
  doc_index_maintenance_review: {
    review_scope: "lifecycle_navigation_closure_layers_only",
    review_focus: "doc_index_maintenance",
    signals_observed: "Doc path rename detected; index entry wording remains mostly stable.",
    consistency_status: "partially_diverged",
    template_or_phrase_updates_needed: "Update lifecycle doc index entry paths and one navigation sentence.",
    follow_up_needed: "yes_confirm_updated_links_in_next_review",
    review_note: "Local navigation review recorded for doc index maintenance."
  },
  theoretical_restricted_navigation_review: {
    review_scope: "lifecycle_navigation_closure_layers_only",
    review_focus: "mixed",
    signals_observed: "restricted_high_risk wording became implicit in one theoretical navigation phrase.",
    consistency_status: "needs_alignment",
    template_or_phrase_updates_needed:
      "Restore explicit restricted_high_risk phrase in theoretical navigation entries.",
    follow_up_needed: "yes_recheck_theoretical_navigation_path",
    review_note: "Theoretical path only; non-theoretical navigation remains stable."
  }
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_EXAMPLES = {
  classification_phrases_review: {
    trigger: "classification_phrases_no_longer_match_current_record_writing",
    action: "Review mixed classification phrase set and align wording with current record examples.",
    scope: "classification_phrase_navigation_layer"
  },
  theoretical_restricted_phrase_review: {
    trigger: "theoretical_or_restricted_navigation_wording_weakened",
    action: "Reinstate explicit restricted_high_risk wording in navigation-related theoretical phrases.",
    scope: "theoretical_restricted_navigation_layer"
  }
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_TEMPLATE = {
  archive_id: "navigation_archive_entry_id",
  review_scope: "lifecycle_navigation_closure_layers_only",
  review_focus: "doc_index_maintenance | classification_phrases | mixed",
  signals_observed_count: 0,
  consistency_status: "consistent | partially_diverged | needs_alignment",
  template_or_phrase_updates_needed: "List minimal updates or none.",
  follow_up_needed: "yes_or_no_with_short_reason",
  archived_at: "ISO_8601_timestamp",
  archive_note: "Short note for navigation archive lookup."
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_ALIGNMENT = {
  step40_review_record_answers: "what_the_navigation_review_record_contains",
  archive_index_answers: "how_that_navigation_review_is_lightly_indexed_for_lookup",
  related_assets: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_TEMPLATE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_GUIDANCE"
  ],
  does_not_replace: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_TEMPLATE",
    "RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE",
    "RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE",
    "RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE"
  ],
  purpose: "provide_minimal_navigation_review_index_entries_without_expanding_to_archive_platform"
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_GUIDANCE =
  {
    review_focus: "navigation_phrase_example_convergence",
    suggested_review_when: [
      "navigation_phrase_retrospective_guidance_changed",
      "record_classification_phrases_changed",
      "doc_index_patch_entries_changed_affecting_navigation_wording",
      "theoretical_or_restricted_navigation_wording_changed",
      "same_navigation_intent_expressed_by_multiple_near_synonym_phrases"
    ],
    execution_note:
      "Manual example maintenance guidance only; no automatic reminder or inspection system is introduced."
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_ALIGNMENT =
  {
    scope_answers: "when_navigation_phrase_examples_themselves_should_be_revisited",
    related_assets: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_GUIDANCE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASES",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH"
    ],
    does_not_replace: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_GUIDANCE"
    ],
    purpose: "stabilize_navigation_phrase_example_maintenance_triggers_for_manual_review"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_EXAMPLES = {
  navigation_archive_entry: {
    archive_id: "nav-archive-2026-03-25-01",
    review_scope: "lifecycle_navigation_closure_layers_only",
    review_focus: "doc_index_maintenance",
    signals_observed_count: 2,
    consistency_status: "partially_diverged",
    template_or_phrase_updates_needed: "Update one doc index path and one classification navigation phrase.",
    follow_up_needed: "yes_validate_navigation_links_after_update",
    archived_at: "2026-03-25T10:00:00.000Z",
    archive_note: "Navigation archive entry for doc index path update."
  },
  theoretical_restricted_archive_entry: {
    archive_id: "nav-archive-2026-03-25-theoretical-01",
    review_scope: "lifecycle_navigation_closure_layers_only",
    review_focus: "mixed",
    signals_observed_count: 1,
    consistency_status: "needs_alignment",
    template_or_phrase_updates_needed:
      "Restore explicit restricted_high_risk wording in theoretical navigation examples.",
    follow_up_needed: "yes_recheck_theoretical_navigation_examples",
    archived_at: "2026-03-25T10:30:00.000Z",
    archive_note: "Theoretical-only navigation archive entry."
  }
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_EXAMPLES =
  {
    classification_phrase_change_trigger: {
      trigger: "record_classification_phrases_changed",
      action: "Review navigation phrase examples tied to mixed classification wording.",
      scope: "classification_phrase_navigation_examples"
    },
    theoretical_restricted_trigger: {
      trigger: "theoretical_or_restricted_navigation_wording_changed",
      action: "Review theoretical navigation phrase examples and restore restricted_high_risk wording.",
      scope: "theoretical_restricted_navigation_examples"
    }
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_GUIDANCE =
  {
    review_focus: "navigation_archive_index_update_timing",
    suggested_review_when: [
      "navigation_review_record_fields_or_semantics_changed",
      "navigation_phrase_retrospective_focus_changed",
      "archive_index_examples_not_covering_mainstream_navigation_review_scenarios",
      "theoretical_or_restricted_navigation_entry_semantics_changed"
    ],
    execution_note:
      "Manual cadence guidance only; this is not an automated reminder or maintenance scheduler."
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_ALIGNMENT =
  {
    scope_answers: "when_navigation_archive_index_itself_should_be_revisited",
    related_assets: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_GUIDANCE"
    ],
    does_not_replace: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_TEMPLATE",
      "RECOVERY_TRACE_CLOSURE_REVIEW_CADENCE_GUIDANCE"
    ],
    purpose: "stabilize_manual_archive_index_update_cadence_for_navigation_closure_layers"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES = {
  classification_phrases_changed:
    "Classification phrases changed; review related navigation examples for wording alignment.",
  doc_index_patch_changed:
    "Doc index patch entries changed; review navigation examples affected by updated index wording.",
  navigation_retrospective_guidance_changed:
    "Navigation phrase retrospective guidance changed; review navigation examples to keep focus alignment.",
  theoretical_restricted_changed:
    "Theoretical/restricted wording changed; review high-risk navigation examples and keep restricted_high_risk explicit.",
  near_synonym_drift_detected:
    "Multiple near-synonym navigation phrases exist; review examples and converge wording.",
  mainstream_scenario_not_covered:
    "Current examples do not cover mainstream navigation scenarios; add or refresh minimal examples."
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_ALIGNMENT = {
  serves_guidance:
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_GUIDANCE",
  aligned_with_triggers: [
    "navigation_phrase_retrospective_guidance_changed",
    "record_classification_phrases_changed",
    "doc_index_patch_entries_changed_affecting_navigation_wording",
    "theoretical_or_restricted_navigation_wording_changed",
    "same_navigation_intent_expressed_by_multiple_near_synonym_phrases"
  ],
  does_not_replace: [
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_GUIDANCE",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASES",
    "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH"
  ],
  purpose: "reduce_sentence_variance_for_navigation_example_maintenance_trigger_writing"
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_EXAMPLES =
  {
    archive_index_update_trigger: {
      trigger: "navigation_review_record_fields_or_semantics_changed",
      action: "Review archive index template and examples to keep field mapping current.",
      scope: "navigation_archive_index_assets"
    },
    theoretical_restricted_update_trigger: {
      trigger: "theoretical_or_restricted_navigation_entry_semantics_changed",
      action:
        "Review archive index examples tied to theoretical entries and keep restricted_high_risk wording explicit.",
      scope: "theoretical_restricted_archive_index_assets"
    }
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_EXAMPLES = {
  trigger_phrase_reuse: {
    trigger_key: "record_classification_phrases_changed",
    phrase:
      "Classification phrases changed; review related navigation examples for wording alignment.",
    note: "Use when mixed/cadence/drift classification wording is updated."
  },
  theoretical_restricted_trigger_phrase_reuse: {
    trigger_key: "theoretical_or_restricted_navigation_wording_changed",
    phrase:
      "Theoretical/restricted wording changed; review high-risk navigation examples and keep restricted_high_risk explicit.",
    note: "Theoretical-only path; keep restricted_high_risk explicit."
  }
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_TEMPLATE =
  {
    review_scope: "lifecycle_navigation_closure_layers_only",
    review_subject: "update_cadence | trigger_phrases | mixed",
    observed_variation: "What wording or trigger variation is observed in this review.",
    current_recommended_phrase_or_trigger: "Current preferred phrase or trigger reference.",
    reason_for_keep_or_adjust: "Why keep current wording or adjust it.",
    follow_up_needed: "yes_or_no_with_short_reason",
    note: "Short review note for navigation cadence/trigger maintenance."
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_ALIGNMENT =
  {
    serves_assets: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_GUIDANCE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES"
    ],
    does_not_replace: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_TEMPLATE",
      "RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE"
    ],
    purpose: "capture_small_navigation_cadence_trigger_review_notes_without_expanding_scope"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE =
  {
    previous_phrase_reference: "previous_phrase_key_or_reference",
    current_phrase_reference: "current_phrase_key_or_reference",
    meaning_changed: "yes_or_no",
    scope_changed: "yes_or_no",
    restricted_boundary_changed: "yes_or_no",
    comparison_note: "Short note on whether phrase change is meaningful."
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_ALIGNMENT =
  {
    serves_assets: ["RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES"],
    does_not_replace: [
      "RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE",
      "RECOVERY_REVIEW_PHRASE_GUIDANCE",
      "RECOVERY_TERMINOLOGY_DRIFT_SIGNALS"
    ],
    scope_answers: "whether_current_navigation_trigger_phrase_change_should_be_recorded",
    purpose: "provide_local_navigation_trigger_phrase_comparison_placeholder"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_EXAMPLES =
  {
    update_cadence_review: {
      review_scope: "lifecycle_navigation_closure_layers_only",
      review_subject: "update_cadence",
      observed_variation:
        "Archive index update cadence now references one additional mainstream scenario review trigger.",
      current_recommended_phrase_or_trigger:
        "archive_index_examples_not_covering_mainstream_navigation_review_scenarios",
      reason_for_keep_or_adjust: "Keep trigger and clarify example wording for consistent reuse.",
      follow_up_needed: "yes_refresh_one_navigation_cadence_example",
      note: "Local update cadence review note recorded."
    },
    theoretical_restricted_review: {
      review_scope: "lifecycle_navigation_closure_layers_only",
      review_subject: "mixed",
      observed_variation:
        "Theoretical trigger wording appears shortened and may hide restricted_high_risk intent.",
      current_recommended_phrase_or_trigger:
        "theoretical_or_restricted_navigation_entry_semantics_changed_restricted_high_risk",
      reason_for_keep_or_adjust: "Adjust phrase back to explicit restricted_high_risk wording.",
      follow_up_needed: "yes_recheck_theoretical_navigation_trigger_examples",
      note: "Theoretical-only review note."
    }
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLES =
  {
    trigger_phrase_comparison: {
      previous_phrase_reference: "doc_index_patch_changed_v1",
      current_phrase_reference: "doc_index_patch_changed",
      meaning_changed: "no",
      scope_changed: "no",
      restricted_boundary_changed: "no",
      comparison_note: "Wording tightened only; no semantic boundary change."
    },
    theoretical_restricted_comparison: {
      previous_phrase_reference: "theoretical_restricted_changed_short",
      current_phrase_reference: "theoretical_restricted_changed",
      meaning_changed: "yes",
      scope_changed: "no",
      restricted_boundary_changed: "yes",
      comparison_note: "Current phrase restores explicit restricted_high_risk boundary wording."
    }
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_CHECKLIST =
  {
    triggers: [
      "reason_for_keep_or_adjust_recommended_writing_changed",
      "comparison_note_recommended_writing_changed",
      "step42_trigger_phrases_changed",
      "step40_retrospective_guidance_focus_changed",
      "theoretical_or_restricted_boundary_wording_changed",
      "semantic_consistent_but_detail_level_diverged_feedback"
    ],
    execution_note:
      "Manual maintenance checklist only; this is not an automated reminder or governance system."
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_ALIGNMENT =
  {
    step43_templates_answer: "what_the_review_note_and_comparison_entry_structure_looks_like",
    maintenance_checklist_answers: "when_to_revisit_review_note_and_comparison_structures_and_examples",
    related_assets: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE"
    ],
    does_not_replace: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_GUIDANCE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES",
      "RECOVERY_REVIEW_PHRASE_GUIDANCE"
    ],
    purpose: "stabilize_manual_maintenance_triggers_for_navigation_review_note_and_phrase_comparison_layers"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASES = {
  meaning_unchanged:
    "Compared with previous phrase, core meaning remains unchanged and no semantic adjustment is required.",
  scope_unchanged:
    "Compared with previous phrase, scope remains unchanged and lifecycle navigation coverage is consistent.",
  restricted_boundary_unchanged:
    "Compared with previous phrase, restricted boundary remains unchanged and explicit risk marking is retained.",
  wording_converged_only:
    "Compared with previous phrase, this update is wording convergence only with no rule boundary change.",
  navigation_clarity_affected:
    "Compared with previous phrase, navigation clarity is affected and this change should be explicitly noted.",
  comparison_note_required:
    "Compared with previous phrase, add a concise comparison note to clarify why this wording is kept or adjusted.",
  theoretical_restricted_only:
    "Theoretical_restricted path only: keep restricted_high_risk semantics and do not relax boundary wording."
} as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASE_ALIGNMENT =
  {
    serves_template:
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE",
    aligns_with_template_fields: [
      "meaning_changed",
      "scope_changed",
      "restricted_boundary_changed",
      "comparison_note"
    ],
    does_not_replace: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES",
      "RECOVERY_REVIEW_PHRASE_GUIDANCE",
      "RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES"
    ],
    purpose: "reduce_sentence_variance_for_navigation_trigger_phrase_comparison_notes"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_EXAMPLES =
  {
    review_note_trigger: {
      trigger: "step40_retrospective_guidance_focus_changed",
      action: "Revisit review note examples to keep reason_for_keep_or_adjust writing aligned.",
      scope: "navigation_review_note_and_comparison_layers"
    }
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASE_EXAMPLES =
  {
    comparison_phrase_reuse: {
      scene: "wording_converged_only",
      phrase:
        "Compared with previous phrase, this update is wording convergence only with no rule boundary change.",
      note: "Use when phrase wording is polished but semantics are stable."
    },
    theoretical_restricted_phrase_reuse: {
      scene: "theoretical_restricted_only",
      phrase:
        "Theoretical_restricted path only: keep restricted_high_risk semantics and do not relax boundary wording.",
      note: "Theoretical-only path; never weaken restricted boundary wording."
    }
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_GUIDANCE =
  {
    review_focus: "navigation_review_note_and_phrase_comparison_example_refresh",
    suggested_review_when: [
      "maintenance_checklist_triggers_changed",
      "comparison_phrase_recommended_writing_changed",
      "step43_review_note_or_comparison_template_semantics_changed",
      "theoretical_or_restricted_boundary_wording_changed",
      "same_semantics_but_example_detail_level_diverged_feedback"
    ],
    execution_note:
      "Manual cadence guidance only; this is not an automated reminder or inspection system."
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_ALIGNMENT =
  {
    scope_answers: "when_review_note_and_comparison_examples_themselves_should_be_revisited",
    related_assets: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_CHECKLIST",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASES",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE"
    ],
    does_not_replace: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_CHECKLIST",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DRIFT_EXAMPLE_REVIEW_GUIDANCE"
    ],
    purpose: "stabilize_manual_example_review_cadence_for_navigation_review_note_and_comparison_layers"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_TEMPLATE =
  {
    example_id: "navigation_trigger_phrase_example_id",
    comparison_scope: "navigation_trigger_phrase_comparison_examples_only",
    phrase_category: "meaning | scope | restricted_boundary | clarity | note_required",
    historical_status: "active | historical_reference | retired",
    replacement_example: "example_id_or_none",
    archive_reason: "Why this comparison phrase example is archived or retained.",
    still_useful_for: "Where this archived example is still useful.",
    archived_note: "Short archive note for historical phrase example lookup."
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_ALIGNMENT =
  {
    serves_assets: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASES"
    ],
    step32_semantic_roots: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_STATUSES",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_GUIDANCE",
      "RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE"
    ],
    does_not_replace: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_GUIDANCE",
      "RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE"
    ],
    purpose: "provide_minimal_historical_retention_placeholder_for_navigation_comparison_phrase_examples"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_EXAMPLES =
  {
    maintenance_trigger_changed: {
      trigger: "maintenance_checklist_triggers_changed",
      action: "Review review-note/comparison examples and keep them aligned with latest maintenance checklist.",
      scope: "navigation_review_note_and_comparison_example_assets"
    },
    theoretical_restricted_trigger: {
      trigger: "theoretical_or_restricted_boundary_wording_changed",
      action:
        "Review theoretical comparison examples and keep restricted_high_risk wording explicit in retained examples.",
      scope: "theoretical_restricted_navigation_comparison_examples"
    }
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_EXAMPLES =
  {
    comparison_phrase_archive_entry: {
      example_id: "nav-trigger-comparison-example-001",
      comparison_scope: "navigation_trigger_phrase_comparison_examples_only",
      phrase_category: "clarity",
      historical_status: "historical_reference",
      replacement_example: "nav-trigger-comparison-example-002",
      archive_reason: "Wording updated for clearer navigation phrasing while old example remains useful for context.",
      still_useful_for: "Understanding why clarity-focused wording was tightened.",
      archived_note: "Historical reference only; not preferred for new comparison notes."
    },
    theoretical_restricted_archive_entry: {
      example_id: "nav-trigger-comparison-example-theoretical-001",
      comparison_scope: "navigation_trigger_phrase_comparison_examples_only",
      phrase_category: "restricted_boundary",
      historical_status: "historical_reference",
      replacement_example: "nav-trigger-comparison-example-theoretical-002",
      archive_reason: "Theoretical restricted wording changed; keep previous example as boundary history.",
      still_useful_for: "Explaining restricted_high_risk wording evolution in theoretical path.",
      archived_note: "Theoretical-only archive; do not reuse as mainstream phrasing."
    }
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASES =
  {
    maintenance_checklist_changed_review_examples:
      "Maintenance checklist updated; revisit related example cadence/archive entries for consistency.",
    comparison_phrase_changed_review_archived_examples:
      "Comparison phrase recommendation changed; revisit archived comparison examples for aligned wording.",
    keep_as_historical_reference:
      "Current example remains valid as historical_reference and can be retained for context.",
    retire_and_point_to_replacement:
      "Current example should be retired and explicitly point to a replacement example.",
    archive_note_only_no_main_template_change:
      "Current example needs archive note refinement only; no main template adjustment is required.",
    theoretical_restricted_keep_boundary_note:
      "Theoretical_restricted case: keep restricted_high_risk boundary wording explicitly in the example note.",
    continue_using_no_cadence_archive_adjustment:
      "Current example can continue to be reused with no cadence/archive semantic adjustment.",
    add_why_when_to_review_note:
      "Current example should add concise why/when to review wording for future maintenance clarity."
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_ALIGNMENT =
  {
    serves_assets: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_GUIDANCE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_TEMPLATE"
    ],
    related_assets: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_CHECKLIST",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_GUIDANCE",
      "RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE"
    ],
    does_not_replace: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_CHECKLIST",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_GUIDANCE",
      "RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE"
    ],
    purpose: "stabilize_reusable_writing_for_example_cadence_and_archive_notes_without_new_decision_logic"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_TEMPLATE =
  {
    example_reference: "comparison_example_or_archive_entry_reference",
    related_phrase_reference: "phrase_key_or_phrase_example_reference_or_none",
    related_lifecycle_status_reference: "active | historical_reference | retired",
    related_replacement_reference: "replacement_example_reference_or_none",
    omitted_reference_reason: "Reason for intentionally omitting a related reference.",
    restricted_boundary_reference: "restricted_high_risk_reference_or_none"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_ALIGNMENT =
  {
    serves_asset:
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_TEMPLATE",
    related_reference_roots: [
      "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE"
    ],
    local_scope: "comparison_example_archive_local_reference_only",
    does_not_replace: [
      "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE"
    ],
    purpose: "provide_lightweight_local_reference_writing_for_comparison_example_archive_entries"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_EXAMPLES =
  {
    cadence_phrase_reuse: {
      scene: "maintenance_checklist_changed_review_examples",
      phrase:
        "Maintenance checklist updated; revisit related example cadence/archive entries for consistency.",
      note: "Use when checklist trigger wording changed but no new rule logic is introduced."
    },
    theoretical_restricted_phrase_reuse: {
      scene: "theoretical_restricted_keep_boundary_note",
      phrase:
        "Theoretical_restricted case: keep restricted_high_risk boundary wording explicitly in the example note.",
      note: "Theoretical-only phrase; do not weaken restricted boundary semantics."
    }
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_EXAMPLES =
  {
    comparison_archive_reference_entry: {
      example_reference: "nav-trigger-comparison-example-001",
      related_phrase_reference: "wording_converged_only",
      related_lifecycle_status_reference: "historical_reference",
      related_replacement_reference: "nav-trigger-comparison-example-002",
      omitted_reference_reason: "none",
      restricted_boundary_reference: "none"
    },
    theoretical_restricted_reference_entry: {
      example_reference: "nav-trigger-comparison-example-theoretical-001",
      related_phrase_reference: "theoretical_restricted_only",
      related_lifecycle_status_reference: "historical_reference",
      related_replacement_reference: "nav-trigger-comparison-example-theoretical-002",
      omitted_reference_reason: "none",
      restricted_boundary_reference: "restricted_high_risk_boundary_preserved"
    }
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_CHECKLIST =
  {
    suggested_review_when: [
      "step45_example_review_cadence_guidance_changed",
      "step45_archive_template_field_semantics_changed",
      "step32_example_lifecycle_or_historical_note_semantics_changed",
      "step43_comparison_semantics_changed_and_affects_archive_description",
      "theoretical_or_restricted_boundary_wording_changed",
      "same_semantics_but_phrase_choice_diverged_feedback"
    ],
    execution_note:
      "Manual maintenance checklist only; this is not an automated reminder or phrase recommendation system."
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_ALIGNMENT =
  {
    scope_answers: "when_cadence_archive_phrase_assets_should_be_revisited",
    related_assets: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASES",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_GUIDANCE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_GUIDANCE",
      "RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE"
    ],
    does_not_replace: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASES",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_GUIDANCE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_GUIDANCE",
      "RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE"
    ],
    purpose: "stabilize_manual_revisit_timing_for_cadence_archive_phrase_assets_only"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES =
  {
    missing_or_ambiguous_example_reference:
      "example_reference is missing or too ambiguous; use a concrete archive/example identifier.",
    missing_related_phrase_reference:
      "related_phrase_reference should be added when phrase linkage exists; avoid leaving it implicit.",
    missing_related_lifecycle_status_reference:
      "related_lifecycle_status_reference should be explicit to avoid lifecycle status ambiguity.",
    missing_replacement_without_none_reason:
      "related_replacement_reference is missing; add replacement reference or explicitly mark none.",
    vague_omitted_reference_reason:
      "omitted_reference_reason is too vague; provide concise and concrete omission rationale.",
    missing_restricted_boundary_reference_for_theoretical:
      "Theoretical_restricted case requires explicit restricted_boundary_reference wording.",
    correct_semantics_but_phrase_not_reused:
      "Reference semantics are correct, but reuse existing phrase patterns to reduce wording drift.",
    local_reference_style_diverged_from_step35_or_step25:
      "Local archive reference wording diverges from Step 35/25 reference style; converge to existing style."
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASE_ALIGNMENT =
  {
    serves_template:
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_TEMPLATE",
    related_assets: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_ALIGNMENT",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE",
      "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE"
    ],
    does_not_replace: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE",
      "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE",
      "RECOVERY_REVIEW_PHRASE_GUIDANCE",
      "RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES"
    ],
    local_scope: "comparison_example_archive_reference_filling_only",
    purpose: "reduce_local_archive_reference_filling_drift_without_new_reference_decision_rules"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_EXAMPLES =
  {
    cadence_guidance_changed_trigger: {
      trigger: "step45_example_review_cadence_guidance_changed",
      action: "Revisit cadence/archive phrase set and keep wording aligned with latest review cadence semantics.",
      scope: "navigation_example_cadence_archive_phrase_assets"
    }
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASE_EXAMPLES =
  {
    missing_phrase_reference_reminder: {
      scene: "missing_related_phrase_reference",
      phrase:
        "related_phrase_reference should be added when phrase linkage exists; avoid leaving it implicit.",
      note: "Use when archive reference entry links to phrase semantics but phrase reference is omitted."
    },
    theoretical_restricted_boundary_reminder: {
      scene: "missing_restricted_boundary_reference_for_theoretical",
      phrase:
        "Theoretical_restricted case requires explicit restricted_boundary_reference wording.",
      note: "Theoretical-only reminder; keep restricted_high_risk boundary explicit."
    }
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_TEMPLATE =
  {
    review_scope: "navigation_phrase_maintenance_and_archive_reference_filling_drift",
    review_subject: "phrase_maintenance | filling_drift | mixed",
    observed_issue: "Short observed issue summary for this review record.",
    affected_asset: "Which phrase/checklist/template/example is affected.",
    recommended_phrase_or_fix: "Recommended phrase adjustment or filling fix.",
    follow_up_needed: "yes_or_no_with_short_reason",
    review_note: "Concise review note for traceability."
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_ALIGNMENT =
  {
    serves_assets: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_CHECKLIST",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES"
    ],
    local_scope: "phrase_maintenance_and_filling_drift_review_trace_only",
    does_not_replace: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASES",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_TEMPLATE"
    ],
    purpose: "provide_minimal_manual_review_record_for_phrase_maintenance_and_filling_drift_only"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_GUIDANCE =
  {
    review_focus: "archive_reference_filling_drift_example_refresh",
    suggested_review_when: [
      "filling_drift_phrases_changed",
      "step46_archive_reference_template_field_semantics_changed",
      "step35_or_step25_reference_style_baseline_changed_and_affects_local_writing",
      "theoretical_or_restricted_boundary_reference_wording_changed",
      "same_drift_scenario_but_multiple_reminder_writings_diverged"
    ],
    execution_note:
      "Manual cadence guidance only; this is not an automated reminder or inspection workflow."
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_ALIGNMENT =
  {
    scope_answers: "when_local_archive_reference_filling_drift_examples_should_be_revisited",
    related_assets: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE",
      "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE"
    ],
    does_not_replace: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE",
      "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE"
    ],
    purpose: "stabilize_manual_revisit_timing_for_local_archive_reference_filling_drift_examples"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_EXAMPLES =
  {
    filling_drift_review_record: {
      review_scope: "navigation_phrase_maintenance_and_archive_reference_filling_drift",
      review_subject: "filling_drift",
      observed_issue: "related_phrase_reference was omitted in two archive reference entries.",
      affected_asset:
        "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASE_EXAMPLES",
      recommended_phrase_or_fix:
        "Reuse missing_related_phrase_reference reminder and update entries with explicit phrase reference.",
      follow_up_needed: "yes_recheck_after_reference_update",
      review_note: "Local filling drift only; no main template update required."
    }
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_EXAMPLES =
  {
    drift_phrase_changed_trigger: {
      trigger: "filling_drift_phrases_changed",
      action: "Revisit local drift examples and align reminder wording with latest drift phrases.",
      scope: "local_archive_reference_filling_drift_examples"
    },
    theoretical_restricted_trigger: {
      trigger: "theoretical_or_restricted_boundary_reference_wording_changed",
      action:
        "Revisit theoretical drift examples and keep restricted_high_risk boundary reference wording explicit.",
      scope: "theoretical_restricted_local_reference_drift_examples"
    }
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASES =
  {
    review_record_field_semantics_changed_revisit_examples:
      "Review record field semantics changed; revisit related review-record examples for wording alignment.",
    filling_drift_phrase_changed_revisit_review_record_examples:
      "Filling drift reminder wording changed; revisit related review-record writing for consistency.",
    archive_reference_template_field_changed_revisit_local_drift_examples:
      "Archive reference template field semantics changed; revisit local reference drift examples accordingly.",
    cross_template_or_document_reference_baseline_changed_revisit_local_examples:
      "Cross-template/document reference style baseline changed; revisit local reference review examples.",
    theoretical_restricted_boundary_changed_revisit_high_risk_examples:
      "Theoretical_restricted boundary wording changed; revisit high-risk local review/cadence examples.",
    same_trigger_intent_multiple_near_synonym_writings_revisit_and_converge:
      "Same trigger intent appears in multiple near-synonym writings; revisit and converge example wording.",
    example_can_continue_without_review_record_or_example_cadence_adjustment:
      "Current example remains reusable; no review-record/example-cadence wording adjustment is required.",
    add_why_when_to_review_note_for_current_example:
      "Current example should add concise why/when to review wording for future maintenance clarity."
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASE_ALIGNMENT =
  {
    serves_assets: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_GUIDANCE"
    ],
    related_assets: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_CHECKLIST",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE",
      "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE"
    ],
    does_not_replace: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_CHECKLIST",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE",
      "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE"
    ],
    purpose: "stabilize_reusable_trigger_writing_for_local_review_record_and_example_cadence_examples"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_TEMPLATE =
  {
    archive_id: "local_reference_review_archive_id",
    review_scope: "local_reference_review_scope",
    review_subject: "phrase_maintenance | filling_drift | mixed",
    affected_asset: "local_review_record_or_example_asset_reference",
    follow_up_needed: "yes_or_no_with_short_reason",
    archived_at: "YYYY-MM-DD",
    archive_note: "Concise archive note for local reference review lookup."
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_ALIGNMENT =
  {
    serves_asset:
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_TEMPLATE",
    related_archival_roots: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE"
    ],
    local_scope: "local_reference_review_record_archive_index_only",
    does_not_replace: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_TEMPLATE"
    ],
    purpose: "provide_minimal_index_placeholder_for_local_reference_review_record_archival"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASE_EXAMPLES =
  {
    trigger_phrase_reuse: {
      scene: "review_record_field_semantics_changed_revisit_examples",
      phrase:
        "Review record field semantics changed; revisit related review-record examples for wording alignment.",
      note: "Use when Step 48 review record fields or field wording changed."
    },
    theoretical_restricted_trigger_phrase_reuse: {
      scene: "theoretical_restricted_boundary_changed_revisit_high_risk_examples",
      phrase:
        "Theoretical_restricted boundary wording changed; revisit high-risk local review/cadence examples.",
      note: "Theoretical-only phrase; keep restricted_high_risk boundary wording explicit."
    }
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_EXAMPLES =
  {
    local_reference_review_archive_entry: {
      archive_id: "local-ref-review-archive-001",
      review_scope: "local_reference_review_scope",
      review_subject: "filling_drift",
      affected_asset:
        "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_EXAMPLES",
      follow_up_needed: "yes_recheck_after_phrase_alignment",
      archived_at: "2026-03-25",
      archive_note: "Local reference review archived for traceability; use as lightweight lookup."
    },
    theoretical_restricted_local_reference_review_archive_entry: {
      archive_id: "local-ref-review-archive-theoretical-001",
      review_scope: "local_reference_review_scope",
      review_subject: "mixed",
      affected_asset:
        "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_EXAMPLES",
      follow_up_needed: "yes_recheck_restricted_boundary_wording",
      archived_at: "2026-03-25",
      archive_note: "Theoretical-only archive entry; preserve restricted_high_risk wording in follow-up."
    }
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_CHECKLIST =
  {
    suggested_review_when: [
      "step48_review_record_or_example_review_cadence_semantics_changed",
      "step49_local_archive_index_field_or_field_semantics_changed",
      "step47_maintenance_checklist_or_filling_drift_phrases_changed",
      "step35_or_step25_reference_baseline_changed_and_affects_local_index_writing",
      "theoretical_or_restricted_boundary_wording_changed",
      "trigger_phrase_and_maintenance_semantics_overlap_reduces_readability_feedback"
    ],
    execution_note:
      "Manual maintenance checklist only; this is not an automated reminder or indexing governance system."
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_ALIGNMENT =
  {
    scope_answers: "when_trigger_phrases_and_local_archive_index_assets_should_be_revisited",
    related_assets: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASES",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_GUIDANCE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_CHECKLIST",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE",
      "RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE"
    ],
    does_not_replace: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASES",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_GUIDANCE",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_CHECKLIST",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES"
    ],
    purpose: "stabilize_manual_revisit_timing_for_trigger_phrase_and_local_archive_index_assets_only"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASES =
  {
    missing_or_unclear_archive_id:
      "archive_id is missing or unclear; use a concrete local archive identifier.",
    vague_review_scope:
      "review_scope wording is too vague; use explicit local reference review scope.",
    review_subject_not_aligned_with_local_assets:
      "review_subject should align with local asset scope (phrase_maintenance/filling_drift/mixed).",
    missing_affected_asset:
      "affected_asset should be explicitly filled to keep archive lookup useful.",
    empty_follow_up_needed_semantics:
      "follow_up_needed semantics are too empty; provide yes/no with concise reason.",
    vague_archive_note:
      "archive_note is too vague; provide concise archival context and usage boundary.",
    missing_restricted_boundary_in_theoretical_case:
      "Theoretical_restricted case should explicitly preserve restricted_high_risk boundary wording.",
    local_index_style_diverged_from_step41_or_step29:
      "Local archive index wording diverges from Step 41/29 archival style; converge to baseline style.",
    semantics_correct_but_local_phrase_not_reused:
      "Semantics are correct, but reuse existing local phrases to reduce writing drift."
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASE_ALIGNMENT =
  {
    serves_template:
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_TEMPLATE",
    related_assets: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_ALIGNMENT",
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE"
    ],
    does_not_replace: [
      "RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE",
      "RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE",
      "RECOVERY_REVIEW_PHRASE_GUIDANCE",
      "RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES"
    ],
    local_scope: "local_archive_index_filling_only",
    purpose: "reduce_local_archive_index_filling_drift_without_new_archival_decision_rules"
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_EXAMPLES =
  {
    review_record_semantics_changed_trigger: {
      trigger: "step48_review_record_or_example_review_cadence_semantics_changed",
      action: "Revisit trigger phrases and local archive index examples for aligned local maintenance wording.",
      scope: "trigger_phrases_and_local_archive_index_assets"
    }
  } as const;

export const RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASE_EXAMPLES =
  {
    missing_archive_id_reminder: {
      scene: "missing_or_unclear_archive_id",
      phrase: "archive_id is missing or unclear; use a concrete local archive identifier.",
      note: "Use when local archive entry lacks an indexable id."
    },
    theoretical_restricted_boundary_reminder: {
      scene: "missing_restricted_boundary_in_theoretical_case",
      phrase:
        "Theoretical_restricted case should explicitly preserve restricted_high_risk boundary wording.",
      note: "Theoretical-only reminder; never drop restricted boundary wording."
    }
  } as const;

export const RECOVERY_REVIEW_TRACE_ALIGNMENT: {
  readonly [K in RecoveryReviewTraceField]: {
    readonly checklist_items: readonly RecoveryDisplayChangeImpactChecklistItem[];
    readonly hint_actions: readonly RecoveryAdapterChangeReviewAction[];
    readonly rationale_fields: readonly RecoveryDtoBaselineReasonTemplateField[];
    readonly role: "rule_basis" | "review_execution" | "risk_archival";
  };
} = {
  review_scope: {
    checklist_items: ["touches_external_dto_fields", "touches_shared_core_fields"],
    hint_actions: [
      "confirm_no_external_dto_field_change",
      "review_baseline_update_need",
      "mark_restricted_high_risk"
    ],
    rationale_fields: ["change_classification"],
    role: "rule_basis"
  },
  rule_basis: {
    checklist_items: ["touches_shared_core_fields", "requires_view_version_bump"],
    hint_actions: ["require_explicit_breaking_reason", "require_phase1_exception_rationale"],
    rationale_fields: ["baseline_rationale", "change_classification"],
    role: "rule_basis"
  },
  compatibility_checked: {
    checklist_items: ["touches_external_dto_fields", "requires_view_version_bump"],
    hint_actions: [
      "confirm_added_fields_optional_or_defaulted",
      "explain_why_view_version_bump_not_required",
      "require_view_version_bump"
    ],
    rationale_fields: ["requires_view_version_bump"],
    role: "review_execution"
  },
  baseline_checked: {
    checklist_items: ["requires_adapter_test_updates"],
    hint_actions: ["review_baseline_update_need", "confirm_baseline_update_not_required"],
    rationale_fields: ["baseline_rationale", "change_classification"],
    role: "review_execution"
  },
  rehearsal_checked: {
    checklist_items: ["requires_version_rehearsal_update"],
    hint_actions: ["review_rehearsal_update_need"],
    rationale_fields: ["updated_version_rehearsal"],
    role: "review_execution"
  },
  docs_checked: {
    checklist_items: ["requires_docs_update"],
    hint_actions: ["review_docs_update_need", "confirm_docs_update_not_required_or_explain_why"],
    rationale_fields: ["updated_docs"],
    role: "review_execution"
  },
  risk_note: {
    checklist_items: ["touches_shared_core_fields", "requires_view_version_bump"],
    hint_actions: ["mark_restricted_high_risk", "require_explicit_breaking_reason"],
    rationale_fields: ["change_classification", "baseline_rationale"],
    role: "risk_archival"
  },
  follow_up_needed: {
    checklist_items: ["requires_docs_update", "requires_view_version_bump"],
    hint_actions: [
      "require_phase1_exception_rationale",
      "recommend_escalated_review_or_reject_in_phase1"
    ],
    rationale_fields: ["requires_view_version_bump", "change_classification"],
    role: "risk_archival"
  }
};

export const RECOVERY_DTO_BASELINE_UPDATE_REASON_EXAMPLES: {
  readonly [K in RecoveryAdapterChangeClassification]: RecoveryDtoBaselineUpdateReasonExample & {
    readonly classification: K;
  };
} = {
  internal_only: {
    classification: "internal_only",
    change_summary: "Refactor internal adapter mapping names only, no external DTO field or semantic change.",
    touched_shared_core_fields: false,
    touched_external_dto_fields: false,
    updated_baseline: false,
    updated_rehearsal: false,
    updated_docs: false,
    requires_view_version_bump: false,
    conclusion:
      "Classified as internal_only; keep baseline/rehearsal/viewVersion unchanged and explain no external DTO impact in PR."
  },
  non_breaking_external: {
    classification: "non_breaking_external",
    change_summary:
      "Add one optional external DTO field with default handling, while keeping shared core field semantics unchanged.",
    touched_shared_core_fields: false,
    touched_external_dto_fields: true,
    updated_baseline: true,
    updated_rehearsal: true,
    updated_docs: true,
    requires_view_version_bump: false,
    conclusion:
      "Classified as non_breaking_external; update baseline/rehearsal/docs and explain compatibility rationale for no viewVersion bump."
  },
  breaking_external: {
    classification: "breaking_external",
    change_summary:
      "Theoretical example: rename shared core field mainOutcome, which breaks existing external compatibility.",
    touched_shared_core_fields: true,
    touched_external_dto_fields: true,
    updated_baseline: true,
    updated_rehearsal: true,
    updated_docs: true,
    requires_view_version_bump: true,
    conclusion:
      "Classified as breaking_external; in Phase 1 this is restricted high risk and requires explicit breaking rationale plus exception explanation, usually escalated or rejected."
  }
} as const;

export const RECOVERY_SHARED_CORE_FIELD_CHANGE_WARNING_TEMPLATE = [
  "[ ] Did you modify RECOVERY_EXTERNAL_SHARED_CORE_FIELDS?",
  "[ ] Did you update compatibility policy if semantics changed?",
  "[ ] Did you update adapter tests and DTO baselines?",
  "[ ] Did you update version rehearsal template cases?",
  "[ ] Did you update docs and impact checklist entries?",
  "[ ] Does this change require bumping RecoveryDisplayView viewVersion?"
] as const;

export const RECOVERY_WARNING_TO_IMPACT_CHECKLIST_ALIGNMENT = {
  shared_core_fields: "touches_shared_core_fields",
  compatibility_policy: "touches_external_dto_fields",
  adapter_tests_and_baseline: "requires_adapter_test_updates",
  version_rehearsal: "requires_version_rehearsal_update",
  docs_and_checklist: "requires_docs_update",
  view_version_bump: "requires_view_version_bump"
} as const;

export const RECOVERY_CLASSIFICATION_ALIGNMENT = {
  internal_only: {
    warning_focus: "no_shared_core_field_change_expected",
    checklist_defaults: {
      touches_shared_core_fields: false,
      touches_external_dto_fields: false,
      requires_view_version_bump: false
    }
  },
  non_breaking_external: {
    warning_focus: "confirm_optional_or_defaulted_additions_only",
    checklist_defaults: {
      touches_shared_core_fields: false,
      touches_external_dto_fields: true,
      requires_version_rehearsal_update: true,
      requires_adapter_test_updates: true,
      requires_docs_update: true
    }
  },
  breaking_external: {
    warning_focus: "phase1_restricted_high_risk_change",
    checklist_defaults: {
      touches_shared_core_fields: true,
      touches_external_dto_fields: true,
      requires_view_version_bump: true,
      requires_version_rehearsal_update: true,
      requires_adapter_test_updates: true,
      requires_docs_update: true
    }
  }
} as const;

export const mapRecoveryDisplayViewToExternalDto = (
  display: RecoveryDisplayView
): RecoveryExternalDto => {
  // Adapter must always reuse display compatibility gate.
  assertRecoveryDisplayViewCompatibility(display);

  return {
    viewVersion: display.viewVersion,
    recoveryReference: display.recoveryReference,
    sinkKind: display.sinkKind,
    mainOutcome: display.mainOutcome,
    recordStatus: display.recordStatus,
    retryEligibility: display.retryEligibility,
    hasNote: display.hasNote,
    needsAttention: display.diagnosticsSummary.needsAttention,
    sinkStatus: {
      ...(display.auditSinkStatus ? { audit: display.auditSinkStatus } : {}),
      ...(display.metricsSinkStatus ? { metrics: display.metricsSinkStatus } : {})
    },
    summary: {
      hasRecoveryRecord: display.diagnosticsSummary.hasRecoveryRecord,
      latestSinkStatus: display.diagnosticsSummary.latestSinkStatus,
      queryOutcome: display.diagnosticsSummary.queryOutcome
    },
    ...(display.timestamps.observedAt
      ? { observedAt: display.timestamps.observedAt }
      : display.timestamps.recordCreatedAt
        ? { observedAt: display.timestamps.recordCreatedAt }
        : {})
  };
};
