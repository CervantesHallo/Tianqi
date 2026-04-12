import { describe, expect, it } from "vitest";

import { createSinkRecoveryReferenceId } from "./sink-recovery-reference-id.js";

describe("sink recovery reference id", () => {
  it("creates valid sink recovery reference id", () => {
    expect(createSinkRecoveryReferenceId("sink-recovery-001")).toBe("sink-recovery-001");
  });

  it("rejects empty sink recovery reference id", () => {
    expect(() => createSinkRecoveryReferenceId("   ")).toThrow(
      "SinkRecoveryReferenceId must be a non-empty string"
    );
  });
});
