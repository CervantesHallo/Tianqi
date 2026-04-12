import type { ConfigVersion, Result } from "@tianqi/shared";

export type RuntimeConfig = {
  readonly version: ConfigVersion;
  readonly values: Record<string, string | number | boolean>;
};

export type ConfigPortError = {
  readonly message: string;
};

export type ConfigPort = {
  getActiveConfig(): Promise<Result<RuntimeConfig, ConfigPortError>>;
};
