import type { RiskCaseType } from "@tianqi/domain";
import type { IdempotencyKey } from "@tianqi/shared";

export type CreateRiskCaseCommand = {
  readonly idempotencyKey: IdempotencyKey;
  readonly traceId: string;
  readonly caseId: string;
  readonly caseType: RiskCaseType;
  readonly configVersion: number;
  readonly createdAt: string;
};
