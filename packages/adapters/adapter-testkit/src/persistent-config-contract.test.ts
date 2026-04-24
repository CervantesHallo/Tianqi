import { describe, expect, it } from "vitest";

import { definePersistentConfigContractTests } from "./index.js";

describe("@tianqi/adapter-testkit persistent Config contract exports", () => {
  it("exports definePersistentConfigContractTests as a callable function", () => {
    expect(typeof definePersistentConfigContractTests).toBe("function");
  });
});
