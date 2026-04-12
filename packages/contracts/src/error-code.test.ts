import { describe, expect, it } from "vitest";

import { ERROR_CODES } from "./error-code.js";

describe("error codes", () => {
  it("uses stable structured prefixes", () => {
    expect(ERROR_CODES.DOMAIN_VALIDATION_FAILED.startsWith("TQ-DOM-")).toBe(true);
    expect(ERROR_CODES.APPLICATION_CONFLICT.startsWith("TQ-APP-")).toBe(true);
    expect(ERROR_CODES.CONTRACT_VERSION_INCOMPATIBLE.startsWith("TQ-CON-")).toBe(true);
  });
});
