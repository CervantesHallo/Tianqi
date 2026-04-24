import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll } from "vitest";

import { defineConfigContractTests } from "@tianqi/adapter-testkit";

import { createFileConfig } from "./config-file.js";

// Each contract `it` calls factory() afresh. config-file needs a real file per factory
// call; we allocate a per-file path in a shared tmpdir and seed it with a minimal valid
// YAML. The YAML payload is deliberately tiny — the contract suite exercises preview /
// activate / rollback on top of whatever initial state init() leaves behind, so the
// seed contents rarely get read by the assertions themselves.
const SEED_YAML = `version: 1\nvalues:\n  seeded: true\n`;

let tmpRoot: string;
let counter = 0;

beforeAll(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), "tianqi-config-file-contract-"));
});

afterAll(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

defineConfigContractTests("config-file", async () => {
  counter += 1;
  const filePath = join(tmpRoot, `contract-${counter}.yaml`);
  await writeFile(filePath, SEED_YAML, "utf8");
  return createFileConfig({ filePath });
});
