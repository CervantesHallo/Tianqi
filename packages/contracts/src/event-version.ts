import type { Brand } from "@tianqi/shared";

export type EventVersion = Brand<string, "EventVersion">;

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

export const createEventVersion = (value: string): EventVersion => {
  if (!SEMVER_PATTERN.test(value)) {
    throw new Error("EventVersion must follow semver format like 1.0.0");
  }
  return value as EventVersion;
};
