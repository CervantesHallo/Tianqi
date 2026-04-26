export type { AdapterFoundationFactory } from "./adapter-foundation-factory.js";
export { defineHealthCheckContractTests } from "./health-check-contract.js";
export { defineLifecycleContractTests } from "./lifecycle-contract.js";
export type { EventStoreContractProbe } from "./event-store-contract-probe.js";
export { defineEventStoreContractTests } from "./event-store-contract.js";
export type {
  EventStoreAdapterFactory,
  EventStoreAdapterUnderTest,
  EventStoreContractOptions
} from "./event-store-contract.js";
export { definePersistentEventStoreContractTests } from "./persistent-event-store-contract.js";
export type {
  PersistentEventStoreAdapterFactory,
  PersistentEventStoreContractOptions,
  PersistentTestSession
} from "./persistent-event-store-contract.js";
export type {
  NotificationContractProbe,
  NotificationHandler,
  NotificationSubscription
} from "./notification-contract-probe.js";
export { defineNotificationContractTests } from "./notification-contract.js";
export type {
  NotificationAdapterFactory,
  NotificationAdapterUnderTest,
  NotificationContractOptions
} from "./notification-contract.js";
export type {
  ConfigAuditCause,
  ConfigAuditEntry,
  ConfigContractProbe,
  ConfigContractProbeError
} from "./config-contract-probe.js";
export { defineConfigContractTests } from "./config-contract.js";
export type {
  ConfigAdapterFactory,
  ConfigAdapterUnderTest,
  ConfigContractOptions
} from "./config-contract.js";
export { definePersistentConfigContractTests } from "./persistent-config-contract.js";
export type {
  PersistentConfigAdapterFactory,
  PersistentConfigAdapterUnderTest,
  PersistentConfigContractOptions,
  PersistentConfigTestSession
} from "./persistent-config-contract.js";
export type {
  CircuitBreakerState,
  ExternalEngineContractProbe,
  ExternalEngineRetryStats
} from "./external-engine-contract-probe.js";
export { createMockDownstreamServer } from "./helpers/mock-downstream-server.js";
export type {
  MockDownstreamFault,
  MockDownstreamServer
} from "./helpers/mock-downstream-server.js";
export { defineExternalEngineContractTests } from "./external-engine-contract.js";
export type {
  ExternalEngineAdapterFactory,
  ExternalEngineAdapterUnderTest,
  ExternalEngineContractOptions,
  ExternalEngineError,
  ExternalEngineErrorCode,
  ExternalEngineRequest,
  ExternalEngineSuccess,
  TestkitExternalEngineFoundation
} from "./external-engine-contract.js";
// Phase 9 / Step 2 — Saga 契约套件公开 API。
//   - 导出 defineSagaContractTests + SagaContractProbe + Subject/Factory/Options 类型
//   - **不**导出 fixtures/reference-saga.ts 任何符号（元规则 F：参考实现严格
//     testkit-only，不允许其他包消费）
export type { SagaContractProbe } from "./saga-contract-probe.js";
export { defineSagaContractTests } from "./saga-contract.js";
export type {
  SagaContractDriveOptions,
  SagaContractDriveResult,
  SagaContractFactory,
  SagaContractOptions,
  SagaContractSubject
} from "./saga-contract.js";
