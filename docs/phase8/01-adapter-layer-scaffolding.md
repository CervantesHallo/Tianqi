# Phase 8 / Step 1 — 基础设施适配器层骨架启动

## A. Phase 8 原始目标

Phase 8 的原始目标是把 Phase 1 在 `packages/ports` 中定义的所有端口接口在生产级别上落地，使 Tianqi 从"架构完整但仅在内存里跑"升级为"可在真实基础设施上运行"。Phase 8 在 20 个 Step 内完成，覆盖四类 Adapter：

1. **EventStore Adapter**（SQLite 与 Postgres 两种实现）
2. **Notification Adapter**（Kafka 实现）
3. **Config Adapter**（基于本地配置文件的实现）
4. **External Engine Adapter**（Margin / Position / Match / MarkPrice / Fund 五类外部引擎）

Phase 8 的成功定义是：上述四类 Adapter 全部具备生产可用的最小实现、全部通过 `@tianqi/adapter-testkit` 提供的同源契约测试套件，并保留 Phase 1–7 已封板的契约、状态机、回放、观测与发布门禁不退化。

## B. 为什么 Step 1 只做骨架不做实现

适配器层一旦启动，将在 20 个 Step 内反复新增 Adapter 包、反复引入契约测试套件、反复修改 workspace 结构。如果 Step 1 不先把物理地基浇好，后续任何一个 Step 都会被三类历史包袱反复绊倒：

1. **目录命名分歧**：第一个 Adapter 落到哪里，决定了后 19 个 Adapter 的布局；如果第一次落点错位，每次新增 Adapter 都需要兼顾两种结构。
2. **契约测试容器缺失**：契约测试套件必须有一个共享落地容器，否则首个 Adapter Step 会被迫边写实现边定义共享结构，违反 P5（纯核心 + 薄适配器）与 §22.3（先搭边界，再填实现）。
3. **依赖边界含糊**：一旦后续 Step 写了一个依赖 `@tianqi/domain` 的"测试工具"，整层对端口语义的纯净依赖将被永久污染。

因此 Step 1 的产出物是物理地基本身（workspace 通配 + adapter-testkit 包骨架 + 顶层 README + 执行记录），不包含任何端口的契约测试实现，也不包含任何具体 Adapter 的代码。Step 2 起才进入端口扩展与契约测试套件设计；Step 4 起才落地第一个具体 Adapter。

## C. adapter-testkit 为何独立成包

adapter-testkit 的依赖边界严格限定为 `@tianqi/ports` 与 `@tianqi/contracts`。这条边界不是建议，而是把 Phase 8 与 Phase 1–7 的封板契约隔离开来的硬约束。

将 adapter-testkit 合并到任何已有测试工具或与具体 Adapter 共享同一个包，都会带来不可接受的副作用：

- **合并到 `@tianqi/ports`**：会让端口接口包同时承担"接口定义"与"契约校验"两个职责，违反 §16.4 单职责。
- **合并到 `@tianqi/shared`**：会让一个面向所有运行时层的稳定基础包引入测试期工具依赖，违反 §5.2"shared 只放真正公共且稳定的基础类型"。
- **合并到具体 Adapter 包**：会让契约测试套件被绑定到某一个 Adapter 实现，后续任何新 Adapter 都要重新拉一份，违反 §22.3"先定义契约，再写适配器"。

因此 adapter-testkit 必须是一个独立的、内部、非发布的工作区包，且只允许依赖 `@tianqi/ports` 与 `@tianqi/contracts`。这条依赖边界一旦被打破（例如某 Step 为了"复用一个工具函数"私自让它依赖 `@tianqi/domain`），契约测试将不再能证明 Adapter 对端口的实现是否正确，而只是在证明它"和领域层一致"——这恰好是适配器层最不该做的事情。

## D. workspace 通配符的影响

在 `pnpm-workspace.yaml` 中新增 `packages/adapters/*` 通配，对仓库带来三处可见影响，本 Step 已确认全部可控：

1. **pnpm install**：pnpm 在解析依赖图时会把 `packages/adapters/adapter-testkit` 识别为新的工作区成员，与现有 `packages/*` 直接子包保持同一拓扑层级。已在 Step 1 重新执行 `pnpm install` 验证通过。
2. **IDE / TypeScript Server**：基于 workspace 的 IDE（如 VS Code TypeScript 服务）会自动扫描新增的工作区包；为了让 `pnpm typecheck`（即 `tsc -b tsconfig.json`）也能覆盖到新包，本 Step 已在根 `tsconfig.json` 的 `references` 中显式新增 `./packages/adapters/adapter-testkit` 引用，与既有 6 个工作区包保持同样的 Project References 结构。
3. **依赖解析**：`@tianqi/adapter-testkit` 通过 `workspace:*` 协议引用 `@tianqi/contracts` 与 `@tianqi/ports`，pnpm 会把它们解析为符号链接，避免引入任何额外的 npm 包。

`packages/infrastructure/` 自 Phase 1 / Step 1 起就以"占位 README"的形式存在，本 Step 不修改它。Phase 8 的所有 Adapter 走的是 `packages/adapters/*` 路线，`packages/infrastructure/` 只作为历史占位继续存在，不在本 Step 的语义讨论范围内。

## E. 顶层 README 为何不列未来 Adapter 清单

`packages/adapters/README.md` 当前已入驻表只有 `@tianqi/adapter-testkit` 一项，且明确写明"本表只反映当前仓库实际状态"。这条克制不是排版偏好，而是工程纪律：

1. 总文档 §22.1 第 14 条明确禁止"遇到复杂处直接使用 TODO 逃避实现"。在 README 中预先罗列 19 个尚未存在的 Adapter，本质上是一种比 TODO 更隐蔽的"承诺式占位"，会让阅读者误以为这些 Adapter 已经存在或即将马上落地。
2. 顶层 README 是后续 19 个 Adapter README 的语气模板。如果本 Step 在这里写下"即将支持 EventStore / Kafka / ..."，每个新 Adapter 落地时都会被迫维护这张清单，且任何延期都会让 README 与代码事实漂移。
3. 适配器层的"当前实际状态"是 Phase 8 任意一刻可被外部回答的最关键问题。让顶层 README 严格只反映已合入的包，使这个问题始终有一个可信、单源的答案。

## F. 本步没做什么

Phase 8 / Step 1 严格不做以下事情：

- 不实现任何契约测试（留给后续 Step）。
- 不创建任何具体 Adapter 包（留给后续 Step）。
- 不迁移任何现有 in-memory 实现（留给后续 Step）。
- 不改动 `packages/ports` / `packages/contracts` / `packages/domain` / `packages/application` / `packages/policy` / `packages/shared` 中的任何文件。
- 不新增任何第三方生产依赖。
- 不预先定义 HealthCheck 接口或其他 Port 扩展。
- 不触碰 CI/CD、Dockerfile、docker-compose、GitHub Actions。
- 不在任何产出物中写入 TODO / FIXME / Coming in Step N 类占位。

上述每一项都对应一个明确的后续 Step；Step 1 只为它们提供物理地基，不替它们提前下结论。

## G. 下一步（Step 2）将做什么

Step 2 进入"Port 扩展与契约测试套件首版设计"阶段，目标是：

- 在 `@tianqi/adapter-testkit` 中确立契约测试套件的统一形态（输入：端口实现 + 最小运行环境；输出：通过/未通过 + 结构化诊断），并以一个 Phase 1 已存在的端口为对象提供首个契约测试套件。
- 把 Adapter 必需的最小通用扩展（如健康检查的最小读写语义）以最克制的方式补齐，且严格限定在端口层与契约层。
- 不在 Step 2 引入任何具体基础设施实现，保持"先定契约、后写适配器"。

Step 2 的具体范围、影响、风险与 DoD 将在 `docs/phase8/02-*.md` 中独立给出，本文档不预先承诺其细节。
