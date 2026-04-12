import type { RiskCase } from "@tianqi/domain";
import type { Result, RiskCaseId } from "@tianqi/shared";

export type RiskCaseRepositoryError = {
  readonly message: string;
};

export type RiskCaseRepositoryPort = {
  getById(caseId: RiskCaseId): Promise<Result<RiskCase | null, RiskCaseRepositoryError>>;
  save(riskCase: RiskCase): Promise<Result<void, RiskCaseRepositoryError>>;
};
