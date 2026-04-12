import type { CoordinationResultDiagnosticView } from "./coordination-result-diagnostic-view.js";

export type CoordinationDiagnosticHistorySlot = {
  readonly factKey: string;
  readonly latest?: CoordinationResultDiagnosticView;
  readonly previous?: CoordinationResultDiagnosticView;
};

export class CoordinationResultDiagnosticHistoryRegistry {
  private readonly byFactKey = new Map<string, CoordinationDiagnosticHistorySlot>();

  public record(view: CoordinationResultDiagnosticView): void {
    const current = this.byFactKey.get(view.factKey);
    const next: CoordinationDiagnosticHistorySlot = {
      factKey: view.factKey,
      ...(current?.latest ? { previous: current.latest } : {}),
      latest: view
    };
    this.byFactKey.set(view.factKey, next);
  }

  public getPreviousByFactKey(factKey: string): CoordinationResultDiagnosticView | null {
    return this.byFactKey.get(factKey)?.previous ?? null;
  }

  public getLatestByFactKey(factKey: string): CoordinationResultDiagnosticView | null {
    return this.byFactKey.get(factKey)?.latest ?? null;
  }
}
