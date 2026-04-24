import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createFileConfig } from "./config-file.js";

// Each of these tests covers a dimension the shared Config contract cannot: YAML parsing,
// file-system failure paths, and struct-validation of the file's top-level shape. None
// duplicate an assertion from defineConfigContractTests (Convention L self-check).

const VALID_YAML = `version: 7\nvalues:\n  traceSampling: 0.25\n  strict: true\n  stage: canary\n`;
const BROKEN_YAML = "version: 1\nvalues:\n  foo: [unterminated\n";
const MISSING_VERSION_YAML = "values:\n  foo: 1\n";

let tmpRoot: string;
let counter = 0;
const nextPath = (): string => {
  counter += 1;
  return join(tmpRoot, `own-${counter}.yaml`);
};

beforeAll(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), "tianqi-config-file-own-"));
});

afterAll(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("createFileConfig — adapter-specific invariants", () => {
  it("test_factory_requires_file_path_at_type_layer", () => {
    // Factory parameter type forces filePath; omitting it is a TS error.
    // @ts-expect-error filePath is required
    const attempt = () => createFileConfig({});
    expect(typeof attempt).toBe("function");
  });

  it("test_init_with_nonexistent_file_rejects_with_tq_inf_011", async () => {
    const adapter = createFileConfig({ filePath: join(tmpRoot, "does-not-exist.yaml") });
    await expect(adapter.init()).rejects.toThrow(/TQ-INF-011/);
  });

  it("test_init_with_invalid_yaml_rejects_with_tq_con_008", async () => {
    const filePath = nextPath();
    await writeFile(filePath, BROKEN_YAML, "utf8");
    const adapter = createFileConfig({ filePath });
    await expect(adapter.init()).rejects.toThrow(/TQ-CON-008/);
  });

  it("test_init_with_missing_version_field_rejects_with_tq_con_008", async () => {
    const filePath = nextPath();
    await writeFile(filePath, MISSING_VERSION_YAML, "utf8");
    const adapter = createFileConfig({ filePath });
    await expect(adapter.init()).rejects.toThrow(/TQ-CON-008/);
  });

  it("test_health_check_reflects_file_readability_without_throwing", async () => {
    const filePath = nextPath();
    await writeFile(filePath, VALID_YAML, "utf8");
    const adapter = createFileConfig({ filePath, healthCheckTimeoutMs: 500 });
    await adapter.init();
    try {
      const healthy = await adapter.healthCheck();
      expect(healthy.healthy).toBe(true);
      expect(healthy.details["filePath"]).toBe(filePath);
      expect(healthy.details["fileReadable"]).toBe(true);
      expect(healthy.details["fileYamlVersion"]).toBe("7");
      await unlink(filePath);
      const afterDelete = await adapter.healthCheck();
      // Contract: even when the file vanishes mid-run, healthCheck must return cleanly.
      expect(afterDelete.healthy).toBe(false);
      expect(afterDelete.details["fileReadable"]).toBe(false);
      expect(typeof afterDelete.details["lastError"]).toBe("string");
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_object_keys_exposes_only_union_of_three_contracts_plus_reload_no_extras", async () => {
    const filePath = nextPath();
    await writeFile(filePath, VALID_YAML, "utf8");
    const adapter = createFileConfig({ filePath });
    // Step 12 extends the Adapter with reload() — outside ConfigPort / AdapterFoundation
    // / ConfigContractProbe but inside the FileConfig type. This test asserts the exact
    // key union so a silent extra method (e.g. an accidental debug getter) cannot slip
    // into the public surface unnoticed.
    const expected = new Set([
      "adapterName",
      "__configProbe",
      "getActiveConfig",
      "preview",
      "activate",
      "rollback",
      "getByVersion",
      "getAuditTrail",
      "setAuditFailureMode",
      "init",
      "shutdown",
      "healthCheck",
      "reload"
    ]);
    const actual = new Set(Object.keys(adapter));
    expect(actual).toEqual(expected);
  });
});
