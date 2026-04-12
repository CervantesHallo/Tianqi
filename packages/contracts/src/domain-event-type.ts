export const DOMAIN_EVENT_TYPES = {
  RiskCaseCreated: "RiskCaseCreated",
  RiskCaseStateTransitioned: "RiskCaseStateTransitioned"
} as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[keyof typeof DOMAIN_EVENT_TYPES];
