import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll } from "vitest";

import {
  definePersistentConfigContractTests,
  type PersistentConfigContractOptions,
  type PersistentConfigTestSession
} from "@tianqi/adapter-testkit";

import { createFileConfig } from "./config-file.js";

// Persistent contract mount for @tianqi/config-file. The harness writes YAML content to
// the session's filePath and drives the Adapter through factory(). Each session owns
// its own historyDirectory so restart tests can re-init against the same on-disk
// footprint without cross-test pollution.

let scratchRoot: string;

beforeAll(async () => {
  scratchRoot = await mkdtemp(join(tmpdir(), "tianqi-config-file-persistent-"));
});

afterAll(async () => {
  await rm(scratchRoot, { recursive: true, force: true });
});

const options: PersistentConfigContractOptions = {
  get scratchDirectory(): string {
    return scratchRoot;
  },
  writeYamlContent: async (session, content) => {
    await writeFile(session.filePath, content, "utf8");
  },
  corruptYaml: async (session) => {
    // Truncated mid-line YAML that parseYaml will reject — a close imitation of a
    // partial write from an unlucky `mv`.
    await writeFile(session.filePath, "version: 1\nvalues:\n  foo: [unclosed\n", "utf8");
  },
  deleteYaml: async (session) => {
    await unlink(session.filePath);
  }
};

definePersistentConfigContractTests(
  "config-file",
  (session: PersistentConfigTestSession) =>
    createFileConfig({
      filePath: session.filePath,
      historyDirectory: session.historyDirectory,
      // watchMode intentionally "manual" so tests drive reload() explicitly; this
      // matches the production default and keeps timing deterministic across CI runs.
      watchMode: "manual",
      autoActivate: session.autoActivate ?? "never"
    }),
  options
);
