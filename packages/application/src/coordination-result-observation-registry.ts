import type { CoordinationResultReadObservation } from "./coordination-result-observation.js";

export type CoordinationResultObservationSnapshot = {
  readonly factKey: string;
  readonly lastQueryObservation?: CoordinationResultReadObservation;
  readonly lastPersistenceObservation?: CoordinationResultReadObservation;
  readonly lastRepairObservation?: CoordinationResultReadObservation;
};

export class CoordinationResultObservationRegistry {
  private readonly byFactKey = new Map<string, CoordinationResultObservationSnapshot>();

  public record(observation: CoordinationResultReadObservation): void {
    if (!observation.factKey) {
      return;
    }
    const current = this.byFactKey.get(observation.factKey) ?? {
      factKey: observation.factKey
    };
    const next: CoordinationResultObservationSnapshot = {
      ...current,
      ...(observation.scope === "query" ? { lastQueryObservation: observation } : {}),
      ...(observation.scope === "persistence" ? { lastPersistenceObservation: observation } : {}),
      ...(observation.scope === "repair" ? { lastRepairObservation: observation } : {})
    };
    this.byFactKey.set(observation.factKey, next);
  }

  public getByFactKey(factKey: string): CoordinationResultObservationSnapshot | null {
    return this.byFactKey.get(factKey) ?? null;
  }
}
