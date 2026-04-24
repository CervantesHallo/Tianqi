import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import Database from "better-sqlite3";

import { createSqliteEventStore } from "./event-store-sqlite.js";

const scratchDirectory = join(
  tmpdir(),
  `tianqi-event-store-sqlite-own-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
);

mkdirSync(scratchDirectory, { recursive: true });

afterAll(() => {
  rmSync(scratchDirectory, { recursive: true, force: true });
});

describe("createSqliteEventStore — adapter-specific invariants", () => {
  it("test_in_memory_database_path_works_for_short_lived_sessions", async () => {
    const adapter = createSqliteEventStore({ databasePath: ":memory:" });
    await adapter.init();
    expect(await adapter.countTotal()).toBe(0);
    await adapter.shutdown();
  });

  it("test_factory_requires_database_path_at_type_layer", () => {
    // @ts-expect-error — databasePath is a required field of SqliteEventStoreOptions
    const adapter = createSqliteEventStore({});
    expect(adapter.adapterName).toBe("event-store-sqlite");
  });

  it("test_schema_version_row_is_seeded_with_1_0_0_on_first_init", async () => {
    const databasePath = join(scratchDirectory, "schema-seed.sqlite");
    const adapter = createSqliteEventStore({ databasePath });
    await adapter.init();
    await adapter.shutdown();

    const probe = new Database(databasePath);
    const row = probe.prepare("SELECT version FROM schema_version WHERE id = 1").get() as
      | { version: string }
      | undefined;
    probe.close();

    expect(row?.version).toBe("1.0.0");
  });

  it("test_object_keys_exposes_only_union_of_three_contracts_no_extras", () => {
    const adapter = createSqliteEventStore({ databasePath: ":memory:" });
    const expected = new Set([
      "adapterName",
      "__testkitProbe",
      "append",
      "listByCaseId",
      "countTotal",
      "init",
      "shutdown",
      "healthCheck"
    ]);
    const actual = new Set(Object.keys(adapter));
    expect(actual).toEqual(expected);
  });

  it("test_two_distinct_database_paths_do_not_share_state", async () => {
    const pathA = join(scratchDirectory, "isolation-a.sqlite");
    const pathB = join(scratchDirectory, "isolation-b.sqlite");
    const adapterA = createSqliteEventStore({ databasePath: pathA });
    const adapterB = createSqliteEventStore({ databasePath: pathB });
    await adapterA.init();
    await adapterB.init();
    expect(await adapterA.countTotal()).toBe(0);
    expect(await adapterB.countTotal()).toBe(0);
    await adapterA.shutdown();
    await adapterB.shutdown();
  });
});
