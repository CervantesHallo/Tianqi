import {
  invalidApplicationCommandError
} from "./application-error.js";
import { buildCoreCaseDiagnosticAggregateView } from "./core-case-diagnostic-aggregate-builder.js";
import {
  validateCoreCaseDiagnosticAggregateConsistency
} from "./core-case-diagnostic-aggregate-consistency.js";
import type { CoreCaseDiagnosticAggregateQueryResult } from "./core-case-diagnostic-aggregate-query-model.js";
import type { GetCoreCaseDiagnosticAggregateViewQuery } from "./get-core-case-diagnostic-aggregate-view-query.js";
import type { GetCoordinationResultDiagnosticViewQuery } from "./get-coordination-result-diagnostic-view-query.js";
import type { CoordinationResultDiagnosticQueryResult } from "./coordination-result-diagnostic-query-model.js";

type CoreCaseDiagnosticAggregateReader = {
  handle(query: GetCoordinationResultDiagnosticViewQuery): Promise<CoordinationResultDiagnosticQueryResult>;
};

type CoreCaseDiagnosticAggregateQueryHandlerDependencies = {
  readonly diagnosticQueryReader: CoreCaseDiagnosticAggregateReader;
};

export class CoreCaseDiagnosticAggregateQueryHandler {
  private readonly diagnosticQueryReader: CoreCaseDiagnosticAggregateReader;

  public constructor(dependencies: CoreCaseDiagnosticAggregateQueryHandlerDependencies) {
    this.diagnosticQueryReader = dependencies.diagnosticQueryReader;
  }

  public async handle(query: GetCoreCaseDiagnosticAggregateViewQuery): Promise<CoreCaseDiagnosticAggregateQueryResult> {
    if (query.factKey.trim().length === 0) {
      return {
        success: false,
        error: invalidApplicationCommandError("GetCoreCaseDiagnosticAggregateViewQuery.factKey must be non-empty")
      };
    }

    const base = await this.diagnosticQueryReader.handle({
      factKey: query.factKey,
      includeHistoryComparison: query.includeHistoryComparison ?? true
    });
    if (!base.success) {
      return base;
    }

    const built = buildCoreCaseDiagnosticAggregateView(base);
    const consistency = validateCoreCaseDiagnosticAggregateConsistency({ aggregate: built });
    if (consistency.status === "failed") {
      const inconsistent = {
        ...built,
        requiresAttention: true,
        isCrossSessionConsistent: false,
        explanationStatus: "inconsistent" as const,
        aggregateSummary: `${built.aggregateSummary}; aggregate_consistency=failed`,
        primaryReason: consistency.reason,
        recommendedNextStep: "investigate_cross_session_inconsistency"
      };
      return {
        success: true,
        aggregateView: inconsistent,
        consistencyStatus: consistency.status,
        consistencyReason: consistency.reason
      };
    }

    return {
      success: true,
      aggregateView: built,
      consistencyStatus: consistency.status,
      consistencyReason: consistency.reason
    };
  }
}

