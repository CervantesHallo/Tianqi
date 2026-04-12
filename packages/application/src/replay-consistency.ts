import type { CaseReplayInput } from "./case-replay-command.js";

export type ReplayConsistencyResult = {
  readonly consistent: boolean;
  readonly violations: readonly string[];
  readonly checkedInvariants: number;
};

export const validateReplayConsistency = (input: CaseReplayInput): ReplayConsistencyResult => {
  const violations: string[] = [];

  const caseIdMismatch = input.events.some(e => e.caseId !== input.caseId);
  if (caseIdMismatch) {
    violations.push(`Event stream contains events for a different caseId than ${input.caseId}`);
  }

  for (const e of input.events) {
    if (!e.eventVersion || e.eventVersion.length === 0) {
      violations.push(`Event ${e.eventId} is missing eventVersion`);
    }
  }

  const sorted = [...input.events].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.sequenceNumber <= sorted[i - 1]!.sequenceNumber) {
      violations.push(`Sequence number non-monotonic at index ${i}: ${sorted[i]!.sequenceNumber} <= ${sorted[i - 1]!.sequenceNumber}`);
    }
  }

  if (input.events.length > 0) {
    const hasStarted = input.events.some(e => e.eventType.includes("Started"));
    if (!hasStarted) {
      violations.push("Event stream missing a Started event");
    }
  }

  return { consistent: violations.length === 0, violations, checkedInvariants: 4 };
};
