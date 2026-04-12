import type { LiquidationCase } from "@tianqi/domain";
import type { LiquidationCaseId, Result, RiskCaseId } from "@tianqi/shared";

export type LiquidationCaseRepositoryError = {
  readonly message: string;
};

export type LiquidationCaseRepositoryPort = {
  getById(caseId: LiquidationCaseId): Promise<Result<LiquidationCase | null, LiquidationCaseRepositoryError>>;
  listBySourceRiskCaseId(
    sourceRiskCaseId: RiskCaseId
  ): Promise<Result<readonly LiquidationCase[], LiquidationCaseRepositoryError>>;
  save(liquidationCase: LiquidationCase): Promise<Result<void, LiquidationCaseRepositoryError>>;
};
