export type CoordinationSignalCategory = "normal" | "duplicate" | "late" | "replayed";

type TemporalRelation = "older" | "equal" | "newer";

export type SubcaseTerminalSignalOrdering = {
  readonly signalOccurredAt: Date;
  readonly subcaseLastUpdatedAt: Date;
  readonly riskCaseLastUpdatedAt: Date;
  readonly relationToSubcase: TemporalRelation;
  readonly relationToRiskCase: TemporalRelation;
  readonly category: CoordinationSignalCategory;
  readonly reason: string;
};

const compareTime = (left: Date, right: Date): TemporalRelation => {
  if (left.getTime() < right.getTime()) {
    return "older";
  }
  if (left.getTime() > right.getTime()) {
    return "newer";
  }
  return "equal";
};

export const buildSubcaseTerminalSignalOrdering = (input: {
  readonly signalOccurredAt: Date;
  readonly subcaseLastUpdatedAt: Date;
  readonly riskCaseLastUpdatedAt: Date;
  readonly sourceOperation: "transition" | "coordinate";
}): SubcaseTerminalSignalOrdering => {
  const relationToSubcase = compareTime(input.signalOccurredAt, input.subcaseLastUpdatedAt);
  const relationToRiskCase = compareTime(input.signalOccurredAt, input.riskCaseLastUpdatedAt);

  if (relationToSubcase === "older" || relationToRiskCase === "older") {
    return {
      signalOccurredAt: input.signalOccurredAt,
      subcaseLastUpdatedAt: input.subcaseLastUpdatedAt,
      riskCaseLastUpdatedAt: input.riskCaseLastUpdatedAt,
      relationToSubcase,
      relationToRiskCase,
      category: "late",
      reason: "Signal occurred before current subcase/risk-case coordination boundary"
    };
  }

  if (input.sourceOperation === "coordinate" && relationToSubcase !== "newer") {
    return {
      signalOccurredAt: input.signalOccurredAt,
      subcaseLastUpdatedAt: input.subcaseLastUpdatedAt,
      riskCaseLastUpdatedAt: input.riskCaseLastUpdatedAt,
      relationToSubcase,
      relationToRiskCase,
      category: "replayed",
      reason: "Signal is a replay at or before current subcase terminal snapshot boundary"
    };
  }

  return {
    signalOccurredAt: input.signalOccurredAt,
    subcaseLastUpdatedAt: input.subcaseLastUpdatedAt,
    riskCaseLastUpdatedAt: input.riskCaseLastUpdatedAt,
    relationToSubcase,
    relationToRiskCase,
    category: "normal",
    reason: "Signal is treated as a fresh terminal coordination input"
  };
};
