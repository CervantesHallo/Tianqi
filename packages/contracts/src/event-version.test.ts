import { describe, expect, it } from "vitest";

import { createEventVersion } from "./event-version.js";

describe("event version", () => {
  it("accepts semantic versions", () => {
    const version = createEventVersion("1.0.0");
    expect(version).toBe("1.0.0");
  });

  it("rejects non-semver values", () => {
    expect(() => createEventVersion("v1")).toThrow("EventVersion must follow semver format like 1.0.0");
  });
});
