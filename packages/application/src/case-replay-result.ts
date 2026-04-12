import type { CaseReconstructionStatus } from "./case-reconstruction.js";

export type CaseReplayResult = {
  readonly caseId: string;
  readonly eventCount: number;
  readonly reconstructionStatus: CaseReconstructionStatus;
  readonly finalState: string;
  readonly replaySummary: string;
};
