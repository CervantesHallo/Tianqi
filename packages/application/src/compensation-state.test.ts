import { describe, expect, it } from "vitest";

import {
  canTransitionCompensationStatus,
  COMPENSATION_STATUSES
} from "./compensation-state.js";

describe("compensation state model", () => {
  it("contains the frozen minimal compensation statuses", () => {
    expect(COMPENSATION_STATUSES.Pending).toBe("pending");
    expect(COMPENSATION_STATUSES.NotRequired).toBe("not_required");
    expect(COMPENSATION_STATUSES.Resolved).toBe("resolved");
    expect(COMPENSATION_STATUSES.ManualInterventionRequired).toBe("manual_intervention_required");
  });

  it("allows only declared transitions", () => {
    expect(
      canTransitionCompensationStatus(
        COMPENSATION_STATUSES.Pending,
        COMPENSATION_STATUSES.Resolved
      )
    ).toBe(true);
    expect(
      canTransitionCompensationStatus(
        COMPENSATION_STATUSES.Pending,
        COMPENSATION_STATUSES.ManualInterventionRequired
      )
    ).toBe(true);
    expect(
      canTransitionCompensationStatus(
        COMPENSATION_STATUSES.NotRequired,
        COMPENSATION_STATUSES.Resolved
      )
    ).toBe(false);
    expect(
      canTransitionCompensationStatus(
        COMPENSATION_STATUSES.Resolved,
        COMPENSATION_STATUSES.Pending
      )
    ).toBe(false);
  });
});
