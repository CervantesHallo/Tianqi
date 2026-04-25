import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AdapterFoundation, ConfigPort } from "@tianqi/ports";

import { createInMemoryConfig } from "@tianqi/config-memory";
import { createFileConfig } from "@tianqi/config-file";

// Config Adapter swap integration. Same META-RULE A reflection as EventStore /
// Notification swaps: the Phase 1-7 Application layer doesn't directly consume
// ConfigPort — orchestration-ports.ts uses a bespoke PolicyConfigPort shape. Step 18
// validates §3.7 Adapter 替换原则 at the standardised ConfigPort surface via a thin
// "application-layer-style" consumer that reads the active config.
//
// Important nuance: per-adapter setup (priming the active config) IS allowed to
// differ — memory uses the probe.preview/activate path, file writes a YAML file.
// §3.7 governs the **consumer**, not the **setup**. The consumer (`getActiveConfig`)
// is identical for both.

const APPLICATION_CONFIG_VALUES = Object.freeze({
  ranking_policy_name: "score-descending",
  ranking_policy_version: "1.0.0"
});

const consumeConfigFromApplicationLayer = async (
  config: ConfigPort
): Promise<{
  readonly readOk: boolean;
  readonly seenRankingPolicyName: string | number | boolean | null;
}> => {
  const result = await config.getActiveConfig();
  if (!result.ok) {
    return { readOk: false, seenRankingPolicyName: null };
  }
  return {
    readOk: true,
    seenRankingPolicyName: result.value.values["ranking_policy_name"] ?? null
  };
};

let scratchDir: string;

beforeAll(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), "tianqi-step18-config-"));
});

afterAll(async () => {
  await rm(scratchDir, { recursive: true, force: true });
});

type AdapterCase = {
  readonly name: string;
  readonly factoryAndPrime: () => Promise<{
    readonly config: ConfigPort & AdapterFoundation;
    readonly cleanup: () => Promise<void>;
  }>;
};

const cases: readonly AdapterCase[] = [
  {
    name: "memory",
    factoryAndPrime: async () => {
      const config = createInMemoryConfig();
      await config.init();
      // memory adapter's testkit probe is the supported priming path — production
      // callers would call preview/activate via a separate ConfigContractProbe.
      const version = config.preview({ ...APPLICATION_CONFIG_VALUES });
      const activated = await config.activate(version);
      if (!activated.ok) {
        throw new Error(`memory prime failed: ${activated.error.message}`);
      }
      return { config, cleanup: async () => undefined };
    }
  },
  {
    name: "file",
    factoryAndPrime: async () => {
      const filePath = join(scratchDir, "config.yaml");
      await writeFile(
        filePath,
        [
          "version: 1",
          "values:",
          `  ranking_policy_name: ${APPLICATION_CONFIG_VALUES.ranking_policy_name}`,
          `  ranking_policy_version: ${APPLICATION_CONFIG_VALUES.ranking_policy_version}`,
          ""
        ].join("\n"),
        "utf-8"
      );
      const config = createFileConfig({
        filePath,
        autoActivate: "onLoad",
        watchMode: "off"
      });
      await config.init();
      return {
        config,
        cleanup: async () => {
          // tmpdir cleanup is in afterAll; nothing per-case to do.
        }
      };
    }
  }
];

describe.each(cases)("Config Adapter swap: $name", ({ factoryAndPrime }) => {
  it("test_application_layer_reads_active_config_through_port_without_modification", async () => {
    const { config, cleanup } = await factoryAndPrime();
    try {
      const result = await consumeConfigFromApplicationLayer(config);
      expect(result.readOk).toBe(true);
      expect(result.seenRankingPolicyName).toBe(APPLICATION_CONFIG_VALUES.ranking_policy_name);
    } finally {
      await config.shutdown();
      await cleanup();
    }
  });

  it("test_config_health_check_reports_running_after_init_swap_invariant", async () => {
    const { config, cleanup } = await factoryAndPrime();
    try {
      const health = await config.healthCheck();
      expect(health.adapterName).toMatch(/config-(memory|file)/);
      expect(health.healthy).toBe(true);
    } finally {
      await config.shutdown();
      await cleanup();
    }
  });
});
