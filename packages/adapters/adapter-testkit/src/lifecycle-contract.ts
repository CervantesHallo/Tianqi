import { describe } from "vitest";

import type { AdapterFoundation } from "@tianqi/ports";

import type { AdapterFoundationFactory } from "./adapter-foundation-factory.js";

export const defineLifecycleContractTests = <T extends AdapterFoundation = AdapterFoundation>(
  _factory: AdapterFoundationFactory<T>
): void => {
  describe("[adapter-testkit] Lifecycle contract", () => {});
};
