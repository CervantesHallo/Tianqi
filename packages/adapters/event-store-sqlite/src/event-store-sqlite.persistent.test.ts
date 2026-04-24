import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterAll } from "vitest";

import {
  definePersistentEventStoreContractTests,
  type PersistentTestSession
} from "@tianqi/adapter-testkit";

import { createSqliteEventStore } from "./event-store-sqlite.js";

const scratchDirectory = join(
  tmpdir(),
  `tianqi-event-store-sqlite-persistent-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
);

mkdirSync(scratchDirectory, { recursive: true });

afterAll(() => {
  rmSync(scratchDirectory, { recursive: true, force: true });
});

const corruptSchemaVersion = (session: PersistentTestSession, newVersion: string): void => {
  const connection = new Database(session.databasePath);
  connection.prepare("UPDATE schema_version SET version = ? WHERE id = 1").run(newVersion);
  connection.close();
};

definePersistentEventStoreContractTests(
  "event-store-sqlite",
  (session) => createSqliteEventStore({ databasePath: session.databasePath }),
  { scratchDirectory, corruptSchemaVersion }
);
