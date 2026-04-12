import type { PolicyConfigVersionRecord } from "./policy-config-version.js";

export type PolicyConfigActivationRegistryOperations = {
  addVersion(record: PolicyConfigVersionRecord): void;
  getVersion(configVersion: string): PolicyConfigVersionRecord | null;
  updateVersion(record: PolicyConfigVersionRecord): void;
  getActiveVersion(): PolicyConfigVersionRecord | null;
  setActiveVersion(configVersion: string | null): void;
  listVersions(): readonly PolicyConfigVersionRecord[];
};

export const createPolicyConfigActivationRegistry = (): PolicyConfigActivationRegistryOperations => {
  const versions = new Map<string, PolicyConfigVersionRecord>();
  let activeVersion: string | null = null;

  return {
    addVersion(record) {
      versions.set(record.configVersion, record);
    },

    getVersion(configVersion) {
      return versions.get(configVersion) ?? null;
    },

    updateVersion(record) {
      versions.set(record.configVersion, record);
    },

    getActiveVersion() {
      if (activeVersion === null) return null;
      return versions.get(activeVersion) ?? null;
    },

    setActiveVersion(configVersion) {
      activeVersion = configVersion;
    },

    listVersions() {
      return [...versions.values()];
    }
  };
};
