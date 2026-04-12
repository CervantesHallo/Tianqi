import type { CompensationRecordStorePort, CompensationRecordQuery } from "@tianqi/ports";

import { dependencyFailureError } from "./application-error.js";
import type { CompensationQueryResult } from "./compensation-query-model.js";

export class CompensationQueryHandler {
  private readonly compensationStore: CompensationRecordStorePort;

  public constructor(compensationStore: CompensationRecordStorePort) {
    this.compensationStore = compensationStore;
  }

  public async getCompensationStatus(
    query: CompensationRecordQuery
  ): Promise<CompensationQueryResult> {
    const lookup = await this.compensationStore.getOne(query);
    if (!lookup.ok) {
      return {
        status: "unavailable",
        query,
        error: dependencyFailureError("Failed to query compensation record", {
          message: lookup.error.message
        })
      };
    }

    if (lookup.value.status === "missing") {
      return {
        status: "missing",
        query
      };
    }

    return {
      status: "found",
      record: {
        commandName: lookup.value.record.commandName,
        caseId: lookup.value.record.caseId,
        status: lookup.value.record.status,
        reason: lookup.value.record.reason,
        ...(lookup.value.record.resultReference
          ? { resultReference: lookup.value.record.resultReference }
          : {}),
        updatedAt: lookup.value.record.updatedAt
      }
    };
  }
}
