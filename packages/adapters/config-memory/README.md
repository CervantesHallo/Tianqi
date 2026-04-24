# @tianqi/config-memory

`ConfigPort` 的纯内存实现。适用于单元测试、Application 层联调、无持久化需求的本地脚本。生产环境请使用 `@tianqi/config-file` 或未来 Step 落地的其他持久化 Config Adapter。

## 使用

```ts
import { createInMemoryConfig } from "@tianqi/config-memory";

const config = createInMemoryConfig();
await config.init();

// 运行期用 probe 准备一份 RuntimeConfig，通过 1PC + compensation 激活。
const v1 = config.preview({ traceSampling: 0.1, strict: true });
await config.activate(v1);

const active = await config.getActiveConfig();
if (active.ok) {
  console.log(active.value.values["traceSampling"]); // 0.1
}

await config.shutdown();
```

`createInMemoryConfig` 对齐 `createInMemoryEventStore` / `createInMemoryNotification` 的风格——唯一构造入口、空 options、不暴露 class。接受可选 `InMemoryConfigOptions = Readonly<Record<string, never>>`；保留形参是为给未来演化留接口空间，本 Step 不填任何字段。

## 契约覆盖

通过一行挂载驱动 `@tianqi/adapter-testkit` 的 `defineConfigContractTests` 21 个 `it` 块：

```ts
defineConfigContractTests("config-memory", () => createInMemoryConfig());
```

覆盖 5 类：Read path / Preview-Activate-Rollback state machine / Version-keyed read via probe / Audit trail + activation atomicity / AdapterFoundation integration。契约与 `@tianqi/config-file` 完全相同。

## Semantics（元规则 N 在 Config 领域的三条声明）

Config Adapter 没有"消息投递语义"，但必须显式声明三条对等约束——持久化、激活原子性、多实例一致性——让调用方对本 Adapter 的保证边界有明确心智模型。

1. **持久化保证**：**不持久化**。所有版本历史、活跃版本指针、审计轨迹均驻留进程内存。进程退出后全部丢失。重启后下一次 `init()` 产生的 Adapter 实例从零计数，与上一次实例无任何继承关系。
2. **激活原子性保证**：单进程内 **1PC + compensation**。`activate()` / `rollback()` 返回 `ok` 时，活跃指针与审计轨迹已同步；返回 `TQ-CON-007` 时，活跃指针已回滚到前值，审计轨迹长度不变。不变量：审计轨迹长度 ≥ 合法切换次数。
3. **多实例一致性**：**不提供**。两个 `createInMemoryConfig()` 实例状态完全独立——一方的 `activate` 不会被另一方观察到。如需跨实例共享配置，请改用 `@tianqi/config-file` 或未来持久化 Config Adapter。

## 错误码

- `TQ-INF-003` / `TQ-INF-004`：未 init / 已 shutdown（复用，惯例 K——Lifecycle 共性）
- `TQ-CON-006`：`activate` / `rollback` / `getByVersion` 目标版本未被 preview
- `TQ-CON-007`：审计落地失败触发活跃指针回滚

本 Adapter 不触发 `TQ-INF-011` / `TQ-CON-008`——那两码是 `@tianqi/config-file` 专属（文件 IO 与 YAML schema 校验场景）。

## 与 `@tianqi/config-file` 的差异

两者契约面同构、内部 1PC + compensation 实现同构，但：

- `config-memory` 不读任何文件；`config-file` init 时读 YAML。
- `config-memory` 的 `healthCheck.details` 仅含进程内指标；`config-file` 额外含 `filePath` / `fileReadable`。
- 初始状态：`config-memory` 无活跃版本（首次 `getActiveConfig` 返回结构化错误）；`config-file` init 后已有 YAML 加载的活跃版本。
