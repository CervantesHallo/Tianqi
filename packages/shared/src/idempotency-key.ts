import type { Brand } from "./brand.js";

export type IdempotencyKey = Brand<string, "IdempotencyKey">;

export const createIdempotencyKey = (value: string): IdempotencyKey => {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error("IdempotencyKey must be a non-empty string");
  }
  return normalized as IdempotencyKey;
};
