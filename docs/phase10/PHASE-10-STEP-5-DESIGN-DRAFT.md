# Phase 10 / Step 5 — 发布自动化（git tag 触发流水线）— PHASE_DESIGN 草案

> **状态**：DRAFT v1 — 等待用户 APPROVE
> **类型**：拆两阶段流程第 6 次实战 + 普通 Step 级别第 3 次（Step 3 + Step 3.5 + 本 Step）
> **草案时间**：2026-05-05
> **作废时点**：第二阶段 PHASE_IMPLEMENT 完成后本文件立即删除（设计沉淀进 ADR-0003 + .github/workflows/release.yml + 文档）

本草案是 Phase 10 / Step 5 拆两阶段流程的产物——发布版本约定 / docker push 决策 / changesets 决策影响 Phase 11+ 持续；用户审视 11 项裁决让设计稳健。

---

## §A 强制开局动作 1-5 执行确认

| # | 动作 | 状态 |
|---|---|---|
| 1 | 重读《宪法》§17 + 《补充文档》§7.3/§7.4/§13.1/§14 + ADR-0003 Step 0-4 段 | ✅ |
| 2 | 核查 KNOWN-ISSUES 5 项 open KI（KI-P10-001/002 RESOLVED）| ✅ |
| 3 | 核查 ADR-0001/0002 Accepted + ADR-0003 In Progress（Step 0-4 段已增量追写）| ✅ |
| 4 | 六项实地核查 A-F | ✅ — 详见 §B |
| 5 | 4 项独立命令 baseline 实测 | ✅ — 详见 §C |

---

## §B 强制开局动作 4 核查结果（六项 A-F）

### §B.1 既有发布配置

| 项 | 实测 |
|---|---|
| `.github/workflows/` | 仅 `ci.yml`（Step 3 创建；Step 3.5 修改）|
| `.changeset/` | **不存在**（未引入 changesets）|
| root `package.json` | `name: tianqi`, `version: 0.1.0`, **`private: true`**, 无 publishConfig |
| 各 packages `version` | 全部 `0.1.0`（统一版本；monorepo 共用版本）|

**结论**：Tianqi 是私有项目（`private: true`）；不发 npm registry；无既有发布配置；从零创建 release.yml。

### §B.2 git tag 现状

```
$ git tag --list
1.0.0
phase-9-closed
```

| Tag | 注释 | 性质 |
|---|---|---|
| `phase-9-closed` | "Phase 9 CLOSED: Saga orchestration architecture delivered..." | **Phase 工程旅程主线 tag**（Phase 9 / Step 19 创建）|
| `1.0.0` | "Add files via upload" | **历史遗留**（初始上传时打的；不在 Phase 主线；建议保留但不引用）|

**关键发现**：除 Phase 9 / Step 19 创建的 `phase-9-closed` 外，还有历史遗留 `1.0.0` semver tag。`1.0.0` 不在 Phase 工程旅程主线（描述"Add files via upload"显示是初始上传 batch 操作）；release.yml 触发条件应精确为 `phase-*-closed` glob 避免误触发 `1.0.0` 类 semver tag。

### §B.3 现有 ci.yml 协调

| 项 | 状态 |
|---|---|
| jobs | 4 jobs（lint / typecheck / test / coverage）|
| triggers | `pull_request:` + `push: branches: [main]` |
| Node | `'22'` (major-only) |
| pnpm | via `pnpm/action-setup@v4` + `packageManager` field |
| cache | `cache: 'pnpm'` (setup-node 内置) |
| build chain | test/coverage 含 `pnpm build` 步（Step 3.5 落地）|

**结论**：release.yml 应是独立 workflow（不与 ci.yml 合并）；可复用相同的 Node 22 / pnpm@10 / cache 模式。

### §B.4 Dockerfile 协调

| 项 | 状态 |
|---|---|
| FROM | `node:22-slim`（builder + runtime 两阶段）|
| USER | `node` (uid 1000) |
| HEALTHCHECK | `node -e "process.exit(0)"` |

**结论**：release.yml 如选裁决 3 B（docker push），可复用 Dockerfile 进行 `docker build` + `docker push`。当前实测 image 大小 508MB（含 dev deps；Step 4 实测）。

### §B.5 项目性质判断

| 维度 | 实测 |
|---|---|
| Tianqi 类型 | monorepo 库性质（25 包；测试 1971 个）|
| root | `private: true`；无 main/bin/start |
| application | `@tianqi/application` 库（仅 main: dist/index.js）|
| 公共发布 | **不发 npm registry**（私有；publishConfig 不存在）|
| Docker registry | 未确定（候选 ghcr.io 或推迟）|

**关键工程纪律**：Tianqi 当前 release 价值是"phase-N-closed tag 触发归档"——CHANGELOG 同步 + GitHub Release 创建 + ADR 状态变更（不 push 镜像 / 不 publish 包）。其他候选：
- α phase-N-closed 归档 only（推荐；最克制）
- β α + docker push 到 ghcr.io（forward-looking；增加 GitHub Token 权限配置成本）
- γ α + npm publish（不适用；private 项目）

### §B.6 changesets 评估

| 维度 | 评估 |
|---|---|
| changesets 价值 | 自动 CHANGELOG 生成 / 多包版本递增 / PR 集成 |
| changesets 成本 | 第三方依赖（违反元规则 P）+ 学习曲线 + 与 phase-N-closed 约定协调成本 |
| Tianqi 当前 | 单部署目标 + 单一 tag 约定 + 单一 CHANGELOG（手工维护 in Step 7）|
| 引入决策 | **α 不引入** — Tianqi 单部署目标 + 单一 tag 约定 + Phase 13+ 如有真实多包版本管理需求再评估 |

**结论**：α 不引入 changesets；裁决 2 α 严守。

---

## §C 强制开局动作 5 — 4 项独立命令 baseline

| # | 命令 | 实测输出 |
|---|---|---|
| 1 | `pnpm lint` | exit 0; 0 errors / 0 warnings ✅ |
| 2 | `pnpm typecheck` | exit 0 ✅ |
| 3 | `pnpm test` | **1971（1867 passed + 104 skipped）** ✅ |
| 4 | `pnpm test:coverage` | **84.92% / 79.57% / 91.68% / 84.92%** ✅ |

预期本 Step 完成后零波动（release.yml + 文档不影响 4 项命令检查范围）。

---

## §D 11 个核心裁决摘要

### 裁决 1：发布触发机制 — **A push tag**

✅ `on.push.tags: ['phase-*-closed']`（与 Phase 9 / Step 19 phase-N-closed 约定一致）

**实测协调**：B.2 实测发现历史 `1.0.0` tag；触发 glob 精确为 `phase-*-closed` 避免误触发 semver tag。

### 裁决 2：是否引入 changesets — **α 不引入**

✅ Tianqi 私有项目 + 单部署目标 + 单一 tag 约定 + 单一 CHANGELOG（手工维护）；元规则 P 严守。Phase 13+ 如有真实多包版本管理需求再评估。

### 裁决 3：docker push 目标 — **A 不 push（推迟 Phase 11+）**

**理由**：
- Step 5 主题专注"发布流水线建立"
- docker build 验证已通过 Step 4 实地验证（runtime image 508MB；HEALTHCHECK healthy）
- ghcr.io / Docker Hub 推迟 Phase 11+ 真实部署阶段
- 若选 B ghcr.io 需要 GITHUB_TOKEN 权限配置 + push 步骤，增加 Step 5 复杂度

**Phase 11+ 承接**：当真实部署需求出现时，可在 release.yml 追加 `docker login ghcr.io` + `docker build` + `docker push` 步骤。

### 裁决 4：GitHub Release 自动创建 — **A draft + 用户手动 publish**

✅ release.yml 自动创建 GitHub Release as draft；用户审视 release notes 后手动 publish。

**理由**：
- A 让发布有"draft 审视 → publish 确认"双步保护
- 与 Phase 10 工作流过渡"用户审视合并"精神一致
- B 自动 publish 让发布失去人工审视机会

### 裁决 5：发布版本约定 — **α 沿用 phase-N-closed**

✅ Phase 9 / Step 19 已建立的约定继续锁定。

**理由**：
- phase-N-closed 是 Tianqi 工程旅程的天然里程碑
- semver 让 Tianqi 变成"传统软件"——但 Tianqi 是工程旅程项目
- 历史 `1.0.0` tag 保留但不引用（B.2 实测发现）
- Phase 13+ 如有公共发布需求再评估 semver

### 裁决 6：release.yml 内容范围 — **最简（裁决 2 α + 3 A + 4 A + 5 α）**

```
[release.yml steps]
  1. actions/checkout@v4 (fetch-depth: 0; full git history for CHANGELOG extraction)
  2. pnpm/action-setup@v4
  3. actions/setup-node@v4 (node-version: '22'; cache: 'pnpm')
  4. pnpm install --frozen-lockfile
  5. pnpm build (与 Step 3.5 build chain 协调; 验证 release tag commit 可 build)
  6. CHANGELOG 段提取 (用 awk; 详见裁决 7)
  7. softprops/action-gh-release@v2 (draft: true; release notes from extracted CHANGELOG)
```

**关键**：actions/create-release@v1 已 deprecated；推荐 softprops/action-gh-release@v2（业界最广泛使用的非官方 action 但维护活跃 + GitHub 推荐）。如严守"GitHub 官方 actions only"，可改用 `gh release create` CLI。

**v1 草案选择**：softprops/action-gh-release@v2（业界标准）；如用户审视后倾向 `gh release create` CLI 路径，v2 修订即可。

### 裁决 7：CHANGELOG 段提取策略 — **A awk 解析**

```bash
# 提取 CHANGELOG.md 中匹配当前 tag 的 phase 段
TAG_NAME="${{ github.ref_name }}"  # e.g. phase-10-closed
PHASE_NUM=$(echo "$TAG_NAME" | sed -E 's/phase-([0-9]+)-closed/\1/')

awk -v phase="Phase $PHASE_NUM" '
  /^## \[/ { if (printing) exit; if ($0 ~ phase) printing=1 }
  printing
' CHANGELOG.md > release-notes.md
```

**理由**：
- A 让 CHANGELOG.md 与 GitHub Release 一致（单一权威源）
- B git log 自动生成让 release notes 与 CHANGELOG.md 不一致（双重维护）
- C 不提取让 release notes 流于形式

### 裁决 8：是否在 ci.yml 添加 release workflow validation — **A 不添加**

✅ release.yml 触发条件是 tag push；CI 不需 validate；release.yml 与 ci.yml 职责分离。

### 裁决 9：CONTRIBUTING.md 同步追加 ## Release Process 段 — **α 同步追加**

```markdown
## Release Process

Releases are triggered by pushing a tag matching `phase-*-closed` (e.g. `phase-10-closed`).

1. Maintainer ensures `CHANGELOG.md` has the new phase section
2. Maintainer creates and pushes the tag:
   ```bash
   git tag -a phase-N-closed -m "Phase N CLOSED: <theme>"
   git push origin phase-N-closed
   ```
3. `.github/workflows/release.yml` automatically creates a GitHub Release as a **draft**
4. Maintainer reviews the draft and clicks "Publish release"

Release notes are auto-extracted from the corresponding `CHANGELOG.md` phase section.
```

CONTRIBUTING.md 94 → 约 105 行（**注意**：超 100 行硬底；需要权衡——是裁决 9 选 β 不追加 vs 裁决 9 α 但调整 CONTRIBUTING ≤ 100 硬底？）。

**v1 实地裁决**：选 α 追加；接受 CONTRIBUTING 突破 100 行硬底——理由：100 行硬底是 Phase 10 / Step 1 的设计目标（基于 4 段内容 + ≤ 25 行/段平均），但 Step 2 + 3 + 5 各加 4-7 行后总长接近 100；硬底更新为 ≤ 110 行（合理增长；不让 CONTRIBUTING 在 Step 5 截止）。

**或者 v1 备选**：写更精简的 ## Release Process 段（约 6-8 行）让 CONTRIBUTING 维持 ≤ 100。

由用户审视决定（详见 §K K.5）。

### 裁决 10：错误码 / 新 Port / 新 Adapter / 新 workspace 包 / 第三方依赖 — **0 新增**

✅ 惯例 K 第 24 次实战；元规则 P 累计 27 步零新依赖（GitHub 官方 + 业界标准 actions 不计）。

**注**：softprops/action-gh-release@v2 是非官方 action 但业界标准（约 6k+ star；GitHub 推荐）。如严守"仅 GitHub 官方 actions"，需改用 `gh release create` CLI。

### 裁决 11：ADR-0003 Step 5 段（含 Step 4 收尾微调留痕）

约 50 行（惯例 M 第 26 次 + 跨 Phase 第 7 次实战）。详见 §G。

---

## §E release.yml 完整草案

```yaml
# Tianqi Release Automation — Phase 10 / Step 5
#
# Triggered by pushing a tag matching `phase-*-closed` (e.g. `phase-10-closed`).
# The historical `1.0.0` tag (initial upload artifact) is intentionally NOT
# matched — only Phase milestone tags trigger release automation.
#
# This workflow:
#   1. Builds the workspace (with the same root build script as CI; §7.2 一致性)
#   2. Extracts the matching CHANGELOG.md phase section as release notes
#   3. Creates a GitHub Release as DRAFT (per ADR-0003 Step 5 裁决 4 A;
#      maintainer reviews + publishes manually)
#
# Phase 11+ may add: docker push to ghcr.io, npm publish, etc.

name: Release

on:
  push:
    tags:
      - 'phase-*-closed'

permissions:
  contents: write  # required to create GitHub Release

jobs:
  release:
    name: Create GitHub Release (draft)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # full history for CHANGELOG context

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      # Verify the tagged commit can build (§7.2 一致性 + Step 3.5 build chain)
      - run: pnpm build

      # Extract CHANGELOG section matching this tag's phase number
      - name: Extract release notes from CHANGELOG.md
        id: extract
        run: |
          TAG_NAME="${GITHUB_REF_NAME}"
          PHASE_NUM=$(echo "$TAG_NAME" | sed -E 's/phase-([0-9]+)-closed/\1/')
          echo "Extracting CHANGELOG section for Phase $PHASE_NUM..."

          awk -v phase="Phase $PHASE_NUM" '
            /^## \[/ {
              if (printing) exit
              if ($0 ~ phase) printing = 1
            }
            printing
          ' CHANGELOG.md > release-notes.md

          echo "--- Extracted release notes ---"
          cat release-notes.md
          echo "---"

          if [ ! -s release-notes.md ]; then
            echo "::warning::No CHANGELOG section found for Phase $PHASE_NUM; release will have empty notes"
          fi

      # Create GitHub Release as draft (per 裁决 4 A)
      - name: Create GitHub Release (draft)
        uses: softprops/action-gh-release@v2
        with:
          draft: true
          name: ${{ github.ref_name }}
          body_path: release-notes.md
          generate_release_notes: false  # use our extracted notes only
```

---

## §F CONTRIBUTING ## Release Process 段草案（裁决 9 α）

```markdown
## Release Process

Releases are triggered by pushing a tag matching `phase-*-closed` (e.g. `phase-10-closed`). The historical `1.0.0` tag is not part of the Phase release stream.

1. Maintainer ensures `CHANGELOG.md` has the new phase section
2. Maintainer creates and pushes the annotated tag:
   ```bash
   git tag -a phase-N-closed -m "Phase N CLOSED: <theme>"
   git push origin phase-N-closed
   ```
3. `.github/workflows/release.yml` automatically creates a GitHub Release as a **draft**
4. Maintainer reviews the draft and clicks "Publish release"

Release notes are auto-extracted from the matching `CHANGELOG.md` phase section.
```

**长度估算**：CONTRIBUTING.md 94 → ~108 行（突破原 100 硬底；详见 §K K.5）。

**备选精简版本**（约 7 行；让 CONTRIBUTING 维持 ≤ 100）：

```markdown
## Release Process

Releases trigger by pushing a `phase-N-closed` tag (e.g. `phase-10-closed`). The release workflow (`.github/workflows/release.yml`) creates a **draft** GitHub Release with notes auto-extracted from the matching `CHANGELOG.md` phase section. Maintainer reviews and publishes the draft manually. See ADR-0003 Step 5 for design rationale.
```

由用户审视决定（详见 §K K.5）。

---

## §G ADR-0003 Step 5 段草案（含 Step 4 收尾微调留痕）

```markdown
### Step 5: 发布自动化（git tag 触发流水线）

**性质**：Phase 10 第三个工程化建设 Step（Step 3 + 3.5 第一块砖 CI 强制门禁；Step 4 第二块砖容器化；本 Step 第三块砖发布自动化）。拆两阶段流程第 6 次实战 + 普通 Step 级别第 3 次（Step 3 + Step 3.5 + 本 Step）。

**11 项核心裁决摘要**：

| # | 裁决 | 选择 | 理由 |
|---|---|---|---|
| 1 | 触发机制 | A push tag | 与 phase-N-closed 约定一致；触发 glob `phase-*-closed` 精确避免误触发 `1.0.0` |
| 2 | changesets | α 不引入 | Tianqi 私有 + 单部署 + 元规则 P 严守 |
| 3 | docker push 目标 | A 不 push（推迟 Phase 11+）| Step 5 主题专注；避免 GHCR 权限配置成本 |
| 4 | GitHub Release | A draft + 手动 publish | 用户审视双步保护 |
| 5 | 发布版本约定 | α phase-N-closed | 沿用 Phase 9 / Step 19 约定 |
| 6 | release.yml 内容 | 最简 7 步（含 build + CHANGELOG 提取 + draft release）| 主题专注 |
| 7 | CHANGELOG 提取 | A awk 解析 | CHANGELOG 与 GitHub Release 单一权威源 |
| 8 | ci.yml 添加 release validation | A 不添加 | 职责分离 |
| 9 | CONTRIBUTING ## Release Process | α 追加（约 12 行；CONTRIBUTING 94 → 108；硬底升级 ≤ 110）| 让 contributors 看到完整发布流程 |
| 10 | 0 新增 | 错误码 / Port / Adapter / 包 / 第三方依赖 | 惯例 K 第 24 次；元规则 P 累计 27 步 |
| 11 | ADR Step 5 段 | B（约 50 行；惯例 M 第 26 次 + 跨 Phase 第 7 次实战）| - |

**关键工程纪律**：

- release.yml `pnpm build` 步严守 §7.2 一致性 + Step 3.5 build chain 协调
- 触发 glob `phase-*-closed` 精确匹配；不误触发历史 `1.0.0` tag（Step 5 §B.2 实测发现）
- softprops/action-gh-release@v2 是非官方但业界标准（约 6k+ star；GitHub 推荐）；如严守"仅 GitHub 官方"可改 `gh release create` CLI

**Step 4 收尾微调留痕**（协作 prompt 设计微调点）：

Step 4 main CI 转绿验证回执环节，AI 对"PR URL + merge SHA + main CI 4 jobs 状态"数据格式过度坚持。用户已用最简方式（看 CI 状态指示符）兑现 H9 硬底实质（main 真正绿）后，AI 仍重复要求标准数据格式。这是协作 prompt 设计的微调点——纪律核心是"实质兑现"被验证而非"数据格式齐全"。Step 5 起草指令的"main CI 转绿验证"硬底（H9）已显式接受最简实质回执（譬如"全绿"）；此微调沉淀进 Step 5 + 后续 Step 起草指令。

**Phase 11+ 承接事项**：

- docker push 到 ghcr.io（如真实部署需求出现）
- changesets 引入（如多包版本管理需求出现）
- semver 引入（如公共发布需求出现）
- 真实 registry 配置（私有 registry / Docker Hub 等）
- release notes 自动生成扩展（譬如 git log diff 增量信息）

**Step 5 工程意义**：Phase 10 工程化基础设施第三块砖落地（CI ✅ + 容器化 ✅ + 本 Step 发布自动化 ✅ = 3/4 块砖）。Step 7 phase-10-closed tag push 即触发 release.yml 第一次真实运行——元规则 B 在工作流层面再次兑现（release.yml 接口冻结后 Phase 11+ 在此基础上演进）。
```

---

## §H 风险点与 fallback 方案

### H.1 release.yml 第一次 tag push 触发的不确定性

**风险**：本 Step 不实际 push tag 触发 release（避免污染 main git tag 历史）；release.yml 第一次真实触发是 Step 7 phase-10-closed tag 创建时。

**Fallback**：本 Step yml syntax 验证（GitHub Actions UI 自动验证 push 后）；Step 7 起草指令显式含"release.yml 第一次真实运行实测"硬底。

### H.2 CHANGELOG 段提取的 awk 鲁棒性

**风险**：awk 模式 `/^## \[/ ... if ($0 ~ phase)` 依赖 CHANGELOG.md 段标题格式 `## [Phase N]`。如 CHANGELOG 格式变化（譬如 `## Phase N` 无 `[]`）则提取失败。

**Fallback**：草案明示 CHANGELOG 段标题约定（沿用 Phase 8 + Phase 9 既有格式 `## [Phase N] — YYYY-MM-DD — <Theme>`）；release.yml 含 `if [ ! -s release-notes.md ]; then echo ::warning::` 提示空 notes 不让 release 失败。

### H.3 GitHub Release draft 用户审视流程

**应对**：CONTRIBUTING ## Release Process 段明示 4 步流程（含 step 4 maintainer reviews and publishes）；用户在 Step 7 phase-10-closed tag push 后实地体验。

### H.4 softprops/action-gh-release@v2 第三方 action 选择风险

**风险**：softprops/action-gh-release 不是 GitHub 官方 action（虽然 GitHub 在文档推荐）；可能未来维护变化。

**Fallback**：v1 草案选 softprops 业界标准；如用户审视后倾向"仅 GitHub 官方"严守，v2 修订改用 `gh release create` CLI（GitHub 官方 CLI；预装在 ubuntu-latest runner）。

### H.5 CONTRIBUTING.md 突破 100 行硬底

**风险**：裁决 9 α 完整版让 CONTRIBUTING 94 → 108 行（突破原 100 硬底）。

**Fallback**：v1 提供两个方案（完整 ~12 行版本；精简 ~7 行版本）让用户审视决定。完整版需要硬底升级（≤ 100 → ≤ 110）；精简版让信息密度更高但牺牲清晰度。

### H.6 历史 `1.0.0` tag 处理

**应对**：触发 glob `phase-*-closed` 精确匹配；不主动删除 `1.0.0` tag（保留历史；不引用）；ADR-0003 Step 5 段 + CONTRIBUTING 显式说明 `1.0.0` 不在 Phase release stream。

---

## §I 本机 commit 信息（PHASE_DESIGN 第一阶段）

**待执行**：第一阶段 commit 1 个（仅本草案文档）；严禁 push。

```
git add docs/phase10/PHASE-10-STEP-5-DESIGN-DRAFT.md
git commit -m "docs(decisions): draft Phase 10 Step 5 release automation design"
```

预期 commit SHA 在 §J 输出时填入。

---

## §J 草案文档位置

`docs/phase10/PHASE-10-STEP-5-DESIGN-DRAFT.md`（本文件；PHASE_IMPLEMENT 阶段完成后立即删除）

---

## §K 核心未决判断（请重点审视）

### K.1 裁决 6 release.yml softprops/action-gh-release@v2 vs gh release create CLI

**决议**：v1 草案选 **softprops/action-gh-release@v2**（业界标准）。

**审视点**：
- 是否担心 softprops 非 GitHub 官方？
- 是否倾向 `gh release create` CLI（GitHub 官方 + 预装 runner）？
- 严守"仅 GitHub 官方 actions"原则是否优先于"业界标准 actions"实用性？

**AI 建议**：softprops/action-gh-release@v2（业界标准；约 6k+ star；GitHub 文档推荐；与 actions/checkout / pnpm/action-setup 同性质 — 业界标准 actions 不计为第三方依赖）。如用户严守"仅 GitHub 官方"可 v2 修订改 CLI 路径。

### K.2 裁决 9 CONTRIBUTING ## Release Process 段长度策略

**决议**：v1 草案选 **完整版（约 12 行；CONTRIBUTING 94 → 108；硬底 ≤ 100 → ≤ 110）**。

**审视点**：
- 是否同意 CONTRIBUTING 硬底升级 ≤ 100 → ≤ 110（合理增长）？
- 还是选精简版（约 7 行；CONTRIBUTING 94 → ~101；近临界但仍偏 ≤ 100）？
- 还是 β 不追加（推迟 Phase 10 / Step 7 收官时统一追加）？

**AI 建议**：完整版 + 硬底升级 ≤ 110。理由：CONTRIBUTING 在 Phase 10 全程逐步丰富（Step 1 创建 84 → Step 2 +6 → Step 3 +4 → Step 5 +12 = 106）；硬底 100 是 Step 1 设计目标，让 Step 5 截止不合理。

### K.3 裁决 3 docker push 目标（A 不 push vs B ghcr.io）

**决议**：v1 草案选 **A 不 push（推迟 Phase 11+）**。

**审视点**：
- 是否同意 docker push 推迟 Phase 11+（最克制）？
- 还是倾向 B ghcr.io（forward-looking；让 release.yml 一开始就含 docker push 步骤）？
- B 需要用户在 GitHub Settings 配置 GHCR 权限作为前置；是否可接受？

**AI 建议**：A 不 push。理由：
- Step 5 主题专注"发布流水线建立"
- ghcr.io 配置不在 Phase 10 主题边界（Phase 11 真实部署阶段更合适）
- 当前 docker build 验证已通过 Step 4 实地验证
- A 让 release.yml 简单清晰；B 后续在 release.yml 追加 push 步骤即可

### K.4 裁决 1 触发 glob `phase-*-closed` 精确性

**决议**：v1 草案选 **`phase-*-closed`** glob（精确匹配 phase-N-closed 模式）。

**审视点**：
- B.2 实测发现历史 `1.0.0` tag；触发 glob 精确避免误触发是否同意？
- 是否需要更精确（`phase-[0-9]+-closed`）？
- 还是 `*-closed` 宽松（让未来 sprint-N-closed 等约定也触发）？

**AI 建议**：`phase-*-closed` 精确。理由：
- `*-closed` 太宽松（意外匹配其他 -closed 后缀 tag）
- `phase-[0-9]+-closed` 更精确但 GitHub Actions tags glob 不支持完整正则
- `phase-*-closed` 是平衡（既精确又简单）

### K.5 main CI 转绿验证回执方式（Step 4 收尾微调延续）

**决议**：本 Step 接受**最简实质回执**（譬如"全绿"）。

**审视点**：
- 是否同意 Step 4 收尾微调留痕沉淀进 ADR Step 5 段（详见 §G 末尾）？
- 是否需要更显式的回执格式约定（避免再次微调）？

**AI 建议**：保留最简实质回执 + ADR Step 5 段留痕（让协作 prompt 设计教训沉淀）。

---

## 等待用户回执（PHASE_DESIGN）

**v1 草案完成。请审视后回执三选一**：

- **APPROVE** — 进入 PHASE_IMPLEMENT 阶段（删除草案 + 创建 .github/workflows/release.yml + CONTRIBUTING 追加 Release Process 段 + ADR-0003 Step 5 段 + docs/phase10/07 + push + PR #8）
- **REQUEST_CHANGES + 反馈** — 草案需修改具体位置（譬如调整 K.1 softprops vs CLI / K.2 CONTRIBUTING 长度策略 / K.3 docker push / 等）
- **REJECT + 重大方向调整** — 整体方向需重新设计

**第二阶段 PHASE_IMPLEMENT 仅在收到明确 APPROVE 后启动。回执前不修改实际代码 / 不 push 任何内容**。

---

**Phase 10 / Step 5 PHASE_DESIGN 草案完成 — 2026-05-05**

拆两阶段流程第 6 次实战 + 普通 Step 级别第 3 次 + 工程化第三块砖设计。
