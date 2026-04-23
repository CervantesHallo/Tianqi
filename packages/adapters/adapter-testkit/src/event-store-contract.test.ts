import { defineEventStoreContractTests } from "./event-store-contract.js";
import { createReferenceEventStore } from "./fixtures/reference-event-store.js";

defineEventStoreContractTests("reference", () => createReferenceEventStore());
