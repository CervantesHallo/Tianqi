import { describe, expect, it } from "vitest";

import { createCommandResultReference } from "./command-result-reference.js";

describe("command result reference", () => {
  it("creates valid command result reference", () => {
    expect(createCommandResultReference("result-ref-001")).toBe("result-ref-001");
  });

  it("rejects empty command result reference", () => {
    expect(() => createCommandResultReference("   ")).toThrow(
      "CommandResultReference must be a non-empty string"
    );
  });
});
