# Phase 11 / Step 0.5 — PHASE_DESIGN 草案

> **状态**：第一阶段（PHASE_DESIGN）草案；等待用户 APPROVE。
> **拆两阶段流程第 8 次实战 / 元规则 Q v3 模板第 13 次实战**
> 本草案在 APPROVE 后转入 ci.yml 修改 + .persistent.test.ts 新建 + testkit 新建 + ADR + docs；草案文档本身在 PHASE_IMPLEMENT 完成时删除（设计沉淀）。

---

## A. 强制开局动作 1-5 执行确认

| 动作 | 内容 | 状态 |
|------|------|------|
| 1 | 宪法 §13/§15/§20.2 + 补充文档 §3.4/§3.6/§8.1/§9.1/§9.2/§13.1 第 11 项 + ADR-0004 5 段 + Step 0 段 重读 | ✅ |
| 2 | KNOWN-ISSUES.md 核查（KI-P8-002 Partially RESOLVED；Step 0.5 完成后完整 RESOLVED） | ✅ |
| 3 | ADR-0004 现状 256 行 + Step 0.5 段准备（惯例 M 第 31 次 + 跨 Phase 第 12 次） | ✅ |
| 4 | 八项主题专属核查 A-H | ✅（详见 B 段） |
| 5 | 4 项独立命令 baseline (with-PG canonical) | ✅（详见 C 段） |

**事实锚定核查**：origin/main = `e134de6`（Merge PR #13 Step 0）✓ / phase-10-closed = `ab70043` ✓ / feature 分支从 `e134de6` 干净 main 拉取 ✓

---

## B. 强制开局动作 4 核查结果（八项 A-H）

### B.1 既有 notification-kafka 文件清单

| 文件 | 行数 | 状态 |
|------|------|------|
| `index.ts` | 2 | 既有 |
| `notification-kafka.ts` | 291 | 既有（Producer + Consumer + subscribers local fan-out 完整实现） |
| `notification-kafka.test.ts` | 154 | 既有（3 always run + 3 skipIf canReachKafka）|
| `notification-kafka.contract.test.ts` | 56 | 既有（18 contract tests via `defineNotificationContractTests`）|
| **`.persistent.test.ts`** | **0** | **不存在 — Step 0.5 从零创建工作面** |

### B.2 既有 notification-kafka.test.ts 现状

6 个 it 块：
- 3 always run（unit tests，不依赖 Kafka）：empty brokers / unreachable / object_keys
- 3 `it.skipIf(!canReachKafka)`：health_check_details / health_check_after_shutdown / two_distinct_consumer_groups（end-to-end fanout 验证）

**关键发现**：既有 `test_two_distinct_consumer_groups` 已实现 Producer + Consumer 端到端验证（fanout 模式）；Step 0.5 .persistent.test.ts 不重复此 case，而是聚焦"持久化语义"。

### B.3 既有 notification-kafka.contract.test.ts 现状

- 18 contract tests via `defineNotificationContractTests("notification-kafka", factory)`
- factory 每次产生独立 topic（`tianqi-notif-contract-${RUN_ID}-${counter}`）— **裁决 K.4 α 模式已就位**
- afterAll: `admin.deleteTopics({ topics: createdTopics })` 清理 — **Step 0 cleanup 模式协调**
- 用 `TIANQI_TEST_KAFKA_BROKERS` env var（**裁决 K.2 β 业界 KafkaJS 约定已就位**）
- `allowAutoTopicCreation: true` 不需要 admin 预创 topic

### B.4 环境变量约定决策

**裁决 K.2 = γ 沿用既有 `TIANQI_TEST_KAFKA_BROKERS`**（业界 KafkaJS 约定；既有 .contract.test.ts + .test.ts 已用）。

形式：`broker1:9092,broker2:9092`（逗号分隔字符串，运行时 `.split(",")`）。CI services 配置使用 `localhost:9092`。

### B.5 Kafka 镜像选择评估（裁决 K.1）

| 候选 | KRaft | 单 service | 镜像大小 | 业界采用 | 评估 |
|------|-------|-----------|---------|---------|------|
| α **apache/kafka:3.7** | ✅ default | ✅ | ~430 MB | ✅ 2024+ 主流官方 | **推荐** |
| β confluentinc/cp-kafka:7.x | ❌ 需 Zookeeper | ❌ | ~840 MB | ✅ Confluent 生态 | 拒（多 service 复杂） |
| γ bitnami/kafka:3.x | ✅ | ✅ | ~610 MB | ⚠️ Bitnami 维护周期 | 拒（apache 官方更可靠） |

**裁决 K.1 = α apache/kafka:3.7**。理由：单 service + KRaft 现代模式 + apache 官方维护 + 与 Step 0 单 service postgres:16-alpine 模式一致 + "克制 > 堆砌"。

### B.6 Kafka 测试模式覆盖范围（裁决 K.3）

**裁决 K.3 = β Producer + Consumer 验证**。具体测试用例设计见 §E。

参考 `persistent-event-store-contract.ts` 4 category 模式（P1 持久化 / P2 cross-instance / P3 并发 / P4 health check details）。

### B.7 测试隔离策略（裁决 K.4）

**裁决 K.4 = α 独立 topic 命名**（每个 test 一个 `tianqi-notif-persistent-${RUN_ID}-${counter}` topic）。
- 既有 contract.test.ts 已用此模式 — Step 0.5 沿用
- afterAll cleanup 通过 `admin.deleteTopics([...])`

### B.8 Kafka 启动时序处置（裁决 K.5）

**裁决 K.5 = α 双层防御**（Step 0 模式延伸）：
- services.kafka 加 health-cmd（apache/kafka 镜像内置 `kafka-broker-api-versions.sh --bootstrap-server localhost:9092` 或类似探测）
- 显式 ready wait 步骤（curl/nc/netcat 探测 9092 端口 或 kafkajs Admin client connect 探测）

Kafka 启动比 Postgres 慢（KRaft metadata quorum）— ready wait 超时窗口建议 60s。

---

## C. 强制开局动作 5 — 4 项独立命令 baseline (with-PG canonical)

| 命令 | 结果 |
|------|------|
| pnpm lint | ✅ PASS |
| pnpm typecheck | ✅ PASS |
| pnpm test (with PG) | ✅ 1952 PASS + 25 skipped = **1977 total** |
| pnpm test:coverage (with PG) | ✅ **86.75% / 80.04% / 95.91% / 86.75%** |

**25 skipped 中分布**（Step 0.5 完成后预期激活情况）：
- 18 notification-kafka.contract.test.ts → **Step 0.5 激活**
- 3 notification-kafka.test.ts (health/shutdown/fanout) → **Step 0.5 激活**
- 1 sqlite + 3 其他（BAD_PATH cases）→ Step 0.5 不动

预期 Step 0.5 完成后：18 + 3 + 14 (新 persistent) = **+35 测试激活 / 14 新建** → 1977 + 14 = **1991 total**；with-PG-Kafka 1952 + 21 + 14 = **1987 PASS** + ~4 skipped。

---

## D. 10 个核心裁决摘要

| # | 裁决 | 选择 |
|---|------|------|
| K.1 | Kafka 镜像 | **α apache/kafka:3.7**（KRaft + 单 service）|
| K.2 | 环境变量约定 | **γ 沿用既有 TIANQI_TEST_KAFKA_BROKERS** |
| K.3 | .persistent.test.ts 覆盖范围 | **β Producer + Consumer 验证**（P1-P4 四类约 14 测试）|
| K.4 | 测试隔离策略 | **α 独立 topic 命名**（既有模式延伸）|
| K.5 | Kafka services 启动时序 | **α 双层防御**（health-cmd + 显式 ready wait）|
| K.6 | .contract.test.ts 激活 | 既有 skipIf 与新 env var 一致，**无需修改** |
| K.7 | CI services 配置策略 | test + coverage 两 job 加 services.kafka（与 services.postgres 共存；4 jobs 维持）|
| K.8 | 错误码 / 新 Port / Adapter / 包 / 依赖 | **0 新增**（惯例 K 第 29 次实战；元规则 P 累计 31 步零依赖维持）|
| K.9 | 业务代码修改预期 | **PHASE_DESIGN 不预判**；实测 .persistent.test.ts 决定 |
| K.10 | ADR-0004 Step 0.5 段 ≤50 行 | ✓ 撰写时控制；如 K.9 触发修复加 ~10-15 行（同 §D 边界澄清模式） |

---

## E. .persistent.test.ts 测试用例清单（约 14 测试 / 4 类）

参考 `persistent-event-store-contract.ts` 模式 + `persistent-saga-state-store-contract.ts` P1-P4 分类。新建 `packages/adapters/adapter-testkit/src/persistent-notification-contract.ts` testkit（Phase 8 设计疏漏补齐）。

### P1 跨进程持久化（4 tests）
1. `test_message_persists_in_broker_after_producer_shutdown_visible_to_fresh_consumer`
2. `test_consumer_resumes_from_last_committed_offset_after_reconnect`（同 consumer group 重连续接）
3. `test_messages_published_before_consumer_subscribe_become_visible_with_from_beginning_semantics`（取决于 KafkaJS fromBeginning 行为；可选）
4. `test_topic_metadata_persists_after_producer_shutdown_visible_to_metadata_query`

### P2 跨实例可见性（4 tests）
5. `test_publish_by_writer_instance_visible_to_concurrently_running_reader_instance_in_different_group`
6. `test_two_writer_instances_publish_to_same_topic_all_messages_delivered_to_single_reader`
7. `test_writer_publishes_visible_to_late_joining_reader_in_new_consumer_group_with_from_beginning`
8. `test_reader_in_different_consumer_group_does_not_consume_messages_from_writer_group_offsets`

### P3 并发投递语义（3 tests）
9. `test_concurrent_publish_from_single_instance_all_delivered_at_least_once`
10. `test_promise_all_concurrent_publish_no_message_loss`
11. `test_per_case_id_messages_preserve_order_within_partition`（依赖 KafkaJS partitioner；可能跳过如非 default partitioner）

### P4 健康检查 + 持久化细节（3 tests）
12. `test_health_check_reports_broker_metadata_lifecycle_topic_after_init`
13. `test_health_check_after_producer_disconnect_returns_healthy_false_without_throwing`
14. `test_health_check_subscriber_count_reflects_active_handlers_across_lifecycle`

**总计 14 测试**。具体实现由 PHASE_IMPLEMENT 阶段撰写；如某些场景在 Kafka 上难以可靠测试（譬如 from_beginning 时序），调整为 13 或剔除某 case，相应在 ADR-0004 Step 0.5 段留痕。

---

## F. ci.yml services.kafka 草案

在 ci.yml `test` + `coverage` 两 job 的 `services` 块加 `kafka`：

```yaml
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: tianqi
          POSTGRES_PASSWORD: tianqi
          POSTGRES_DB: tianqi
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      kafka:
        image: apache/kafka:3.7.0
        ports:
          - 9092:9092
        env:
          # KRaft single-node config (no zookeeper)
          KAFKA_NODE_ID: 1
          KAFKA_PROCESS_ROLES: broker,controller
          KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
          KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
          KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
          KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
          KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
          KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
          KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"
          CLUSTER_ID: tianqi-test-kraft-cluster
        options: >-
          --health-cmd "/opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092"
          --health-interval 15s
          --health-timeout 10s
          --health-retries 10
          --health-start-period 30s
```

Job steps 追加（Postgres ready wait 后）：

```yaml
      - name: Wait for Kafka ready (双层防御 — services health-cmd + 显式 broker probe)
        run: |
          for i in $(seq 1 60); do
            if nc -z localhost 9092 2>/dev/null; then
              echo "Kafka port 9092 reachable after ${i}s"
              break
            fi
            sleep 1
          done
      - name: Run tests with real Postgres + Kafka activation
        env:
          TIANQI_TEST_POSTGRES_URL: "postgres://tianqi:tianqi@localhost:5432/tianqi"
          TIANQI_TEST_KAFKA_BROKERS: "localhost:9092"
        run: pnpm test
```

**注意**：`apache/kafka:3.7.0` 镜像具体 KRaft 启动参数 + health-cmd 命令路径需要 PHASE_IMPLEMENT 实测验证（不同 Kafka 镜像版本路径可能略不同）。

---

## G. ADR-0004 Step 0.5 段草案（K.10 ≤50 行）

```markdown
## Decision (Step 0.5 — KI-P8-002 完整 RESOLVED + Kafka 真实基础设施)

完成日：2026-05-XX。惯例 M 第 31 次实战 / 跨 Phase 第 12 次。本 Step **拆两阶段**（K.5 锁定；多个设计决策点）；PHASE_DESIGN 草案 → APPROVE → PHASE_IMPLEMENT 7 commits 落地。

### S0.5.1 Kafka services 配置 — α apache/kafka:3.7 + KRaft
ci.yml test + coverage 双 job 加 `services.kafka`（与 services.postgres 共存；4 jobs 维持）。apache/kafka:3.7.0 KRaft 单 service 模式（不需 Zookeeper；与 Step 0 单 service 模式协调）。env var `TIANQI_TEST_KAFKA_BROKERS=localhost:9092`（裁决 K.2 沿用既有约定）。health-cmd `kafka-broker-api-versions.sh` + 显式 nc 端口探测双层防御（K.5）。

### S0.5.2 persistent-notification-contract.ts testkit 从零创建
Phase 8 设计 EventStore/SagaStateStore/DeadLetterStore/Config 4 个 persistent contract 时**遗漏 Notification**；Step 0.5 真实激活揭露并补齐。新增 `packages/adapters/adapter-testkit/src/persistent-notification-contract.ts`（与既有 persistent-* 模式对齐；P1-P4 四类约 14 测试）。

### S0.5.3 notification-kafka.persistent.test.ts 从零创建
约 14 测试覆盖 P1 跨进程持久化 / P2 跨实例可见性 / P3 并发投递 / P4 健康检查（详见 §E）。每 test 独立 topic（裁决 K.4 α）；afterAll admin.deleteTopics 清理。

### S0.5.4 KI-P8-002 完整 RESOLVED（Postgres + Kafka）
- Step 0 Postgres 部分 RESOLVED（3 adapter × 88 tests）
- Step 0.5 Kafka 部分 RESOLVED（1 adapter × ~35 tests：18 contract + 3 .test.ts + 14 persistent）
- 状态从 **Partially RESOLVED** → **RESOLVED**；归档至 KNOWN-ISSUES.md Resolved Known Issues 段

### S0.5.5 业务代码修改（K.9 实测决定）
[PHASE_IMPLEMENT 实测后填入：α 无修复 / β 修复内容；如 β → 沿用 §D 边界澄清]

### S0.5.6 不预占 Step 1 / Phase 11+
- 不修改 docker-compose.yml（Step 1 责任）
- 不引入 Testcontainers（Step 1 责任）
- 不扩 ci.yml jobs 数（4 维持；裁决 K.7）
```

---

## H. KNOWN-ISSUES.md 更新草案

将 KI-P8-002 从 "open" + "Partially RESOLVED (Postgres 部分)" 升级到 **RESOLVED**，归档到 Resolved Known Issues 段：

```markdown
### KI-P8-002 — external Adapter 包真实基础设施测试

- **Status**: ✅ RESOLVED (Phase 11 / Step 0 + Step 0.5; 2026-05-18 + 2026-05-XX)
- **Postgres 部分 RESOLVED (Step 0; 2026-05-18)**: 3 adapter × 9 test files = 88 PASS；详见 docs/phase11/01
- **Kafka 部分 RESOLVED (Step 0.5; 2026-05-XX)**: 1 adapter × 3 test files = ~35 tests PASS；详见 docs/phase11/02
- **Resolution summary**: Phase 8 既有 Postgres + Kafka adapter 在 Phase 11 第一次通过 ci.yml services 真实激活；Phase 11 主题"端到端集成验证"基础完整闭环
```

同时 KI-P8-003 段不变（Step 0.5 不在范围）；其他 4 KI 不变。

---

## I. 风险点与 fallback 方案

| 风险 | Fallback |
|------|---------|
| apache/kafka:3.7.0 镜像启动参数与文档可能略不同 | PHASE_IMPLEMENT 实测验证 + 如有差异调整 yaml |
| Kafka KRaft 启动时序 > Postgres（metadata quorum） | health-cmd + 显式 wait 60s 上限；如 CI 偶发超时 → 调 wait 上限 |
| .persistent.test.ts P3 并发测试在 CI runner 资源压力下可能时序敏感 | 与 KI-P8-003 同精神：fast/slow ratio ≥ 1:10；Re-run mitigation |
| KafkaJS 与 apache/kafka:3.7 兼容性 | KafkaJS 已 Phase 8 验证（已支持 KRaft）；如 PHASE_IMPLEMENT 实测有兼容问题 → 降级 3.6 |
| 业务代码修复必要性（K.9） | PHASE_IMPLEMENT 实测决定；如必须 → ADR-0004 §D 边界澄清沿用 Step 0 模式 |
| topic 命名碰撞（uuid 概率极低） | factoryCounter + RUN_ID 时间戳 + Math.random 三重隔离；admin.deleteTopics best-effort cleanup |
| no-PG baseline 已知问题（Step 0 触发）+ no-Kafka 进一步加重 | with-PG-Kafka canonical baseline (CI 走此路径)；no-infra 是 dev fallback；不阻塞 |
| **persistent-notification-contract.ts 新建是 Phase 8 疏漏补齐**（工程缺陷修复性质）| 与 §D 边界澄清一致；非业务语义变化；Notification Port 接口冻结严守 |

---

## J. 本机 commit SHA（PHASE_DESIGN 阶段；未 push）

待 Write 工具完成后执行 `git add docs/phase11/PHASE-11-STEP-0-5-DESIGN-DRAFT.md && git commit` 单 commit；SHA 在最终输出时报告。

---

## K. 草案文档位置

`docs/phase11/PHASE-11-STEP-0-5-DESIGN-DRAFT.md`（本文件）

PHASE_IMPLEMENT 阶段（APPROVE 后）删除；内容沉淀到 ADR-0004 Step 0.5 段 + docs/phase11/02-step-0-5-kafka-real-infrastructure.md + KNOWN-ISSUES.md + mapping。

---

## L. 核心未决判断（请重点审视）

### L.1 K.3 P1 第 3 测试（from_beginning semantics）是否必要

`test_messages_published_before_consumer_subscribe_become_visible_with_from_beginning_semantics` 涉及 KafkaJS Consumer `fromBeginning: true` 配置 — 但既有 notification-kafka.ts adapter 可能默认 `fromBeginning: false`（仅消费新消息）。

**裁决建议**：先实测 adapter Consumer 默认行为；如 fromBeginning false → 删除此测试（不强制改 adapter 配置）。

**请审视**：是否同意此处置？还是希望 PHASE_IMPLEMENT 实测后再决定？

### L.2 K.3 P3 第 3 测试（per_case_id partition order）依赖性

per_case_id 顺序依赖 KafkaJS partitioner 是否用 caseId hash 分区。如 adapter 默认 round-robin partitioner → 顺序不保证。

**裁决建议**：先实测 adapter 默认 partitioner；如不保证顺序 → 删除此测试或改为 "single_partition_preserves_order"。

**请审视**：是否同意此处置？

### L.3 persistent-notification-contract.ts 文件位置

按 Phase 8 模式，新文件放 `packages/adapters/adapter-testkit/src/persistent-notification-contract.ts`。

**请审视**：是否同意此位置？还是希望放其他位置（譬如 `persistent-notification-contract.test.ts` 自含执行）？

### L.4 业务代码修改预期（K.9）

Step 0 揭露 Postgres adapter bootstrap 并发缺陷（必修）。Step 0.5 预期：notification-kafka.ts 在真实 Kafka 跑时**可能揭露隐藏缺陷**（譬如 Consumer subscribe + Producer init 时序 race / 错误处理边界 / 等）。

**裁决建议**：PHASE_DESIGN 不预判；PHASE_IMPLEMENT 实测决定。

**请审视**：是否预设 budget（譬如"如必须修业务代码，最多 +50 行"）？

### L.5 Kafka 镜像版本固定 3.7.0 vs 3.7（major-only）

ci.yml 用 `apache/kafka:3.7.0`（具体版本）vs `apache/kafka:3.7`（major.minor）。

**裁决建议**：sticky 到具体版本 3.7.0 防漂移（与 setup-node `'22'` major-only 不同精神，因为 services 镜像直接影响测试结果）。

**请审视**：是否同意？还是希望用 major.minor 自动 latest patch（与 Postgres `:16-alpine` 模式协调）？

---

## 等待用户回执

请回 **APPROVE** / **REQUEST_CHANGES + 反馈** / **REJECT + 方向调整**。

收到 APPROVE 后立即启动第二阶段 PHASE_IMPLEMENT 7 commits：
1. `ci(services)`: ci.yml 加 services.kafka + ready wait + env var
2. `test(adapter-testkit)`: persistent-notification-contract.ts 从零创建
3. `test(notification-kafka)`: notification-kafka.persistent.test.ts 从零创建挂载 + 实测验证
4.（如 K.9 触发）`fix(notification-kafka)`: 具体修复内容
5. `docs(known-issues)`: KI-P8-002 完整 RESOLVED 归档
6. `docs(decisions)`: ADR-0004 Step 0.5 段追加（惯例 M 第 31 次 + 跨 Phase 第 12 次）
7. `docs`: docs/phase11/02-step-0-5-kafka-real-infrastructure.md + mapping 同步
