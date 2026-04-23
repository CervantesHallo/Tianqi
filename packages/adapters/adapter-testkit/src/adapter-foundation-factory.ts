import type { AdapterFoundation } from "@tianqi/ports";

export type AdapterFoundationFactory<T extends AdapterFoundation = AdapterFoundation> = () =>
  | Promise<T>
  | T;
