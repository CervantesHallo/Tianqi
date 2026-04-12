import type { ADLCase } from "@tianqi/domain";
import type { ADLCaseId, Result, RiskCaseId } from "@tianqi/shared";

export type ADLCaseRepositoryError = {
  readonly message: string;
};

export type ADLCaseRepositoryPort = {
  getById(caseId: ADLCaseId): Promise<Result<ADLCase | null, ADLCaseRepositoryError>>;
  listBySourceRiskCaseId(sourceRiskCaseId: RiskCaseId): Promise<Result<readonly ADLCase[], ADLCaseRepositoryError>>;
  save(adlCase: ADLCase): Promise<Result<void, ADLCaseRepositoryError>>;
};
