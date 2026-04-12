import type { Brand } from "./brand.js";

export type SinkRecoveryReferenceId = Brand<string, "SinkRecoveryReferenceId">;

export const createSinkRecoveryReferenceId = (value: string): SinkRecoveryReferenceId => {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error("SinkRecoveryReferenceId must be a non-empty string");
  }
  return normalized as SinkRecoveryReferenceId;
};
