# Tianqi Adapters

本目录是 Tianqi 适配器层的物理落点，托管所有把 `packages/ports` 中定义的端口接口在真实基础设施上落地的 Adapter 包。

## 在 Tianqi 架构中的位置

适配器层是六边形架构中"基础设施层"在本仓库的具体载体，对应总文档 §5.2 中 `infrastructure` 模块职责所描述的"实现 ports，连接数据库、缓存、消息系统、RPC、HTTP"。详细的层级划分原则参见《Tianqi 项目架构与代码规范总文档》§5.2，以及《Tianqi Phase 8–12 架构与代码规范补充文档》§3 关于适配器层的工程化约束。本 README 不重述这些约束，只声明本目录在仓库中扮演的角色。

## 三条强约束

适配器层在本仓库内必须同时满足下述三条约束（详细解释见补充文档 §3.2 / §3.3 / §3.4，本节仅作落点引用）：

1. **单职责**：每个 Adapter 只对一个端口接口的一种基础设施实现负责，不得把多个端口、多个后端、多个职责合并到同一个包内（补充文档 §3.2）。
2. **领域无感知**：Adapter 仅依赖 `@tianqi/ports` 与 `@tianqi/contracts`，不得依赖 `@tianqi/domain` / `@tianqi/application` / `@tianqi/policy`，更不得在 Adapter 内复刻任何领域语义或业务策略（补充文档 §3.3）。
3. **契约测试强制**：每个 Adapter 必须通过 `@tianqi/adapter-testkit` 提供的同源契约测试套件证明实现正确，禁止用自写的"白盒断言"替代契约测试（补充文档 §3.4）。

## 当前已入驻 Adapter

| 包名                                                               | 角色                                                                   | 状态                                  |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------- |
| [`@tianqi/adapter-testkit`](./adapter-testkit)                     | 适配器层共享契约测试工具包                                             | Phase 8 / Step 1 落地                 |
| [`@tianqi/event-store-memory`](./event-store-memory)               | `EventStorePort` 内存实现（非持久化）                                  | Phase 8 / Step 4 落地                 |
| [`@tianqi/event-store-sqlite`](./event-store-sqlite)               | `EventStorePort` SQLite 持久化实现（基于 better-sqlite3）              | Phase 8 / Step 5 落地                 |
| [`@tianqi/event-store-postgres`](./event-store-postgres)           | `EventStorePort` PostgreSQL 持久化实现（基于 pg + Pool）               | Phase 8 / Step 6 落地                 |
| [`@tianqi/notification-memory`](./notification-memory)             | `NotificationPort` 内存实现（非持久化；at-least-once）                 | Phase 8 / Step 8 落地                 |
| [`@tianqi/notification-kafka`](./notification-kafka)               | `NotificationPort` Kafka 实现（基于 kafkajs；at-least-once）           | Phase 8 / Step 9 落地                 |
| [`@tianqi/config-memory`](./config-memory)                         | `ConfigPort` 内存实现（非持久化；1PC + compensation）                  | Phase 8 / Step 11 落地                |
| [`@tianqi/config-file`](./config-file)                             | `ConfigPort` YAML 文件实现（冷启动 + 热加载 + 跨重启历史；基于 yaml）  | Phase 8 / Step 11 落地 · Step 12 扩展 |
| [`@tianqi/external-engine-http-base`](./external-engine-http-base) | **基座 Adapter**：External Engine HTTP 客户端封装五件套（基于 undici） | Phase 8 / Step 14 落地                |
| [`@tianqi/margin-engine-http`](./margin-engine-http)               | **业务 Engine**：MarginEnginePort HTTP 实现（消费基座）                | Phase 8 / Step 15 落地                |

本表只反映当前仓库实际状态，新增 Adapter 须在合入时同步更新此表，禁止预先列出尚未落地的 Adapter。
