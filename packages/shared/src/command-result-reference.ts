import type { Brand } from "./brand.js";

export type CommandResultReference = Brand<string, "CommandResultReference">;

export const createCommandResultReference = (value: string): CommandResultReference => {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error("CommandResultReference must be a non-empty string");
  }
  return normalized as CommandResultReference;
};
