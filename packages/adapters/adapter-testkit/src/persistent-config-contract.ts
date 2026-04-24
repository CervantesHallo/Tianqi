import { setTimeout as scheduleTimer } from "node:timers";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ConfigPortError, RuntimeConfig } from "@tianqi/ports";
import type { Result } from "@tianqi/shared";

import type { ConfigAdapterUnderTest } from "./config-contract.js";
import type { ConfigAuditEntry } from "./config-contract-probe.js";

// Persistent Config contract — Step 12 Sprint-D-finale companion to defineConfigContractTests.
//
// Unlike the basic contract (which runs against a single Adapter instance whose state
// vanishes with the test), the persistent contract asserts behaviour ACROSS
// init/shutdown cycles that share the same on-disk footprint. Adapters that advertise
// persistence (cross-restart version history + hot reload + reload-failure recovery)
// mount this suite; Adapters that are in-memory-only (@tianqi/config-memory) do NOT.
//
// Three categories (≥12 it blocks):
//   P1 Cross-restart recovery — active pointer, known versions, audit trail, counter,
//      cold-start fallback when no history exists yet.
//   P2 Hot reload semantics — manual reload, autoActivate policy, watchMode off.
//   P3 Hot reload failure recovery — corrupt YAML, deleted YAML, missing version field;
//      in every case the previously-active version and audit trail must survive unharmed
//      (Step 10's 1PC + compensation invariant extended to the reload path).
//
// Design deviation from the Step 12 instruction literal: callback signatures carry a
// `session` parameter instead of being zero-arg closures. This mirrors Step 5's
// definePersistentEventStoreContractTests and avoids hidden global state inside the
// options object; see docs/phase8/12 §C for the full rationale.

// One per-test isolation unit — the config file path + the history directory path for
// this iteration. Two distinct tests never share a session; two factory() calls with the
// same session simulate process restart against the same on-disk footprint.
//
// `autoActivate` defaults to the Adapter's own default (for @tianqi/config-file that is
// "never"). Individual tests override it when they need to exercise the onLoad path. The
// factory must honour this hint; Adapters that do not support autoActivate at all should
// throw from the factory when onLoad is requested, rather than silently defaulting.
export type PersistentConfigTestSession = Readonly<{
  filePath: string;
  historyDirectory: string;
  autoActivate?: "never" | "onLoad";
}>;

// Adapters that opt into persistent contracts must expose a reload() method on top of
// the basic ConfigAdapterUnderTest. reload() returns ok when a new version was staged
// (and activated per autoActivate policy) or when the file content was unchanged since
// the last load; it returns a structured error when the file read / parse / validation
// failed, and in that case the previous active version MUST remain live.
export type PersistentConfigAdapterUnderTest = ConfigAdapterUnderTest & {
  reload(): Promise<Result<void, ConfigPortError>>;
};

export type PersistentConfigAdapterFactory<
  T extends PersistentConfigAdapterUnderTest = PersistentConfigAdapterUnderTest
> = (session: PersistentConfigTestSession) => T | Promise<T>;

// Callbacks carry the session so the contract suite never has to reach into adapter
// internals to find out where the YAML lives. The factory signature plus these callbacks
// are the only surfaces the suite relies on.
export type PersistentConfigContractOptions = Readonly<{
  scratchDirectory: string;
  writeYamlContent: (session: PersistentConfigTestSession, content: string) => Promise<void>;
  corruptYaml: (session: PersistentConfigTestSession) => Promise<void>;
  deleteYaml: (session: PersistentConfigTestSession) => Promise<void>;
}>;

const BOOTSTRAP_YAML = `version: 1\nvalues:\n  stage: bootstrap\n`;

// YAML templates used to drive the reload path. Each produces a valid file with a
// distinct `values.marker` payload so tests can confirm "the reload pulled in THIS
// content and not some cached or stale version".
const buildYaml = (marker: string, fileSchemaVersion = 1): string =>
  `version: ${fileSchemaVersion}\nvalues:\n  marker: ${JSON.stringify(marker)}\n`;

const MALFORMED_BUT_PARSES_YAML = "values:\n  marker: oops\n"; // Missing root `version`

let sessionCounter = 0;

const nextSession = (scratchDirectory: string): PersistentConfigTestSession => {
  sessionCounter += 1;
  const base = `${scratchDirectory}/persistent-${sessionCounter}`;
  return {
    filePath: `${base}.yaml`,
    historyDirectory: `${base}.tianqi-history`
  };
};

const unwrapRuntimeConfig = <E>(
  result: { ok: true; value: RuntimeConfig } | { ok: false; error: E }
): RuntimeConfig => {
  if (!result.ok) {
    throw new Error(`expected ok result, got error: ${JSON.stringify(result.error)}`);
  }
  return result.value;
};

// Poll-helper used by the hot-reload tests. The contract does not promise that a
// reload-triggered new version appears in <N> milliseconds; it promises that a new
// version appears. We poll via probe.getByVersion with a bounded iteration count so
// the assertions stay deterministic regardless of fs.watch debounce timing.
const waitForProbeVersion = async (
  adapter: PersistentConfigAdapterUnderTest,
  targetVersionNumber: number,
  attempts = 50,
  delayMs = 20
): Promise<boolean> => {
  for (let i = 0; i < attempts; i += 1) {
    const probed = adapter.getByVersion(
      targetVersionNumber as unknown as Parameters<typeof adapter.getByVersion>[0]
    );
    if (probed.ok) return true;
    await new Promise<void>((resolve) => {
      scheduleTimer(resolve, delayMs);
    });
  }
  return false;
};

export const definePersistentConfigContractTests = <
  T extends PersistentConfigAdapterUnderTest = PersistentConfigAdapterUnderTest
>(
  adapterName: string,
  factory: PersistentConfigAdapterFactory<T>,
  options: PersistentConfigContractOptions
): void => {
  describe(`[adapter-testkit] Config persistent contract — ${adapterName}`, () => {
    let session: PersistentConfigTestSession;

    beforeEach(async () => {
      session = nextSession(options.scratchDirectory);
      await options.writeYamlContent(session, BOOTSTRAP_YAML);
    });

    // Adapters open file handles / watchers; each test is responsible for its own
    // shutdown. The contract here does not force afterEach shutdown because tests that
    // simulate "process crashed without shutdown" need the freedom to leave the first
    // Adapter un-shutdown and re-init a second instance; afterEach is a no-op so tests
    // own their cleanup inside try/finally blocks.
    afterEach(() => {
      // intentionally empty — per-test cleanup inside the its.
    });

    describe("category P1: cross-restart recovery", () => {
      it("test_restart_preserves_active_version_with_same_history_directory", async () => {
        const first = await factory(session);
        await first.init();
        try {
          const v = first.preview({ restart: "round-1" });
          const activateResult = await first.activate(v);
          expect(activateResult.ok).toBe(true);
        } finally {
          await first.shutdown();
        }
        const second = await factory(session);
        await second.init();
        try {
          const active = unwrapRuntimeConfig(await second.getActiveConfig());
          expect(active.values["restart"]).toBe("round-1");
        } finally {
          await second.shutdown();
        }
      });

      it("test_restart_preserves_previewed_versions_readable_by_get_by_version", async () => {
        const first = await factory(session);
        await first.init();
        let stashedVersion: number;
        try {
          const v1 = first.preview({ keep: "a" });
          const v2 = first.preview({ keep: "b" });
          await first.activate(v2);
          stashedVersion = Number(v1);
        } finally {
          await first.shutdown();
        }
        const second = await factory(session);
        await second.init();
        try {
          const lookup = second.getByVersion(
            stashedVersion as unknown as Parameters<typeof second.getByVersion>[0]
          );
          expect(lookup.ok).toBe(true);
          if (!lookup.ok) return;
          expect(lookup.value.values["keep"]).toBe("a");
        } finally {
          await second.shutdown();
        }
      });

      it("test_restart_preserves_full_audit_trail_in_order_and_cause", async () => {
        const first = await factory(session);
        await first.init();
        try {
          const v1 = first.preview({ round: 1 });
          const v2 = first.preview({ round: 2 });
          const v3 = first.preview({ round: 3 });
          await first.activate(v1);
          await first.activate(v2);
          await first.rollback(v1);
          await first.activate(v3);
        } finally {
          await first.shutdown();
        }
        const second = await factory(session);
        await second.init();
        try {
          const trail = second.getAuditTrail();
          expect(trail).toHaveLength(4);
          const causes = trail.map((entry: ConfigAuditEntry) => entry.cause);
          expect(causes).toEqual(["activate", "activate", "rollback", "activate"]);
        } finally {
          await second.shutdown();
        }
      });

      it("test_restart_preserves_next_version_counter_monotonicity", async () => {
        const first = await factory(session);
        await first.init();
        let lastVersionFromFirst: number;
        try {
          first.preview({ counter: "a" });
          first.preview({ counter: "b" });
          const vThird = first.preview({ counter: "c" });
          lastVersionFromFirst = Number(vThird);
        } finally {
          await first.shutdown();
        }
        const second = await factory(session);
        await second.init();
        try {
          const nextFromSecond = second.preview({ counter: "d" });
          expect(Number(nextFromSecond)).toBeGreaterThan(lastVersionFromFirst);
        } finally {
          await second.shutdown();
        }
      });

      it("test_restart_without_existing_history_cold_starts_with_next_version_one", async () => {
        // Freshly-allocated session — history directory does not exist. Adapter must
        // cold-start exactly as in Step 11's semantics: no prior versions, counter
        // begins at 1, getActiveConfig returns error (no active yet).
        const isolated = nextSession(options.scratchDirectory);
        await options.writeYamlContent(isolated, BOOTSTRAP_YAML);
        const adapter = await factory(isolated);
        await adapter.init();
        try {
          const active = await adapter.getActiveConfig();
          expect(active.ok).toBe(false);
          const v = adapter.preview({ cold: true });
          expect(Number(v)).toBe(2); // v1 is YAML bootstrap, next preview is v2
        } finally {
          await adapter.shutdown();
        }
      });
    });

    describe("category P2: hot reload semantics", () => {
      it("test_manual_reload_after_yaml_change_produces_new_version", async () => {
        const adapter = await factory(session);
        await adapter.init();
        try {
          // Snapshot the initial "next version" by peeking at a preview counter.
          const beforeCounter = Number(adapter.preview({ probe: "before" }));
          await options.writeYamlContent(session, buildYaml("reloaded"));
          const reloadResult = await adapter.reload();
          expect(reloadResult.ok).toBe(true);
          const found = await waitForProbeVersion(adapter, beforeCounter + 1);
          expect(found).toBe(true);
        } finally {
          await adapter.shutdown();
        }
      });

      it("test_auto_activate_never_only_stages_new_version_without_changing_active", async () => {
        // Factory default is autoActivate="never"; reload should stage but not flip.
        const adapter = await factory(session);
        await adapter.init();
        try {
          const initial = adapter.preview({ active: "initial" });
          await adapter.activate(initial);
          await options.writeYamlContent(session, buildYaml("staged-only"));
          const reloadResult = await adapter.reload();
          expect(reloadResult.ok).toBe(true);
          // Active MUST still be the pre-reload version. The new YAML is merely staged.
          const active = unwrapRuntimeConfig(await adapter.getActiveConfig());
          expect(active.values["active"]).toBe("initial");
        } finally {
          await adapter.shutdown();
        }
      });

      it("test_auto_activate_on_load_activates_new_version_via_reload", async () => {
        // Session carries the autoActivate hint so the factory can wire the Adapter
        // appropriately. Adapters that don't honour onLoad can throw from factory() to
        // signal "I can't satisfy this mode" — silent fallbacks would mask a contract
        // hole. For @tianqi/config-file this routes through its FileConfigOptions.
        const autoSession: PersistentConfigTestSession = {
          filePath: `${options.scratchDirectory}/auto-activate-${sessionCounter + 100}.yaml`,
          historyDirectory: `${options.scratchDirectory}/auto-activate-${sessionCounter + 100}.tianqi-history`,
          autoActivate: "onLoad"
        };
        await options.writeYamlContent(autoSession, BOOTSTRAP_YAML);
        const adapter = await factory(autoSession);
        await adapter.init();
        try {
          const initialActive = adapter.preview({ active: "before-reload" });
          await adapter.activate(initialActive);
          await options.writeYamlContent(autoSession, buildYaml("after-reload"));
          const reloadResult = await adapter.reload();
          expect(reloadResult.ok).toBe(true);
          const active = unwrapRuntimeConfig(await adapter.getActiveConfig());
          expect(active.values["marker"]).toBe("after-reload");
        } finally {
          await adapter.shutdown();
        }
      });

      it("test_watch_mode_off_does_not_observe_file_changes_on_its_own", async () => {
        // Factory default is watchMode="manual" — no automatic fs watcher fires. The
        // contract only asserts that without the caller invoking reload() or nudging
        // the file through the adapter's API, the active version does not magically
        // change in response to a file write. This proves the Adapter honours the
        // "manual" contract.
        const adapter = await factory(session);
        await adapter.init();
        try {
          const initial = adapter.preview({ active: "pinned" });
          await adapter.activate(initial);
          await options.writeYamlContent(session, buildYaml("should-not-activate"));
          // Wait enough that any sneaky fs.watch handler would have fired.
          await new Promise<void>((resolve) => {
            scheduleTimer(resolve, 150);
          });
          const active = unwrapRuntimeConfig(await adapter.getActiveConfig());
          expect(active.values["active"]).toBe("pinned");
        } finally {
          await adapter.shutdown();
        }
      });

      it("test_reload_of_unchanged_yaml_is_idempotent_and_produces_no_new_version", async () => {
        // The whole point of content-hash comparison during reload is to avoid
        // producing junk audit entries when fs.watch fires on a mere `touch`. Verifies
        // that two reload() calls with no file change do not advance the counter or
        // append to the audit trail.
        const adapter = await factory(session);
        await adapter.init();
        try {
          const versionsBefore = adapter.preview({ probe: "before" });
          const counterAnchor = Number(versionsBefore);
          const auditBefore = adapter.getAuditTrail().length;
          await adapter.reload();
          await adapter.reload();
          const afterCounter = Number(adapter.preview({ probe: "after" }));
          // Only the before/after probe calls should have moved the counter — the two
          // idempotent reloads must not contribute.
          expect(afterCounter).toBe(counterAnchor + 1);
          expect(adapter.getAuditTrail().length).toBe(auditBefore);
        } finally {
          await adapter.shutdown();
        }
      });

      it("test_reload_after_corrupt_and_repair_recovers_normal_reload", async () => {
        // Operators can and do introduce broken YAML mid-edit, realise the mistake,
        // then rewrite. The adapter must recover cleanly — a prior TQ-CON-008 must
        // not leave the reload path in a wedged state.
        const adapter = await factory(session);
        await adapter.init();
        try {
          const initial = adapter.preview({ recovery: "pre" });
          await adapter.activate(initial);
          await options.corruptYaml(session);
          const failed = await adapter.reload();
          expect(failed.ok).toBe(false);
          await options.writeYamlContent(session, buildYaml("after-repair"));
          const repaired = await adapter.reload();
          expect(repaired.ok).toBe(true);
          // Active still "pre" because autoActivate="never"; new version is staged.
          const active = unwrapRuntimeConfig(await adapter.getActiveConfig());
          expect(active.values["recovery"]).toBe("pre");
        } finally {
          await adapter.shutdown();
        }
      });
    });

    describe("category P3: hot reload failure recovery", () => {
      it("test_corrupt_yaml_during_reload_preserves_active_version_and_audit", async () => {
        const adapter = await factory(session);
        await adapter.init();
        try {
          const initial = adapter.preview({ safety: "kept" });
          await adapter.activate(initial);
          const trailBefore = adapter.getAuditTrail();
          await options.corruptYaml(session);
          const reloadResult = await adapter.reload();
          // The 1PC + compensation invariant extends to reload: a failed reload MUST
          // leave activeVersion and auditTrail exactly where they were.
          expect(reloadResult.ok).toBe(false);
          const active = unwrapRuntimeConfig(await adapter.getActiveConfig());
          expect(active.values["safety"]).toBe("kept");
          const trailAfter = adapter.getAuditTrail();
          expect(trailAfter).toEqual(trailBefore);
        } finally {
          await adapter.shutdown();
        }
      });

      it("test_deleted_yaml_during_reload_preserves_active_version_and_reflects_in_health_check", async () => {
        const adapter = await factory(session);
        await adapter.init();
        try {
          const initial = adapter.preview({ survival: "intact" });
          await adapter.activate(initial);
          await options.deleteYaml(session);
          const reloadResult = await adapter.reload();
          expect(reloadResult.ok).toBe(false);
          const active = unwrapRuntimeConfig(await adapter.getActiveConfig());
          expect(active.values["survival"]).toBe("intact");
          const health = await adapter.healthCheck();
          // healthCheck must NOT throw and should surface the failure signal.
          expect(health.healthy).toBe(false);
          expect(typeof health.details["lastError"]).toBe("string");
        } finally {
          await adapter.shutdown();
        }
      });

      it("test_reload_with_missing_version_field_preserves_active_state", async () => {
        const adapter = await factory(session);
        await adapter.init();
        try {
          const initial = adapter.preview({ guarded: true });
          await adapter.activate(initial);
          const auditCountBefore = adapter.getAuditTrail().length;
          await options.writeYamlContent(session, MALFORMED_BUT_PARSES_YAML);
          const reloadResult = await adapter.reload();
          expect(reloadResult.ok).toBe(false);
          if (reloadResult.ok) return;
          // The error message must surface the TQ-CON-008 schema-invalid code so that
          // operator log-scraping pipelines pick up the right code and runbook.
          expect(reloadResult.error.message).toMatch(/TQ-CON-008/);
          const active = unwrapRuntimeConfig(await adapter.getActiveConfig());
          expect((active.values as Record<string, unknown>)["guarded"]).toBe(true);
          expect(adapter.getAuditTrail().length).toBe(auditCountBefore);
        } finally {
          await adapter.shutdown();
        }
      });

      it("test_reload_with_non_primitive_value_preserves_active_state", async () => {
        // Nested values (arrays, maps) violate RuntimeConfig's primitive-only contract.
        // reload must reject with TQ-CON-008 and leave active + audit untouched.
        const adapter = await factory(session);
        await adapter.init();
        try {
          const initial = adapter.preview({ active: "before-bad" });
          await adapter.activate(initial);
          const auditCountBefore = adapter.getAuditTrail().length;
          const nestedYaml = "version: 1\nvalues:\n  nested:\n    deep: oops\n";
          await options.writeYamlContent(session, nestedYaml);
          const reloadResult = await adapter.reload();
          expect(reloadResult.ok).toBe(false);
          if (reloadResult.ok) return;
          expect(reloadResult.error.message).toMatch(/TQ-CON-008/);
          const active = unwrapRuntimeConfig(await adapter.getActiveConfig());
          expect(active.values["active"]).toBe("before-bad");
          expect(adapter.getAuditTrail().length).toBe(auditCountBefore);
        } finally {
          await adapter.shutdown();
        }
      });

      it("test_reload_after_delete_and_rewrite_recovers_normal_reload", async () => {
        // Mirror of the corrupt+repair recovery path, but with the file being absent
        // rather than malformed. A momentary unlink-then-recreate (e.g. from editor
        // "save" that uses unlink+create rather than atomic rename) must not wedge
        // the adapter after the file reappears.
        const adapter = await factory(session);
        await adapter.init();
        try {
          const initial = adapter.preview({ life: "phoenix" });
          await adapter.activate(initial);
          await options.deleteYaml(session);
          const failed = await adapter.reload();
          expect(failed.ok).toBe(false);
          await options.writeYamlContent(session, buildYaml("reborn"));
          const recovered = await adapter.reload();
          expect(recovered.ok).toBe(true);
          const active = unwrapRuntimeConfig(await adapter.getActiveConfig());
          // Active remains the version flipped before the delete — autoActivate="never"
          // means the reborn YAML is staged but not active.
          expect(active.values["life"]).toBe("phoenix");
        } finally {
          await adapter.shutdown();
        }
      });
    });

    describe("category P4: auditFailureMode interaction with reload", () => {
      it("test_audit_failure_mode_during_reload_path_rolls_back_auto_activate_onload", async () => {
        // When autoActivate="onLoad" reload() internally calls recordActivation. If
        // the fault-injection toggle is on at that moment, the activation must roll
        // back exactly as it would for a direct activate() call — Step 10's 1PC +
        // compensation invariant reaches into the reload path unchanged.
        const autoSession: PersistentConfigTestSession = {
          filePath: `${options.scratchDirectory}/auto-fail-${sessionCounter + 200}.yaml`,
          historyDirectory: `${options.scratchDirectory}/auto-fail-${sessionCounter + 200}.tianqi-history`,
          autoActivate: "onLoad"
        };
        await options.writeYamlContent(autoSession, BOOTSTRAP_YAML);
        const adapter = await factory(autoSession);
        await adapter.init();
        try {
          const baseline = adapter.preview({ baseline: true });
          await adapter.activate(baseline);
          const trailBefore = adapter.getAuditTrail().length;
          adapter.setAuditFailureMode(true);
          await options.writeYamlContent(autoSession, buildYaml("should-not-activate"));
          const reloadResult = await adapter.reload();
          expect(reloadResult.ok).toBe(false);
          if (reloadResult.ok) return;
          expect(reloadResult.error.message).toMatch(/TQ-CON-007/);
          const active = unwrapRuntimeConfig(await adapter.getActiveConfig());
          expect(active.values["baseline"]).toBe(true);
          // Audit trail length is unchanged — failure rolled back the attempted
          // activate that reload tried to do on our behalf.
          expect(adapter.getAuditTrail().length).toBe(trailBefore);
        } finally {
          await adapter.shutdown();
        }
      });

      it("test_get_active_config_after_shutdown_still_rejects_despite_persisted_state", async () => {
        // Even with state.json on disk and a restorable active version, getActiveConfig
        // AFTER shutdown must reject with TQ-INF-004. The persistence layer must not
        // short-circuit the lifecycle contract.
        const adapter = await factory(session);
        await adapter.init();
        const v = adapter.preview({ post: "shutdown" });
        await adapter.activate(v);
        await adapter.shutdown();
        const result = await adapter.getActiveConfig();
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toMatch(/^TQ-INF-004:/);
      });

      it("test_health_check_reports_history_directory_diagnostics_in_running_state", async () => {
        // The Step 12 healthCheck details are operator-facing. A minimal smoke test
        // verifies the three new fields (historyDirectory, historyDirectoryWritable,
        // watchMode) surface so log-scraping tools can depend on their presence.
        const adapter = await factory(session);
        await adapter.init();
        try {
          const health = await adapter.healthCheck();
          expect(health.healthy).toBe(true);
          expect(typeof health.details["historyDirectory"]).toBe("string");
          expect(typeof health.details["historyDirectoryWritable"]).toBe("boolean");
          expect(typeof health.details["watchMode"]).toBe("string");
        } finally {
          await adapter.shutdown();
        }
      });
    });
  });
};
