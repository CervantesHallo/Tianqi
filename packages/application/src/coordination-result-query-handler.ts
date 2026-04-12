import { createRiskCaseId } from "@tianqi/shared";
import type { CoordinationMetricsSinkPort, CoordinationResultStorePort } from "@tianqi/ports";

import {
  dependencyFailureError,
  invalidApplicationCommandError,
  resourceNotFoundError
} from "./application-error.js";
import type { ApplicationError } from "./application-error.js";
import { CoordinationResultRegistry } from "./coordination-result-registry.js";
import { buildCoordinationResultFactKey, mapStoredCoordinationResultToReadView } from "./coordination-result-persistence-mapper.js";
import { validateCoordinationResultReplayCompatibility } from "./coordination-result-replay-validation.js";
import { buildCoordinationResultObservation } from "./coordination-result-observation.js";
import { CoordinationResultObservationRegistry } from "./coordination-result-observation-registry.js";
import type { GetRiskCaseCoordinationResultQuery } from "./get-risk-case-coordination-result-query.js";
import type {
  CoordinationMetricsSinkStatus,
  CoordinationResultQueryResult
} from "./coordination-result-query-model.js";
import {
  assertCoordinationResultViewsConsistent,
  type RiskCaseCoordinationResultView
} from "./risk-case-coordination-result-read-view.js";

type CoordinationResultQueryHandlerDependencies = {
  readonly coordinationResultRegistry: CoordinationResultRegistry;
  readonly coordinationResultStore?: CoordinationResultStorePort;
  readonly coordinationMetricsSink?: CoordinationMetricsSinkPort;
  readonly coordinationObservationRegistry?: CoordinationResultObservationRegistry;
};

export class CoordinationResultQueryHandler {
  private readonly coordinationResultRegistry: CoordinationResultRegistry;
  private readonly coordinationResultStore: CoordinationResultStorePort | undefined;
  private readonly coordinationMetricsSink: CoordinationMetricsSinkPort | undefined;
  private readonly coordinationObservationRegistry: CoordinationResultObservationRegistry;

  public constructor(dependencies: CoordinationResultQueryHandlerDependencies) {
    this.coordinationResultRegistry = dependencies.coordinationResultRegistry;
    this.coordinationResultStore = dependencies.coordinationResultStore;
    this.coordinationMetricsSink = dependencies.coordinationMetricsSink;
    this.coordinationObservationRegistry =
      dependencies.coordinationObservationRegistry ?? new CoordinationResultObservationRegistry();
  }

  public async handle(query: GetRiskCaseCoordinationResultQuery): Promise<CoordinationResultQueryResult> {
    let riskCaseId;
    try {
      riskCaseId = createRiskCaseId(query.riskCaseId);
    } catch (error) {
      return this.withObservation(
        {
          success: false,
          error: invalidApplicationCommandError("GetRiskCaseCoordinationResultQuery has invalid RiskCase identifier", {
            cause: error instanceof Error ? error.message : "unknown"
          })
        },
        buildCoordinationResultObservation({
          scope: "query",
          riskCaseId: query.riskCaseId,
          subcaseType: query.subcaseType,
          subcaseId: query.subcaseId
        })
      );
    }
    if (query.subcaseId.trim().length === 0) {
      return this.withObservation(
        {
          success: false,
          error: invalidApplicationCommandError("GetRiskCaseCoordinationResultQuery.subcaseId must be non-empty")
        },
        buildCoordinationResultObservation({
          scope: "query",
          riskCaseId,
          subcaseType: query.subcaseType
        })
      );
    }

    const baseObservation = {
      scope: "query" as const,
      riskCaseId,
      subcaseType: query.subcaseType,
      subcaseId: query.subcaseId
    };
    const registryView = this.coordinationResultRegistry.getLatestByRiskCaseAndSubcase({
      riskCaseId,
      subcaseType: query.subcaseType,
      subcaseId: query.subcaseId
    });
    if (this.coordinationResultStore) {
      const lookup = await this.coordinationResultStore.getLatestByRiskCaseAndSubcase({
        riskCaseId,
        subcaseType: query.subcaseType,
        subcaseId: query.subcaseId
      });
      if (!lookup.ok) {
        return this.withObservation(
          {
            success: false,
            error: dependencyFailureError("Failed to read persisted coordination result", {
              riskCaseId,
              subcaseType: query.subcaseType,
              subcaseId: query.subcaseId,
              message: lookup.error.message
            })
          },
          buildCoordinationResultObservation({
            ...baseObservation,
            persistenceWriteFailed: true
          })
        );
      }
      if (lookup.value.status === "found") {
        const replayValidation = validateCoordinationResultReplayCompatibility({
          storedRecord: lookup.value.record,
          ...(registryView ? { currentAuditSummary: registryView.auditRecordSummary } : {})
        });
        if (!replayValidation.ok) {
          return this.withObservation(
            { success: false, error: replayValidation.error },
            buildCoordinationResultObservation({
              ...baseObservation,
              factKey: lookup.value.record.factKey,
              storeReadHit: true,
              validationFailed: true
            })
          );
        }

        const persistedView = mapStoredCoordinationResultToReadView(lookup.value.record);
        if (registryView) {
          const consistency = assertCoordinationResultViewsConsistent(persistedView, registryView);
          if (!consistency.ok) {
            return this.withObservation(
              {
                success: false,
                error: invalidApplicationCommandError("Persisted coordination result is inconsistent with registry view", {
                  reason: consistency.reason,
                  ...consistency.details
                })
              },
              buildCoordinationResultObservation({
                ...baseObservation,
                factKey: lookup.value.record.factKey,
                storeReadHit: true,
                validationFailed: true
              })
            );
          }
        }
        return this.withObservation(
          {
            success: true,
            view: persistedView
          },
          buildCoordinationResultObservation({
            ...baseObservation,
            factKey: lookup.value.record.factKey,
            storeReadHit: true,
            validationPassed: true
          })
        );
      }
    }

    if (!registryView) {
      return this.withObservation(
        {
          success: false,
          error: resourceNotFoundError("Coordination result read view not found", {
            riskCaseId,
            subcaseType: query.subcaseType,
            subcaseId: query.subcaseId
          })
        },
        buildCoordinationResultObservation(baseObservation)
      );
    }

    return this.withObservation(
      {
        success: true,
        view: registryView
      },
      buildCoordinationResultObservation({
        ...baseObservation,
          ...(registryView
            ? {
                factKey: buildCoordinationResultFactKey(registryView)
              }
            : {}),
        registryFallbackUsed: true,
        validationPassed: true
      })
    );
  }

  private async withObservation(
    result:
      | { readonly success: true; readonly view: RiskCaseCoordinationResultView }
      | { readonly success: false; readonly error: ApplicationError },
    observation: ReturnType<typeof buildCoordinationResultObservation>
  ): Promise<CoordinationResultQueryResult> {
    this.coordinationObservationRegistry.record(observation);
    const metricsSink = await this.emitObservation(observation);
    if (result.success) {
      return {
        success: true,
        view: result.view,
        observation,
        metricsSink
      };
    }
    return {
      success: false,
      error: result.error,
      observation,
      metricsSink
    };
  }

  private async emitObservation(
    observation: ReturnType<typeof buildCoordinationResultObservation>
  ): Promise<CoordinationMetricsSinkStatus> {
    if (!this.coordinationMetricsSink) {
      return { status: "not_attempted" };
    }
    const sink = await this.coordinationMetricsSink.record(observation);
    if (!sink.ok) {
      return { status: "failed", errorSummary: sink.error.message };
    }
    return { status: "succeeded" };
  }
}
