import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AdapterFoundation, ConfigPort, RuntimeConfig } from "@tianqi/ports";

import type { ConfigAuditEntry, ConfigContractProbe } from "./config-contract-probe.js";

export type ConfigAdapterUnderTest = ConfigPort & AdapterFoundation & ConfigContractProbe;

export type ConfigAdapterFactory<T extends ConfigAdapterUnderTest = ConfigAdapterUnderTest> = () =>
  | T
  | Promise<T>;

export type ConfigContractOptions = Readonly<Record<string, never>>;

// Narrow helpers that make the it-block bodies short and declarative. The contract suite
// is intentionally ignorant of the Adapter's storage shape — it only exercises the Port
// methods and the probe hooks documented in ConfigContractProbe.

const unwrapRuntimeConfig = <E>(
  result: { ok: true; value: RuntimeConfig } | { ok: false; error: E }
): RuntimeConfig => {
  if (!result.ok) {
    throw new Error(`expected ok result, got error: ${JSON.stringify(result.error)}`);
  }
  return result.value;
};

export const defineConfigContractTests = <
  T extends ConfigAdapterUnderTest = ConfigAdapterUnderTest
>(
  adapterName: string,
  factory: ConfigAdapterFactory<T>,
  _options?: ConfigContractOptions
): void => {
  describe(`[adapter-testkit] Config contract — ${adapterName}`, () => {
    let adapter: T;

    beforeEach(async () => {
      adapter = await factory();
      await adapter.init();
    });

    afterEach(async () => {
      await adapter.shutdown();
    });

    describe("category 1: read path through getActiveConfig()", () => {
      it("test_get_active_config_before_any_activation_returns_structured_error_not_empty_value", async () => {
        // Contract: the Adapter does NOT invent an "empty active config". Callers must see
        // a structured error so they know to trigger a first activation or fall back.
        const result = await adapter.getActiveConfig();
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(typeof result.error.message).toBe("string");
        expect(result.error.message.length).toBeGreaterThan(0);
      });

      it("test_get_active_config_after_activate_returns_same_values_round_trip", async () => {
        const version = adapter.preview({ traceSampling: 0.1, maxRetries: 3, strict: true });
        const activateResult = await adapter.activate(version);
        expect(activateResult.ok).toBe(true);
        const active = unwrapRuntimeConfig(await adapter.getActiveConfig());
        expect(active.version).toBe(version);
        expect(active.values).toEqual({ traceSampling: 0.1, maxRetries: 3, strict: true });
      });

      it("test_get_active_config_reflects_latest_activation_not_historical_preview", async () => {
        // After preview v1 → activate v1 → preview v2 → activate v2, getActiveConfig must
        // report v2. This proves activate() flips the active pointer rather than the
        // adapter silently tracking "highest previewed version".
        const v1 = adapter.preview({ stage: "canary" });
        await adapter.activate(v1);
        const v2 = adapter.preview({ stage: "fleet" });
        await adapter.activate(v2);
        const active = unwrapRuntimeConfig(await adapter.getActiveConfig());
        expect(active.version).toBe(v2);
        expect(active.values["stage"]).toBe("fleet");
      });

      it("test_get_active_config_returned_value_is_immutable_from_caller_perspective", async () => {
        // Adapters must defensively copy so that callers mutating the returned object do
        // not corrupt the stored snapshot. Mirrors 补充文档 §5.4.
        const version = adapter.preview({ flag: "original" });
        await adapter.activate(version);
        const firstRead = unwrapRuntimeConfig(await adapter.getActiveConfig());
        (firstRead.values as Record<string, unknown>)["flag"] = "mutated-by-caller";
        const secondRead = unwrapRuntimeConfig(await adapter.getActiveConfig());
        expect(secondRead.values["flag"]).toBe("original");
      });
    });

    describe("category 2: preview/activate/rollback state machine", () => {
      it("test_preview_returns_monotonically_increasing_versions", async () => {
        const v1 = adapter.preview({ slot: "a" });
        const v2 = adapter.preview({ slot: "b" });
        const v3 = adapter.preview({ slot: "c" });
        expect(Number(v2)).toBeGreaterThan(Number(v1));
        expect(Number(v3)).toBeGreaterThan(Number(v2));
      });

      it("test_preview_of_identical_content_still_yields_a_new_distinct_version", async () => {
        // Contract: preview never silently dedups by content hash. Two calls with the same
        // values return two distinct versions so the audit trail remains injective —
        // one preview, one version, no collisions (补充文档 §5.3).
        const v1 = adapter.preview({ value: "same" });
        const v2 = adapter.preview({ value: "same" });
        expect(v1).not.toBe(v2);
      });

      it("test_preview_alone_does_not_change_the_active_config", async () => {
        // Preview is purely additive. Until activate() is called, getActiveConfig must
        // still return whatever was active before (or the "no active" error if none).
        const before = await adapter.getActiveConfig();
        adapter.preview({ candidate: "unactivated" });
        const after = await adapter.getActiveConfig();
        expect(after.ok).toBe(before.ok);
      });

      it("test_activate_of_unknown_version_returns_tq_con_006_without_flipping_active_pointer", async () => {
        const v1 = adapter.preview({ real: true });
        await adapter.activate(v1);
        // Pick a number guaranteed not to have been previewed.
        const bogusVersion = 99_999 as unknown as Parameters<typeof adapter.activate>[0];
        const result = await adapter.activate(bogusVersion);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toMatch(/^TQ-CON-006:/);
        // Active pointer must still be v1 — the failed activation did not corrupt state.
        const active = unwrapRuntimeConfig(await adapter.getActiveConfig());
        expect(active.version).toBe(v1);
      });

      it("test_rollback_to_previously_activated_version_restores_those_values", async () => {
        const v1 = adapter.preview({ payload: "original" });
        await adapter.activate(v1);
        const v2 = adapter.preview({ payload: "updated" });
        await adapter.activate(v2);
        const rollbackResult = await adapter.rollback(v1);
        expect(rollbackResult.ok).toBe(true);
        const active = unwrapRuntimeConfig(await adapter.getActiveConfig());
        expect(active.version).toBe(v1);
        expect(active.values["payload"]).toBe("original");
      });

      it("test_rollback_to_unknown_version_returns_tq_con_006_and_preserves_active", async () => {
        const v1 = adapter.preview({ kept: true });
        await adapter.activate(v1);
        const bogusVersion = 88_888 as unknown as Parameters<typeof adapter.rollback>[0];
        const result = await adapter.rollback(bogusVersion);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toMatch(/^TQ-CON-006:/);
        const active = unwrapRuntimeConfig(await adapter.getActiveConfig());
        expect(active.version).toBe(v1);
      });
    });

    describe("category 3: version-keyed read via probe", () => {
      it("test_get_by_version_returns_exactly_the_values_that_were_previewed", async () => {
        const version = adapter.preview({ key: "value", count: 7 });
        const result = adapter.getByVersion(version);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.version).toBe(version);
        expect(result.value.values).toEqual({ key: "value", count: 7 });
      });

      it("test_get_by_version_for_unknown_version_returns_tq_con_006", async () => {
        // No previews yet.
        const bogusVersion = 77_777 as unknown as Parameters<typeof adapter.getByVersion>[0];
        const result = adapter.getByVersion(bogusVersion);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toMatch(/^TQ-CON-006:/);
      });

      it("test_get_by_version_returns_historical_preview_even_after_newer_activations", async () => {
        // Historical readability: the Adapter does NOT garbage-collect previous versions
        // when a newer version is activated. Audit-trail reconstruction relies on this.
        const v1 = adapter.preview({ era: "legacy" });
        await adapter.activate(v1);
        const v2 = adapter.preview({ era: "modern" });
        await adapter.activate(v2);
        const legacy = adapter.getByVersion(v1);
        expect(legacy.ok).toBe(true);
        if (!legacy.ok) return;
        expect(legacy.value.values["era"]).toBe("legacy");
      });
    });

    describe("category 4: audit trail and activation atomicity", () => {
      it("test_audit_trail_records_every_successful_activation_in_order", async () => {
        const v1 = adapter.preview({ step: 1 });
        const v2 = adapter.preview({ step: 2 });
        const v3 = adapter.preview({ step: 3 });
        await adapter.activate(v1);
        await adapter.activate(v2);
        await adapter.activate(v3);
        const trail = adapter.getAuditTrail();
        expect(trail).toHaveLength(3);
        expect(trail[0]?.fromVersion).toBeNull();
        expect(trail[0]?.toVersion).toBe(v1);
        expect(trail[1]?.fromVersion).toBe(v1);
        expect(trail[1]?.toVersion).toBe(v2);
        expect(trail[2]?.fromVersion).toBe(v2);
        expect(trail[2]?.toVersion).toBe(v3);
      });

      it("test_audit_trail_marks_rollback_cause_distinctly_from_activate", async () => {
        const v1 = adapter.preview({ s: "1" });
        const v2 = adapter.preview({ s: "2" });
        await adapter.activate(v1);
        await adapter.activate(v2);
        await adapter.rollback(v1);
        const trail = adapter.getAuditTrail();
        const causes = trail.map((entry: ConfigAuditEntry) => entry.cause);
        expect(causes).toEqual(["activate", "activate", "rollback"]);
      });

      it("test_audit_append_failure_rolls_back_activation_and_returns_tq_con_007", async () => {
        const v1 = adapter.preview({ pre: "audit" });
        await adapter.activate(v1);
        const v2 = adapter.preview({ new: "value" });
        // Engage audit-failure fault injection.
        adapter.setAuditFailureMode(true);
        const result = await adapter.activate(v2);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toMatch(/^TQ-CON-007:/);
        // Contract: when audit append fails the activation is rolled back, so the active
        // pointer must remain on v1 and no new audit entry for v2 must appear.
        const active = unwrapRuntimeConfig(await adapter.getActiveConfig());
        expect(active.version).toBe(v1);
        const trail = adapter.getAuditTrail();
        expect(trail).toHaveLength(1);
        expect(trail[0]?.toVersion).toBe(v1);
      });

      it("test_audit_trail_is_returned_as_immutable_snapshot_and_not_live_reference", async () => {
        const v1 = adapter.preview({ snap: "shot" });
        await adapter.activate(v1);
        const firstSnapshot = adapter.getAuditTrail();
        // Mutating the returned array must not mutate the Adapter's internal trail.
        (firstSnapshot as ConfigAuditEntry[]).pop();
        const secondSnapshot = adapter.getAuditTrail();
        expect(secondSnapshot).toHaveLength(1);
      });

      it("test_disabling_audit_failure_mode_restores_normal_activation_path", async () => {
        const v1 = adapter.preview({ a: 1 });
        await adapter.activate(v1);
        const v2 = adapter.preview({ a: 2 });
        adapter.setAuditFailureMode(true);
        const failed = await adapter.activate(v2);
        expect(failed.ok).toBe(false);
        adapter.setAuditFailureMode(false);
        const retried = await adapter.activate(v2);
        expect(retried.ok).toBe(true);
        const active = unwrapRuntimeConfig(await adapter.getActiveConfig());
        expect(active.version).toBe(v2);
      });
    });

    describe("category 5: integration with AdapterFoundation", () => {
      it("test_get_active_config_before_init_rejects_with_tq_inf_not_initialized", async () => {
        const freshAdapter = await factory();
        const result = await freshAdapter.getActiveConfig();
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toMatch(/^TQ-INF-003:/);
      });

      it("test_get_active_config_after_shutdown_rejects_with_tq_inf_already_shut_down", async () => {
        const freshAdapter = await factory();
        await freshAdapter.init();
        await freshAdapter.shutdown();
        const result = await freshAdapter.getActiveConfig();
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toMatch(/^TQ-INF-004:/);
      });

      it("test_health_check_reports_healthy_true_after_init_and_false_after_shutdown_without_throwing", async () => {
        const freshAdapter = await factory();
        await freshAdapter.init();
        const healthy = await freshAdapter.healthCheck();
        expect(healthy.healthy).toBe(true);
        await freshAdapter.shutdown();
        const unhealthy = await freshAdapter.healthCheck();
        expect(unhealthy.healthy).toBe(false);
      });
    });
  });
};
