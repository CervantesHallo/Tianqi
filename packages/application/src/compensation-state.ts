export const COMPENSATION_STATUSES = {
  Pending: "pending",
  NotRequired: "not_required",
  Resolved: "resolved",
  ManualInterventionRequired: "manual_intervention_required"
} as const;

export type CompensationStatus =
  (typeof COMPENSATION_STATUSES)[keyof typeof COMPENSATION_STATUSES];

export const canTransitionCompensationStatus = (
  from: CompensationStatus,
  to: CompensationStatus
): boolean => {
  const transitions: Readonly<Record<CompensationStatus, readonly CompensationStatus[]>> = {
    [COMPENSATION_STATUSES.Pending]: [
      COMPENSATION_STATUSES.Pending,
      COMPENSATION_STATUSES.Resolved,
      COMPENSATION_STATUSES.ManualInterventionRequired
    ],
    [COMPENSATION_STATUSES.NotRequired]: [COMPENSATION_STATUSES.NotRequired],
    [COMPENSATION_STATUSES.Resolved]: [COMPENSATION_STATUSES.Resolved],
    [COMPENSATION_STATUSES.ManualInterventionRequired]: [
      COMPENSATION_STATUSES.ManualInterventionRequired,
      COMPENSATION_STATUSES.Resolved
    ]
  };
  return transitions[from].includes(to);
};
