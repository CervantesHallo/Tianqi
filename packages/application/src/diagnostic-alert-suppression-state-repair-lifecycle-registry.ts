import type {
  DiagnosticAlertSuppressionStateRepairLifecycleState,
  DiagnosticAlertSuppressionStateRepairOutcome,
  DiagnosticAlertSuppressionStateRepairStatus
} from "./diagnostic-alert-suppression-state-repair-lifecycle.js";

export class DiagnosticAlertSuppressionStateRepairLifecycleRegistry {
  private readonly bySuppressionKey = new Map<string, DiagnosticAlertSuppressionStateRepairLifecycleState>();

  public getBySuppressionKey(suppressionKey: string): DiagnosticAlertSuppressionStateRepairLifecycleState {
    return (
      this.bySuppressionKey.get(suppressionKey) ?? {
        targetSuppressionKey: suppressionKey,
        repairStatus: "not_repaired",
        repairAttempts: 0,
        manualConfirmation: false,
        lastUpdatedAt: new Date(0).toISOString()
      }
    );
  }

  public setState(state: DiagnosticAlertSuppressionStateRepairLifecycleState): void {
    this.bySuppressionKey.set(state.targetSuppressionKey, state);
  }

  public transition(input: {
    readonly suppressionKey: string;
    readonly to: DiagnosticAlertSuppressionStateRepairStatus;
    readonly outcome: DiagnosticAlertSuppressionStateRepairOutcome;
    readonly attempts: number;
    readonly manualConfirmation: boolean;
    readonly reason?: string | undefined;
    readonly attemptedAt?: string | undefined;
    readonly repairedAt?: string | undefined;
    readonly schemaVersionBefore?: string | undefined;
    readonly schemaVersionAfter?: string | undefined;
    readonly updatedAt: string;
  }): DiagnosticAlertSuppressionStateRepairLifecycleState {
    const nextState: DiagnosticAlertSuppressionStateRepairLifecycleState = {
      targetSuppressionKey: input.suppressionKey,
      repairStatus: input.to,
      repairAttempts: input.attempts,
      lastRepairOutcome: input.outcome,
      manualConfirmation: input.manualConfirmation,
      ...(input.reason ? { lastReason: input.reason } : {}),
      ...(input.attemptedAt ? { lastAttemptedAt: input.attemptedAt } : {}),
      ...(input.repairedAt ? { lastRepairedAt: input.repairedAt } : {}),
      ...(input.schemaVersionBefore ? { schemaVersionBefore: input.schemaVersionBefore } : {}),
      ...(input.schemaVersionAfter ? { schemaVersionAfter: input.schemaVersionAfter } : {}),
      lastUpdatedAt: input.updatedAt
    };
    this.bySuppressionKey.set(input.suppressionKey, nextState);
    return nextState;
  }
}
