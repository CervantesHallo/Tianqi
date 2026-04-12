import { describe, expect, it } from "vitest";

import { err, ok } from "./result.js";

describe("result", () => {
  it("creates success result", () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it("creates error result", () => {
    const result = err("failed");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("failed");
    }
  });
});
