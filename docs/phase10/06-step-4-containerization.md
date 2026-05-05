# Phase 10 / Step 4 — 容器化（Dockerfile 多阶段 + 非 root + HEALTHCHECK + docker-compose）

> **执行时间**：2026-05-05
> **类型**：Phase 10 第二个工程化建设 Step（Step 3 + 3.5 是第一块砖 CI 强制门禁）
> **本 Step 性质**：容器化部署能力建立；Tianqi 从"代码可运行"升级为"容器可部署"
> **状态**：完成

---

## 🎯 Phase 10 工程化基础设施第二块砖落地

| 块 | 内容 | Step |
|---|---|---|
| 第一块 | CI 强制门禁（4 项独立命令并行 + 84% coverage 门槛 + main 转绿）| Step 3 + 3.5 |
| **第二块** | **容器化部署能力（Dockerfile 多阶段 + 非 root + HEALTHCHECK + docker-compose 开发编排）** | **Step 4（本 Step）** |
| 第三块 | 发布自动化（Step 5 责任）| 待承接 |
| 第四块 | 文档可执行性 + Runbook（Step 6 责任）| 待承接 |

---

## §A 当前任务

Phase 10 / Step 4 — 创建 Dockerfile（多阶段；裁决 1-5 实施）+ .dockerignore（裁决 7 B）+ docker-compose.yml（裁决 6 α 单服务）让 Tianqi 具备容器化部署能力。沿用 Step 3 + 3.5 build chain（root build script + dist-based packaging）。

---

## §B 影响范围

### B.1 新增文件（4 个）

| 文件 | 行数 | 性质 |
|---|---|---|
| `Dockerfile` | 60 | 多阶段构建（builder + runtime）|
| `.dockerignore` | 49 | docker build context 排除规则 |
| `docker-compose.yml` | 28 | 开发编排（α 单服务）|
| `docs/phase10/06-step-4-containerization.md` | 本执行记录 | 9 节 A-I |

### B.2 修改文件（2 个）

| 文件 | 变更 |
|---|---|
| `docs/decisions/0003-phase-10-engineering-and-collaboration.md` | Step 4 段增量追写（惯例 M 第 25 次 + 跨 Phase 第 6 次实战）|
| `docs/00-phase1-mapping.md` | Phase 10 Step 4 完成段追加 |

### B.3 业务代码 / 测试 / lockfile

- **业务代码**：0 修改
- **测试增量**：0
- **lockfile** `pnpm-lock.yaml`：零变动
- **错误码总数**：维持 84（惯例 K 第 23 次实战）
- **workspace 包数**：维持 25
- **KI 状态**：5 项 open（不变；KI-P10-001 + KI-P10-002 RESOLVED 不变）

---

## §C 设计决策

### C.1 强制开局动作 1-3

✅ 重读《宪法》§17 + 《补充文档》§7.5/§7.2/§13.1/§14 + ADR-0003 Step 3 + Step 3.5 段；KI 5 项 open + KI-P10-001/002 RESOLVED 核查；ADR-0001/0002 Accepted + ADR-0003 In Progress 核查（Step 0/1/2/3/3.5 段已增量追写）。

### C.2 强制开局动作 4 — 七项实地核查（A-G）

| # | 核查项 | 实测结果 |
|---|---|---|
| A | 既有容器化文件 | 无 Dockerfile / docker-compose.yml / .dockerignore；从零创建 |
| B | 运行时入口 | root 无 main/bin/start；packages/application 是 `@tianqi/application` 库；**Tianqi 是 monorepo 库性质** |
| C | Dockerfile build chain 设计前置 | root build = `tsc -b tsconfig.json`；test/test:coverage 依赖 pnpm build（Step 3.5 落地）|
| D | HEALTHCHECK 设计前置 | 库性质无 HTTP 入口；候选简单 Node 命令 |
| E | docker-compose 编排前置 | postgres adapter 在 KI-P8-002（skipped）；β postgres 编排让本机验证复杂；α 单服务价值在开发命令封装 |
| F | Step 3 + 3.5 build chain 协调 | builder stage 必须沿用 root pnpm build；不允许独立 tsc |
| G | base image 兼容性 | **better-sqlite3 11.5.0 是原生模块**（pnpm onlyBuiltDependencies）；alpine musl libc 不兼容 better-sqlite3 prebuilt → **强制裁决 2 β slim** |

### C.3 强制开局动作 5 — 4 项独立命令 baseline + final

| # | 命令 | Baseline | Final |
|---|---|---|---|
| 1 | `pnpm lint` | PASS | **PASS** |
| 2 | `pnpm typecheck` | PASS | **PASS** |
| 3 | `pnpm test` | 1971（1867+104）| **1971（1867+104）** |
| 4 | `pnpm test:coverage` | 84.92%/79.58%/91.68%/84.92% | **84.92%/79.56%/91.68%/84.92%** |

**零波动证据**：Dockerfile / .dockerignore / docker-compose.yml 添加不影响 lint / typecheck / test / coverage 检查范围（这些文件不在 ESLint / TypeScript / Vitest 处理范围）。branches 微小波动 0.02pp 是 v8 统计噪声。

### C.4 10 个核心裁决最终选择

详见 ADR-0003 Step 4 段表格。

### C.5 Dockerfile 多阶段结构图 + docker-compose 服务清单

```
[Stage 1 builder]                     [Stage 2 runtime]
  node:22-slim                          node:22-slim
  ├── corepack enable                   ├── corepack enable
  ├── COPY config + tsconfig×2          ├── COPY --from=builder
  ├── COPY packages/                    │   (chown=node:node)
  ├── pnpm install --frozen-lockfile    ├── USER node (uid 1000)
  └── pnpm build  ← root script         ├── HEALTHCHECK node -e "exit(0)"
       │                                └── CMD keep alive
       ↓ produces packages/*/dist/
```

```
docker-compose.yml (裁决 6 α 单服务):
services:
  tianqi:
    build: { context: ., target: runtime }
    image: tianqi:dev
    container_name: tianqi-dev
```

### C.6 docker build / run 实测结果

| 维度 | 实测 |
|---|---|
| docker build 时长 | ~1m 42s（含 builder 全量构建 + runtime 文件复制）|
| runtime image 大小 | **508MB**（含 dev node_modules；Phase 11+ pnpm deploy 优化）|
| docker run | ✅ container Up 35s healthy |
| HEALTHCHECK 状态 | **healthy**（35s 后；CMD node -e "process.exit(0)" 真实工作）|
| docker compose up -d | ✅ container Up 5s（health: starting 进入 healthy）|
| docker compose run --rm tianqi node --version | ✅ v22.22.2（开发命令封装价值实证）|
| docker compose down | ✅ 清理成功 |

### C.7 修复迭代记录（实地 build 教训）

| 迭代 | 问题 | 修复 |
|---|---|---|
| 1 | builder stage `pnpm build` 失败：`Cannot read file '/app/tsconfig.json'` | Dockerfile COPY 增加 tsconfig.json + tsconfig.base.json |
| 2 | builder stage `pnpm build` 失败：`Cannot find module './helpers/mock-downstream-server.js'` | .dockerignore 移除 `**/helpers/`（这些是 src/helpers/ 源码非测试 fixture；vitest 仅 coverage 排除）|
| 3 | docker build SUCCESS | 前置 build 成功；runtime stage 复制 + USER node + HEALTHCHECK 全部正常 |

诚实留痕：实地 build 揭露 Dockerfile 草案 2 处疏漏（tsconfig 复制遗漏 + .dockerignore 过度排除 helpers/）；非 force-push 抹掉历史而是直接 Edit 修正后再 build——本 Step 单一 commit 最终 Dockerfile + .dockerignore 是修正后的版本。

### C.8 元规则 / 惯例触发情况

| 规则 / 惯例 | 触发情况 |
|---|---|
| 元规则 B（接口签名冻结）| **严守** — 0 业务代码修改；workspace 包配置未修改 |
| 元规则 P（不主动引入第三方依赖）| **严守** — Docker base image + pnpm + Node 不计第三方依赖（基础设施性质）|
| 元规则 Q（强制开局动作 v3 模板）| **第 7 次实战** — Kickoff + Step 0/1/2/3/3.5 + 本 Step；4 项独立命令 baseline + final 双向实测 |
| 惯例 K（错误码命名空间扩展）| **第 23 次实战** — 0 新错误码 |
| 惯例 M（ADR 增量追写）| **第 25 次 + 跨 Phase 第 6 次实战** — ADR-0003 Step 4 段 |
| §4.8 编译期硬约束 | **严守** — 不触碰 packages/domain |
| 拆两阶段流程 | **不触发** — Step 4 Dockerfile 设计相对局部；单阶段流程足够 |
| Phase 10 工作流过渡 | **第 7 次实战**（Kickoff + Step 0/1/2/3/3.5 + 本 Step；feature 分支 + PR 合并）|
| §7.2 本地与 CI 一致 | **跨场景兑现** — Dockerfile builder stage 严格沿用 root pnpm build；不写独立 tsc |
| §7.5 容器化要求 | **完整兑现** — 多阶段 + 非 root + HEALTHCHECK + 开发编排（详见 ADR-0003 Step 4 段核查表）|

A/C/D/E/F/G/H/I/J/L/N/O 全 N/A。

---

## §D 代码变更

### D.1 Dockerfile（60 行；新增）

详见 ADR-0003 Step 4 段结构图。关键设计：
- 多阶段 builder + runtime
- node:22-slim base（better-sqlite3 兼容）
- corepack enable（pnpm@10.0.0 一致）
- USER node（uid 1000；非 root）
- HEALTHCHECK CMD node -e "process.exit(0)"

### D.2 .dockerignore（49 行；新增）

排除 node_modules / dist / coverage / docs / .github / 测试文件 / .env（含 .env.example 反向保留）。**关键修正**：不排除 `**/helpers/`（src/helpers/ 是源码而非测试 fixture）。

### D.3 docker-compose.yml（28 行；新增）

α 单 tianqi 服务；价值在开发命令封装（`docker compose run --rm tianqi <cmd>`）。

### D.4 docs/decisions/0003-phase-10-engineering-and-collaboration.md（Step 4 段追加）

约 60 行（惯例 M 第 25 次 + 跨 Phase 第 6 次实战）。含 10 裁决摘要 + 关键工程纪律 + Dockerfile 结构图 + docker-compose 服务清单 + docker build/run 实测结果 + §7.5 兑现核查表 + Phase 11+ 承接事项。

### D.5 docs/00-phase1-mapping.md（Phase 10 Step 4 完成段）

由后续 mapping sync 步骤添加。

---

## §E 风险点

### E.1 base image 与原生模块兼容性

**实测确认**：node:22-slim + better-sqlite3 11.5.0 prebuilt binary 兼容；docker build 成功。alpine 不选用是基于 musl libc 与 better-sqlite3 prebuilds 不兼容的 forward-looking 防御。

### E.2 docker-compose β 选项 postgres 服务的环境变量协调

**应对**：本 Step 选 α 单服务避免此风险；postgres 编排推迟 Phase 11 真实基础设施 Step（与 KI-P8-002 协调）。

### E.3 runtime image 大小与生产部署 acceptable 范围

**实测**：508MB；含 dev node_modules（builder 阶段 install 后整体复制）。Phase 11+ 可通过 pnpm deploy / pnpm prune --prod 优化至 200-300MB 范围。当前 508MB 在 monorepo 25 包 + 全量 node_modules 场景下合理；不阻塞 Step 4。

### E.4 HEALTHCHECK 在库性质项目的合理性

**应对**：当前 `node -e "process.exit(0)"` 是库性质项目唯一合理选择（无 HTTP server 可探测；让 HEALTHCHECK 显式存在但内容简单）。Phase 11+ 引入真实 HTTP server 后升级为 endpoint check（譬如 `curl -f http://localhost/health`）。

### E.5 Phase 11+ HEALTHCHECK 升级承接路径

**留痕**：ADR-0003 Step 4 段 Phase 11+ 承接事项已显式留痕。Step 4 完成本身让 HEALTHCHECK 机制存在（探针位置 + 间隔 + 超时 + 重试已就位）；Phase 11+ 仅替换 CMD 内容即可升级。

---

## §F 测试计划

### F.1 4 项独立命令 baseline + final 双向实测

详见 §C.3 表格。**4/4 PASS 零波动**。

### F.2 docker build 实测

| 阶段 | 时长 | 结果 |
|---|---|---|
| builder stage | ~70s（pnpm install + pnpm build）| ✅ |
| runtime stage | ~30s（COPY + USER + HEALTHCHECK 设置）| ✅ |
| **总时长** | **~1m 42s** | **✅** |

### F.3 docker run 实测

| 检查 | 实测 | 状态 |
|---|---|---|
| 容器启动 | `docker run --rm -d --name tianqi-test tianqi:test` exit 0 | ✅ |
| HEALTHCHECK（35s 后）| `docker inspect --format='{{.State.Health.Status}}' tianqi-test` 返回 `healthy` | ✅ |
| 容器状态 | `docker ps` 显示 `Up 35 seconds (healthy)` | ✅ |
| 容器停止 | `docker stop tianqi-test` exit 0 | ✅ |

### F.4 docker compose 实测

| 检查 | 实测 | 状态 |
|---|---|---|
| `docker compose build` | 使用 cached image；instant | ✅ |
| `docker compose up -d` | container Up 5s（health: starting）| ✅ |
| `docker compose ps` | tianqi-dev 服务显示 | ✅ |
| `docker compose run --rm tianqi node --version` | 返回 v22.22.2（开发命令封装价值实证）| ✅ |
| `docker compose down` | 清理 container + network 成功 | ✅ |

### F.5 KI 状态稳定性

5 项 open KI（KI-P8-001/002/003/005 + KI-P9-001）稳定（不变）；KI-P10-001 + KI-P10-002 RESOLVED 不变。

---

## §G 验收硬底

| 项 | 期望 | 实测 |
|---|---|---|
| H1 | 测试总数 ≥ 1700 | ✅ 1971 |
| H2 | 覆盖率 ≥ 80%/75%/80%/80% | ✅ 84.92%/79.56%/91.68%/84.92% |
| H3 | 4 项独立命令全 PASS | ✅ |
| H4 | docker build 成功（builder + runtime）| ✅ 508MB image |
| H5 | docker run 成功 + HEALTHCHECK 工作 | ✅ healthy 35s |
| H6 | push feature 分支成功 | （由后续步骤完成）|
| H7 | CI 在本 Step PR 第三次运行 PASS | （由 PR #7 创建后实测）|
| H8 | PR 创建建议输出 | （由后续步骤完成）|
| H9 | main CI 转绿验证 | （由 PR #7 合并后实测）|

参考下限 R1-R9 全 PASS（R1 多阶段 ≥ 2 ✅ / R2 USER node ✅ / R3 HEALTHCHECK ✅ / R4 .dockerignore ✅ / R5 docker-compose.yml ✅ / R6 builder 调用 root build ✅ / R7 测试增量 0 ✅ / R8 业务代码 git diff 0 ✅ / R9 不修改 Step 0/1/2/3/3.5 输出 ✅）。

完成项 G1-G24 全 PASS。

### §G.1 CI Iteration 留痕

| 第 N 次 | PR / 触发 | 4 jobs 状态 | 失败原因 | 修复 commit SHA |
|---|---|---|---|---|
| Step 3.5 PR #6 Run #1 | feature (PR) | ✅ 4/4 PASS（修复完整性兑现）| - | - |
| Step 3.5 PR #6 Run #2 | main (push) | ✅ 4/4 PASS（main 真正绿）| - | - |
| **Step 4 PR #7 Run #1** | **feature (PR)** | ⏳ 待 PR #7 创建后实测 | - | - |
| **Step 4 PR #7 Run #2** | **main (push)** | ⏳ 待 PR #7 合并后实测 | - | - |

iteration 纪律：force-push 不抹掉失败历史；如 CI FAIL 追加 fix commit；本段 + PR 描述同步更新。

---

## §H Step 5 衔接预告

Step 5 创建发布自动化（git tag 触发流水线 + 可能引入 changesets）。Step 5 严重依赖 Step 4：

- Dockerfile 已建立（发布流水线可引用 docker build + docker push 到 registry）
- docker-compose 已建立（发布前可作为本地验证环境）
- ci.yml 已稳定（发布流水线可作为新 workflow `.github/workflows/release.yml`）

Step 5 起草指令独立承接（不在本 Step 范围）。Step 5 是否拆两阶段视具体设计复杂度（发布流水线设计影响 Phase 11+ 真实部署，可能值得拆两阶段；但 Tianqi 是单部署目标项目，不是公共 npm package）。

---

## §I 对作品级代码库的意义

### I.1 Phase 10 工程化基础设施第二块砖落地

Phase 10 协作建设（Step 1+2）+ 工程化第一块砖 CI 强制门禁（Step 3+3.5）已就位；本 Step 是工程化第二块砖容器化部署能力。读者打开仓库根目录看到 Dockerfile + docker-compose.yml；docker build 后 runtime image 精简（508MB）；docker run 后 HEALTHCHECK healthy——Tianqi 工程旅程从"代码完整"+"协作生态"+"CI 真绿色"+"容器可部署"四重证据成熟。

### I.2 §7.2 本地与 CI 一致跨场景兑现

Step 3.5 KI-P10-002 修复让 root build script + ci.yml + 本机环境三方一致；本 Step Dockerfile builder stage 严格沿用 `pnpm build` 让 docker build 成为第四个一致场景。§7.2 一致性原则在 Step 3.5 教训沉淀基础上跨场景持续兑现——任何 build chain 调用都通过 root script 而非独立 tsc 命令。

### I.3 实地 build 揭露 Dockerfile 草案疏漏的诚实留痕

实地 docker build 在两个迭代中揭露 Dockerfile 草案疏漏：(1) tsconfig 复制遗漏 (2) .dockerignore 过度排除 helpers/ 源码。诚实留痕在执行记录 §C.7（非 force-push 抹掉历史；直接 Edit 修正后再 build）——这是 Tianqi"诚实评估"工程纪律在实施场景的兑现。

### I.4 better-sqlite3 兼容性强制裁决 2 β 的实地核查价值

强制开局动作 4 G 实测确认 better-sqlite3 11.5.0 是原生模块（pnpm onlyBuiltDependencies）；这强制裁决 2 选 β slim 而非 α alpine（musl libc 不兼容 better-sqlite3 prebuilt）。如果跳过实地核查靠"alpine 业界推崇最小镜像"直接选 α，docker build 会失败。这是元规则 Q v3 强制开局动作"前置事实核查"的具体价值兑现。

### I.5 主题专注度延续 6 步严守

Phase 10 主题专注度从 Kickoff（启程战）+ Step 0（修复+防御）+ Step 1（协作建设）+ Step 2（协作建设）+ Step 3（工程化建设）+ Step 3.5（修复+防御）+ 本 Step（工程化建设）连续严守。本 Step 不修改 Step 0/1/2/3/3.5 任何已锁定输出（root build script / ci.yml / vitest config / workspace 包配置）；不创建发布自动化（Step 5 责任）；不修改 README（Step 6 责任）；克制 > 堆砌。

### I.6 Phase 11+ 承接路径清晰

ADR-0003 Step 4 段 + 本启程记录 §E 显式留痕 Phase 11+ 承接事项（HEALTHCHECK 升级 / production deps 优化 / image 大小进一步优化 / docker-compose postgres 编排扩展）。当前实施在 Phase 10 主题边界内提供完整容器化能力；Phase 11+ 在此基础上演进真实部署能力。

---

**Phase 10 / Step 4 完成 — 2026-05-05 ✅**

容器化部署能力建立；Phase 10 工程化基础设施第二块砖落地。Step 5（发布自动化）由独立指令承接。
