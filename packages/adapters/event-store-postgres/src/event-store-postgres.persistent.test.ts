import { env } from "node:process";

import { afterAll, describe } from "vitest";

import pg from "pg";

import {
  definePersistentEventStoreContractTests,
  type PersistentTestSession
} from "@tianqi/adapter-testkit";

import { createPostgresEventStore } from "./event-store-postgres.js";

const { Client } = pg;

const testUrl = env["TIANQI_TEST_POSTGRES_URL"];
const canReachPostgres = typeof testUrl === "string" && testUrl.length > 0;

const RUN_ID = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
const SCHEMA_PREFIX = `tianqi_step6_p_${RUN_ID}`.toLowerCase();
// testkit passes session.databasePath = `<scratchDirectory>/persistent-session-<N>.sqlite`.
// For Postgres we reinterpret the trailing session id as a schema-name suffix so each test
// case operates in its own isolated schema rather than its own SQLite file.
const SESSION_SCHEMA_PATTERN = /persistent-session-(\d+)\.sqlite$/;
// testkit's P4.2 test deliberately asks us to open "/this/path/does/not/exist/...": translate
// it to an always-unreachable connection string so init() fails in the same spirit as SQLite.
const BAD_PATH_MARKER = "does/not/exist";

const deriveSchemaFromSession = (session: PersistentTestSession): string => {
  const match = SESSION_SCHEMA_PATTERN.exec(session.databasePath);
  const sessionNumber = match?.[1] ?? "0";
  return `${SCHEMA_PREFIX}_s${sessionNumber}`;
};

const factory = (session: PersistentTestSession) => {
  if (session.databasePath.includes(BAD_PATH_MARKER)) {
    return createPostgresEventStore({
      connectionString: "postgres://tianqi_unreachable:secret@127.0.0.1:1/nonexistent",
      connectionTimeoutMs: 500
    });
  }
  return createPostgresEventStore({
    connectionString: testUrl ?? "",
    schema: deriveSchemaFromSession(session)
  });
};

const corruptSchemaVersion = async (
  session: PersistentTestSession,
  newVersion: string
): Promise<void> => {
  const schema = deriveSchemaFromSession(session);
  const client = new Client({ connectionString: testUrl ?? "" });
  await client.connect();
  try {
    await client.query(`UPDATE "${schema}".schema_version SET version = $1 WHERE id = 1`, [
      newVersion
    ]);
  } finally {
    await client.end();
  }
};

afterAll(async () => {
  if (!canReachPostgres) return;
  const client = new Client({ connectionString: testUrl ?? "" });
  await client.connect();
  try {
    const schemas = await client.query<{ schema_name: string }>(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE $1",
      [`${SCHEMA_PREFIX}%`]
    );
    for (const row of schemas.rows) {
      await client.query(`DROP SCHEMA IF EXISTS "${row.schema_name}" CASCADE`);
    }
  } finally {
    await client.end();
  }
});

describe.skipIf(!canReachPostgres)("event-store-postgres persistent contract", () => {
  definePersistentEventStoreContractTests("event-store-postgres", factory, {
    scratchDirectory: SCHEMA_PREFIX,
    corruptSchemaVersion
  });
});
