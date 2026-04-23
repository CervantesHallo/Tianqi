export type AdapterHealthDetailValue = string | number | boolean | null;

export type AdapterHealthDetails = Readonly<Record<string, AdapterHealthDetailValue>>;

export type AdapterHealthStatus = {
  readonly adapterName: string;
  readonly healthy: boolean;
  readonly details: AdapterHealthDetails;
  readonly checkedAt: string;
};

export type AdapterLifecycle = {
  init(): Promise<void>;
  shutdown(): Promise<void>;
};

export type AdapterHealthCheck = {
  healthCheck(): Promise<AdapterHealthStatus>;
};

export type AdapterIdentity = {
  readonly adapterName: string;
};

export type AdapterFoundation = AdapterIdentity & AdapterHealthCheck & AdapterLifecycle;
