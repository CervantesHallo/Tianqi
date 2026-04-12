import type { CoordinationResultRepairRecordView } from "./coordination-result-repair-command-result.js";
import type {
  CoordinationResultRepairLifecycleState,
  CoordinationResultRepairStatus
} from "./coordination-result-repair-status.js";

export class CoordinationResultRepairRecordRegistry {
  private readonly byFactKey = new Map<string, CoordinationResultRepairRecordView>();
  private readonly stateByFactKey = new Map<string, CoordinationResultRepairLifecycleState>();

  public save(record: CoordinationResultRepairRecordView): void {
    this.byFactKey.set(record.factKey, record);
    this.stateByFactKey.set(record.factKey, {
      factKey: record.factKey,
      repairStatus: record.repairStatus,
      repairAttempts: record.repairAttempts,
      lastRepairOutcome: record.outcome,
      manualConfirmation: record.manualConfirmation,
      ...(record.lastErrorCode ? { lastErrorCode: record.lastErrorCode } : {}),
      lastUpdatedAt: record.repairedAt
    });
  }

  public getByFactKey(factKey: string): CoordinationResultRepairRecordView | null {
    return this.byFactKey.get(factKey) ?? null;
  }

  public getRepairStateByFactKey(factKey: string): CoordinationResultRepairLifecycleState {
    const state = this.stateByFactKey.get(factKey);
    if (state) {
      return state;
    }
    return {
      factKey,
      repairStatus: "not_repaired",
      repairAttempts: 0,
      manualConfirmation: false,
      lastUpdatedAt: new Date(0).toISOString()
    };
  }

  public setRepairState(state: CoordinationResultRepairLifecycleState): void {
    this.stateByFactKey.set(state.factKey, state);
  }

  public transitionRepairState(input: {
    readonly factKey: string;
    readonly to: CoordinationResultRepairStatus;
    readonly outcome: CoordinationResultRepairLifecycleState["lastRepairOutcome"];
    readonly repairAttempts: number;
    readonly manualConfirmation: boolean;
    readonly updatedAt: string;
    readonly lastErrorCode?: string;
  }): CoordinationResultRepairLifecycleState {
    const nextState: CoordinationResultRepairLifecycleState = {
      factKey: input.factKey,
      repairStatus: input.to,
      repairAttempts: input.repairAttempts,
      ...(input.outcome ? { lastRepairOutcome: input.outcome } : {}),
      manualConfirmation: input.manualConfirmation,
      ...(input.lastErrorCode ? { lastErrorCode: input.lastErrorCode } : {}),
      lastUpdatedAt: input.updatedAt
    };
    this.stateByFactKey.set(input.factKey, nextState);
    return nextState;
  }
}
