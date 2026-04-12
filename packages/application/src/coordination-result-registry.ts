import { invalidApplicationCommandError } from "./application-error.js";
import type { ApplicationError } from "./application-error.js";
import { buildCoordinationResultFactKey } from "./coordination-result-persistence-mapper.js";
import {
  assertCoordinationResultViewsConsistent,
  type RiskCaseCoordinationResultView
} from "./risk-case-coordination-result-read-view.js";

const toLatestKey = (view: Pick<RiskCaseCoordinationResultView, "riskCaseId" | "subcaseType" | "subcaseId">): string =>
  `${view.riskCaseId}|${view.subcaseType}|${view.subcaseId}`;

const toTime = (iso: string): number => new Date(iso).getTime();

export class CoordinationResultRegistry {
  private readonly byFact = new Map<string, RiskCaseCoordinationResultView>();

  private readonly byLatest = new Map<string, RiskCaseCoordinationResultView>();

  public record(view: RiskCaseCoordinationResultView):
    | { readonly ok: true }
    | { readonly ok: false; readonly error: ApplicationError } {
    const factKey = buildCoordinationResultFactKey(view);
    const existing = this.byFact.get(factKey);
    if (existing) {
      const consistency = assertCoordinationResultViewsConsistent(existing, view);
      if (!consistency.ok) {
        return {
          ok: false,
          error: invalidApplicationCommandError("Cross-command coordination view consistency check failed", {
            reason: consistency.reason,
            ...consistency.details
          })
        };
      }
      return { ok: true };
    }

    this.byFact.set(factKey, view);
    const latestKey = toLatestKey(view);
    const currentLatest = this.byLatest.get(latestKey);
    if (!currentLatest || toTime(view.occurredAt) >= toTime(currentLatest.occurredAt)) {
      this.byLatest.set(latestKey, view);
    }
    return { ok: true };
  }

  public getLatestByRiskCaseAndSubcase(input: {
    readonly riskCaseId: string;
    readonly subcaseType: RiskCaseCoordinationResultView["subcaseType"];
    readonly subcaseId: string;
  }): RiskCaseCoordinationResultView | null {
    return this.byLatest.get(toLatestKey(input)) ?? null;
  }

  public getByFactKey(factKey: string): RiskCaseCoordinationResultView | null {
    return this.byFact.get(factKey) ?? null;
  }
}
