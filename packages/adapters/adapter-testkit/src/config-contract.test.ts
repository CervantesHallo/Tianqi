import { defineConfigContractTests } from "./config-contract.js";
import { createReferenceConfig } from "./fixtures/reference-config.js";

defineConfigContractTests("reference", () => createReferenceConfig());
