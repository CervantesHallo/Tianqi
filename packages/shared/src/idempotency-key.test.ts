import { describe, expect, it } from "vitest";

import { createIdempotencyKey } from "./idempotency-key.js";

describe("idempotency key", () => {
  it("creates a valid idempotency key", () => {
    expect(createIdempotencyKey("idem-001")).toBe("idem-001");
  });

  it("rejects empty idempotency key", () => {
    expect(() => createIdempotencyKey("   ")).toThrow("IdempotencyKey must be a non-empty string");
  });
});
