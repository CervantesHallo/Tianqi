import type { CompensationRecordStorePort, StoredCompensationRecord } from "@tianqi/ports";
import { createCommandResultReference, err, ok } from "@tianqi/shared";
import { describe, expect, it } from "vitest";

import { CompensationQueryHandler } from "./compensation-query-handler.js";

class FakeCompensationStore implements CompensationRecordStorePort {
  public fail = false;
  public foundRecord: StoredCompensationRecord | null = null;

  public async getOne() {
    if (this.fail) {
      return err({ message: "compensation store unavailable" });
    }
    if (!this.foundRecord) {
      return ok({ status: "missing" as const });
    }
    return ok({ status: "found" as const, record: this.foundRecord });
  }
}

describe("CompensationQueryHandler", () => {
  it("returns found compensation record", async () => {
    const store = new FakeCompensationStore();
    store.foundRecord = {
      commandName: "CreateRiskCaseCommand",
      caseId: "case-comp-found",
      status: "pending",
      reason: "publish_failed",
      resultReference: createCommandResultReference("comp-ref-found"),
      updatedAt: "2026-03-25T00:00:10.000Z"
    };
    const handler = new CompensationQueryHandler(store);

    const result = await handler.getCompensationStatus({
      by: "reference",
      resultReference: createCommandResultReference("comp-ref-found")
    });

    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.record.status).toBe("pending");
      expect(result.record.reason).toBe("publish_failed");
    }
  });

  it("returns missing compensation record", async () => {
    const handler = new CompensationQueryHandler(new FakeCompensationStore());
    const result = await handler.getCompensationStatus({
      by: "case_id",
      caseId: "case-comp-missing"
    });

    expect(result.status).toBe("missing");
  });

  it("returns unavailable when compensation store fails", async () => {
    const store = new FakeCompensationStore();
    store.fail = true;
    const handler = new CompensationQueryHandler(store);

    const result = await handler.getCompensationStatus({
      by: "command_name",
      commandName: "CreateRiskCaseCommand"
    });

    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.error.code).toBe("TQ-APP-004");
    }
  });
});
