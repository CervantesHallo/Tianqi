import type { RiskCase } from "@tianqi/domain";

import type {
  ApplicationEventRecord,
  ApplicationRiskCaseView,
  ApplicationTransitionView
} from "./risk-case-command-result.js";
import type { RiskCaseContractEvent } from "./risk-case-domain-event-mapper.js";

export const toApplicationRiskCaseView = (riskCase: RiskCase): ApplicationRiskCaseView => ({
  caseId: riskCase.id,
  caseType: riskCase.caseType,
  state: riskCase.state,
  stage: riskCase.stage,
  configVersion: riskCase.configVersion,
  createdAt: riskCase.createdAt.toISOString(),
  updatedAt: riskCase.updatedAt.toISOString()
});

export const toApplicationTransitionView = (input: {
  readonly before: {
    readonly state: string;
    readonly stage: string;
    readonly updatedAt: Date;
  };
  readonly after: {
    readonly state: string;
    readonly stage: string;
    readonly updatedAt: Date;
  };
}): ApplicationTransitionView => ({
  before: {
    state: input.before.state,
    stage: input.before.stage,
    updatedAt: input.before.updatedAt.toISOString()
  },
  after: {
    state: input.after.state,
    stage: input.after.stage,
    updatedAt: input.after.updatedAt.toISOString()
  }
});

export const toApplicationEventRecord = (
  event: RiskCaseContractEvent
): ApplicationEventRecord => ({
  eventId: event.eventId,
  eventType: event.eventType,
  eventVersion: event.eventVersion,
  traceId: event.traceId,
  caseId: event.caseId,
  occurredAt: event.occurredAt,
  payload: event.payload
});
