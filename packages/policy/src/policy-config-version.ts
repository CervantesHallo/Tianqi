import type { PolicyConfigurationRoot } from "./policy-configuration-root.js";

export type PolicyConfigVersionStatus =
  | "draft"
  | "validated"
  | "active"
  | "rolled_back"
  | "rejected";

export type PolicyConfigVersionRecord = {
  readonly configVersion: string;
  readonly status: PolicyConfigVersionStatus;
  readonly config: PolicyConfigurationRoot;
  readonly createdAt: string;
  readonly activatedAt: string | null;
  readonly rolledBackAt: string | null;
  readonly previousVersion: string | null;
  readonly summary: string;
};

export const createDraftVersionRecord = (
  config: PolicyConfigurationRoot,
  summary: string
): PolicyConfigVersionRecord => ({
  configVersion: config.configVersion,
  status: "draft",
  config,
  createdAt: new Date().toISOString(),
  activatedAt: null,
  rolledBackAt: null,
  previousVersion: null,
  summary
});
