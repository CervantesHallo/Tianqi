import { defineConfigContractTests } from "@tianqi/adapter-testkit";

import { createInMemoryConfig } from "./config-memory.js";

defineConfigContractTests("config-memory", () => createInMemoryConfig());
