import { describe, expect, it } from "vitest";

import { definePersistentEventStoreContractTests } from "./index.js";

describe("@tianqi/adapter-testkit persistent contract exports", () => {
  it("exports definePersistentEventStoreContractTests as a callable function", () => {
    expect(typeof definePersistentEventStoreContractTests).toBe("function");
  });
});
