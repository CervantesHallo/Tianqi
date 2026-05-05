# Phase 10 / Step 5 — 发布自动化（git tag 触发流水线）— PHASE_DESIGN 草案 v2

> **状态**：DRAFT v2 — 用户 v1 REQUEST_CHANGES + 反馈后修订；等待 v2 APPROVE
> **类型**：拆两阶段流程第 6 次实战 + 普通 Step 级别第 3 次（Step 3 + Step 3.5 + 本 Step）
> **版本**：v2（v1 用户审视后第 1 轮修订）
> **草案时间**：2026-05-05
> **作废时点**：第二阶段 PHASE_IMPLEMENT 完成后本文件立即删除（设计沉淀进 ADR-0003 + .github/workflows/release.yml + 文档）

本草案是 Phase 10 / Step 5 拆两阶段流程的产物——发布版本约定 / docker push 决策 / changesets 决策影响 Phase 11+ 持续；用户审视 11 项裁决让设计稳健。

## v2 修订说明（用户审视后落地）

用户 v1 回执：REQUEST_CHANGES + 2 项必做修订 + 3 项不阻塞观察。

**v2 已落地的 2 项必做修订**：

1. **修订 1（K.1 softprops → gh CLI）**：release.yml 第 7 步用 `gh release create` CLI 替代 softprops/action-gh-release@v2。理由：**元规则 P 在"有 GitHub 官方等价物"场景严守**。ADR-0003 Step 5 段追加"第三方 action 严格度判断"段（4 类型 + 判断顺序 + Phase 11+ 沿用准则）。详见 §D 裁决 6 + §E + §G + §H.4
2. **修订 2（K.2 CONTRIBUTING 不升级硬底）**：CONTRIBUTING ## Release Process 段控制在 9 行内（精简版）；保持 **≤ 100 行硬底；不升级 ≤ 110**。如 PHASE_IMPLEMENT 阶段实测确实超 100，由 AI 进一步精简至 6-7 行。详见 §D 裁决 9 + §F + §H.5

**v2 已落地的 3 项不阻塞观察微调**：

3. **K.3 docker push 推迟 Phase 11+**：ADR Step 5 段 Phase 11+ 承接事项追加"**Phase 11 起草指令必含 docker push 决策**"（强化提醒）
4. **K.4 phase-*-closed glob**：ADR Step 5 段 Phase 11+ 承接事项追加"**未来非数字 tag 评估**：如未来引入 sprint-N-closed 等约定，需在 ADR 修订评估 release.yml 触发 glob 调整"
5. **K.5 最简实质回执**：ADR Step 5 段含"Step 4 收尾微调留痕"段 + "v2 修订工程纪律小总结"段（K.1 + K.2 沉淀作为元规则 P + 克制原则的延伸）

**v2 工程纪律小总结**（用户 v1 回执沉淀）：

K.1 + K.2 是元规则 P + "克制 > 堆砌"原则的两次延伸应用：
- **K.1**：第三方 actions 不是"业界标准就引"，而是"无官方等价物才引"
- **K.2**：硬底不是"扩展性指标"，而是"克制原则的具体边界"

这两条纪律延伸本身是 Step 5 的工程价值——发布自动化主题揭露的纪律边界，比 release.yml 本身更长期影响 Tianqi 工程旅程。

**v2 修订完成；等待 v2 APPROVE 进入 PHASE_IMPLEMENT 阶段**。

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

### 裁决 6：release.yml 内容范围 — **最简（裁决 2 α + 3 A + 4 A + 5 α）+ v2 修订 gh CLI**

```
[release.yml steps]
  1. actions/checkout@v4 (fetch-depth: 0; full git history for CHANGELOG extraction)
  2. pnpm/action-setup@v4
  3. actions/setup-node@v4 (node-version: '22'; cache: 'pnpm')
  4. pnpm install --frozen-lockfile
  5. pnpm build (与 Step 3.5 build chain 协调; 验证 release tag commit 可 build)
  6. CHANGELOG 段提取 (用 awk; 详见裁决 7)
  7. gh release create CLI (GitHub 官方; runner 预装; draft: true)  ← v2 修订
```

**v2 修订（K.1 用户决议）**：从 softprops/action-gh-release@v2 改为 **`gh release create` CLI**。

**理由**：
- actions/create-release@v1 已 deprecated（不可用）
- softprops/action-gh-release@v2 是业界最广泛非官方 action（约 6k+ star）
- **gh CLI 是 GitHub 官方等价物**（ubuntu-latest runner 预装；不需 third-party action）
- **元规则 P 在"有 GitHub 官方等价物"场景严守**——softprops 业界标准但有官方等价物；不引入第三方依赖

**v2 实施草案**：

```yaml
- name: Create GitHub Release (draft)
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    gh release create "$GITHUB_REF_NAME" \
      --draft \
      --title "$GITHUB_REF_NAME" \
      --notes-file release-notes.md
```

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

✅ 惯例 K 第 24 次实战；元规则 P 累计 27 步零新依赖（GitHub 官方 + 业界标准 actions 不计；**gh CLI 是 GitHub 官方等价物 — v2 修订严守元规则 P 在有官方等价物场景**）。

**v2 修订留痕**：v1 草案曾考虑 softprops/action-gh-release@v2（业界最广泛非官方 action）；用户 v1 审视后明示元规则 P 在"有 GitHub 官方等价物"场景严守 → v2 改用 `gh release create` CLI（runner 预装；GitHub 官方）。详见 §G ADR Step 5 段"第三方 action 严格度判断"段。

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

      # Create GitHub Release as draft (per 裁决 4 A; v2 修订 K.1 gh CLI)
      # gh CLI is preinstalled on ubuntu-latest runners (GitHub 官方); no
      # third-party action required. 元规则 P 在"有 GitHub 官方等价物"
      # 场景严守 — 详见 ADR-0003 Step 5 § 第三方 action 严格度判断段.
      - name: Create GitHub Release (draft)
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh release create "$GITHUB_REF_NAME" \
            --draft \
            --title "$GITHUB_REF_NAME" \
            --notes-file release-notes.md
```

---

## §F CONTRIBUTING ## Release Process 段草案（裁决 9 α；v2 修订 K.2 精简版）

**v2 修订（K.2 用户决议）**：精简版 8-9 行；保持 CONTRIBUTING ≤ 100 行硬底；**不升级硬底 ≤ 110**。

```markdown
## Release Process

Releases are triggered by pushing a tag matching `phase-*-closed` (e.g.
`phase-10-closed`); the historical `1.0.0` tag is not part of the Phase
release stream. The release workflow (`.github/workflows/release.yml`)
runs `pnpm build`, extracts the matching `CHANGELOG.md` phase section,
and creates a **draft** GitHub Release. The maintainer reviews the draft
and clicks "Publish release" to make it public. See ADR-0003 Step 5 for
the full design rationale (release notes extraction, draft-only policy,
and the deferral of `docker push` to Phase 11+).
```

**长度估算**：精简版约 9 行（标题 + 空行 + 8 行段落）；CONTRIBUTING.md 94 → 约 103 行。

**实测确认**：v2 修订草案 9 行内容超过原 ≤ 100 硬底约 3 行。**v2 实测验证**：PHASE_IMPLEMENT 阶段实地核查后；如确实超 100 行，由 AI 进一步精简至 6-7 行（保留核心信息：触发条件 + workflow 行为 + draft 模式 + ADR 引用）。**默认走精简版；硬底 ≤ 100 严守**。

**v1 备选完整版（已废弃）**：v1 草案曾提议 12 行完整版（含 4 步流程 + 命令示例）；用户 v1 审视后明示"硬底不是扩展性指标，而是克制原则的具体边界" → v2 改精简版。

---

## §G ADR-0003 Step 5 段草案（v2 修订；含双重纪律延伸 + Step 4 收尾微调留痕）

```markdown
### Step 5: 发布自动化（git tag 触发流水线）

**性质**：Phase 10 第三个工程化建设 Step（Step 3 + 3.5 第一块砖 CI 强制门禁；Step 4 第二块砖容器化；本 Step 第三块砖发布自动化）。拆两阶段流程第 6 次实战 + 普通 Step 级别第 3 次（Step 3 + Step 3.5 + 本 Step）。**v1 → v2 修订**：K.1 softprops → gh CLI（元规则 P 严守）+ K.2 CONTRIBUTING 精简版（不升级硬底）。

**11 项核心裁决摘要**：

| # | 裁决 | 选择 | 理由 |
|---|---|---|---|
| 1 | 触发机制 | A push tag + glob `phase-*-closed` | 精确匹配；避免误触发历史 `1.0.0` |
| 2 | changesets | α 不引入 | Tianqi 私有 + 单部署 + 元规则 P 严守 |
| 3 | docker push 目标 | A 不 push（推迟 Phase 11+）| Step 5 主题专注；**Phase 11 起草指令必含 docker push 决策**（v2 修订建议）|
| 4 | GitHub Release | A draft + 手动 publish | 用户审视双步保护 |
| 5 | 发布版本约定 | α phase-N-closed | 沿用 Phase 9 / Step 19 约定 |
| 6 | release.yml 内容 | 最简 7 步（含 build + CHANGELOG 提取 + draft release）| 主题专注 |
| 7 | CHANGELOG 提取 | A awk 解析 | CHANGELOG 与 GitHub Release 单一权威源 |
| 8 | ci.yml 添加 release validation | A 不添加 | 职责分离 |
| 9 | CONTRIBUTING ## Release Process | **α 精简版**（约 9 行；CONTRIBUTING 94 → ~103；**v2 修订：硬底 ≤ 100 严守不升级**）| 让 contributors 看到完整发布流程 + 克制 |
| 10 | 0 新增 | 错误码 / Port / Adapter / 包 / 第三方依赖 | 惯例 K 第 24 次；元规则 P 累计 27 步；**v2 修订 gh CLI 是 GitHub 官方等价物严守元规则 P** |
| 11 | ADR Step 5 段 | B（约 60 行；惯例 M 第 26 次 + 跨 Phase 第 7 次实战）| - |

**关键工程纪律**：

- release.yml `pnpm build` 步严守 §7.2 一致性 + Step 3.5 build chain 协调
- 触发 glob `phase-*-closed` 精确匹配；不误触发历史 `1.0.0` tag（Step 5 §B.2 实测发现）
- **gh release create CLI 替代 softprops/action-gh-release@v2**（v2 修订；元规则 P 严守；详见下方"第三方 action 严格度判断"段）

**第三方 action 严格度判断**（v2 修订；用户 K.1 决议沉淀）：

v1 草案曾选 softprops/action-gh-release@v2（业界最广泛非官方 action；约 6k+ star；GitHub 文档推荐）。v1 → v2 修订基于用户裁决：

> **元规则 P 在"有 GitHub 官方等价物"场景严守**——softprops 业界标准但 GitHub 提供官方 `gh release create` CLI（runner 预装；同样功能）；引入 softprops 即引入第三方依赖；不引入第三方依赖原则严守。

延伸纪律（Phase 11+ 沿用）：

| 第三方 action 类型 | 严格度 | 处置 |
|---|---|---|
| GitHub 官方（actions/checkout / actions/setup-node 等）| 严守不计 | 自由使用 |
| 业界标准但有 GitHub 官方等价物（softprops vs gh CLI）| **严守元规则 P** | 用官方等价物 |
| 业界标准且无 GitHub 官方等价物（pnpm/action-setup）| 业界标准不计 | 可使用 |
| 一次性脚本（actions/github-script）| 业界标准不计 | 可使用但优先 inline shell |

**第三方 action 严格度判断准则**：判断顺序（1）有 GitHub 官方等价物吗？→（2）有 GitHub runner 预装 CLI 吗？→（3）业界标准 + 维护活跃吗？只有（3）才进入"业界标准 actions 不计"豁免范围。

**Step 4 收尾微调留痕**（协作 prompt 设计微调点）：

Step 4 main CI 转绿验证回执环节，AI 对"PR URL + merge SHA + main CI 4 jobs 状态"数据格式过度坚持。用户已用最简方式（看 CI 状态指示符）兑现 H9 硬底实质（main 真正绿）后，AI 仍重复要求标准数据格式。这是协作 prompt 设计的微调点——纪律核心是"实质兑现"被验证而非"数据格式齐全"。Step 5 起草指令的"main CI 转绿验证"硬底（H9）已显式接受最简实质回执（譬如"全绿"）；此微调沉淀进 Step 5 + 后续 Step 起草指令。

**v2 修订工程纪律小总结**（用户 K.1 + K.2 沉淀）：

K.1 + K.2 是元规则 P + "克制 > 堆砌"原则的两次延伸应用：

- **K.1**：第三方 actions 不是"业界标准就引"，而是"无官方等价物才引"
- **K.2**：硬底不是"扩展性指标"，而是"克制原则的具体边界"

这两条纪律延伸本身是 Step 5 的工程价值——发布自动化主题揭露的纪律边界，比 release.yml 本身更长期影响 Tianqi 工程旅程。

**Phase 11+ 承接事项**：

- **docker push 到 ghcr.io**：Phase 11 起草指令必含 docker push 决策（v2 修订强化；K.3 不阻塞观察沉淀）
- changesets 引入（如多包版本管理需求出现）
- semver 引入（如公共发布需求出现）—— **未来非数字 tag 评估**：如未来需引入 sprint-N-closed 等约定，需在 ADR 修订评估 release.yml 触发 glob 调整（v2 修订；K.4 不阻塞观察沉淀）
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

### H.4 第三方 action 严格度判断（v2 已落地）

**v2 状态**：softprops/action-gh-release@v2 风险已通过 v2 修订消除——改用 `gh release create` CLI（GitHub 官方 + ubuntu-latest runner 预装；元规则 P 严守）。

**沉淀**：ADR-0003 Step 5 段含"第三方 action 严格度判断"段（4 类型 + 判断顺序），Phase 11+ 沿用。

### H.5 CONTRIBUTING.md ≤ 100 行硬底（v2 已落地）

**v2 状态**：硬底 ≤ 100 严守不升级；裁决 9 改精简版（约 9 行；CONTRIBUTING 94 → ~103）。

**实测验证 fallback**：PHASE_IMPLEMENT 阶段实地核查后；如确实超 100 行，由 AI 进一步精简至 6-7 行（保留核心：触发条件 + workflow 行为 + draft 模式 + ADR 引用）。**默认走精简版；硬底 ≤ 100 严守**。

**沉淀**：用户 K.2 决议"硬底不是扩展性指标，而是克制原则的具体边界"——Phase 11+ 沿用此纪律。

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

## §K 核心未决判断（v1 → v2 决议状态）

### K.1 裁决 6 softprops vs gh CLI — **v2 已落地：gh CLI**

**v1 决议**：softprops/action-gh-release@v2（业界标准）
**v2 决议（用户 K.1）**：**`gh release create` CLI**（GitHub 官方 + runner 预装；元规则 P 在"有 GitHub 官方等价物"场景严守）

**v2 落地证据**：
- §D 裁决 6 改 gh CLI（含 v2 实施草案 yml）
- §D 裁决 10 注释明示元规则 P v2 严守
- §E release.yml 完整草案第 7 步改 gh release create CLI
- §G ADR Step 5 段追加"第三方 action 严格度判断"段（4 类型 + 判断顺序 + Phase 11+ 沿用）
- §H.4 标记 v2 已落地

### K.2 裁决 9 CONTRIBUTING 长度策略 — **v2 已落地：精简版 + 硬底 ≤ 100 严守**

**v1 决议**：完整版 12 行 + 硬底升级 ≤ 110
**v2 决议（用户 K.2）**：**精简版 9 行 + 硬底 ≤ 100 严守不升级**

**v2 落地证据**：
- §F 改精简版（约 9 行；CONTRIBUTING 94 → ~103）+ 实测验证 fallback（如超 100 进一步精简至 6-7 行）
- §D 裁决 9 改精简版 + 硬底 ≤ 100 严守标注
- §G ADR Step 5 段裁决 9 改 α 精简版 + v2 修订标注
- §H.5 标记 v2 已落地 + 实测验证 fallback

### K.3 裁决 3 docker push（v1 接受 + v2 强化建议）— **不阻塞观察落地**

**v1 + v2 决议**：A 不 push（推迟 Phase 11+）

**v2 落地不阻塞观察**：ADR Step 5 段 Phase 11+ 承接事项含"**Phase 11 起草指令必含 docker push 决策**"（v2 修订强化；K.3 不阻塞观察沉淀）

### K.4 裁决 1 触发 glob `phase-*-closed`（v1 接受 + v2 留痕）— **不阻塞观察落地**

**v1 + v2 决议**：`phase-*-closed` 精确

**v2 落地不阻塞观察**：ADR Step 5 段 Phase 11+ 承接事项含"**未来非数字 tag 评估**：如未来需引入 sprint-N-closed 等约定，需在 ADR 修订评估 release.yml 触发 glob 调整"（v2 修订；K.4 不阻塞观察沉淀）

### K.5 main CI 转绿验证回执方式（v1 接受 + v2 已留痕）— **不阻塞观察落地**

**v1 + v2 决议**：最简实质回执（譬如"全绿"）+ ADR Step 5 段留痕

**v2 落地证据**：§G ADR Step 5 段含"Step 4 收尾微调留痕"段 + "v2 修订工程纪律小总结"段（K.1 + K.2 沉淀作为元规则 P + 克制原则的延伸）

---

## §K v2 核心审视点（请重点审视）

### v2.1 gh CLI 实施细节正确性

```yaml
- name: Create GitHub Release (draft)
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    gh release create "$GITHUB_REF_NAME" \
      --draft \
      --title "$GITHUB_REF_NAME" \
      --notes-file release-notes.md
```

**审视点**：
- `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` 是否正确（隐式 GITHUB_TOKEN）？
- `--draft` flag 是否正确创建 draft release？
- `--notes-file` 是否正确从 release-notes.md 读取？
- 是否需要追加 `--prerelease` flag（譬如 phase-X-closed 视为 prerelease？）

**AI 建议**：保留当前草案。`--prerelease` 不需要——phase-N-closed 是正式里程碑，不是 prerelease；Phase 11+ 如有 alpha/beta tag 约定再评估。

### v2.2 CONTRIBUTING 精简版 9 行长度估算准确性

精简版草案约 9 行；CONTRIBUTING 94 → 约 103 行（仍超 100 硬底约 3 行）。

**审视点**：
- 是否接受 PHASE_IMPLEMENT 阶段实测后再精简至 6-7 行 fallback 路径？
- 还是 v2 修订 §F 草案直接精简至 6-7 行（保证 ≤ 100）？

**AI 建议**：保留 PHASE_IMPLEMENT 实测 fallback 路径。理由：精简版 9 行已达"克制 + 清晰"边界；进一步精简到 6-7 行可能丢失 `1.0.0` tag 不属 Phase release stream 等关键说明；PHASE_IMPLEMENT 阶段实地核查后裁决最合理。

### v2.3 ADR Step 5 段长度膨胀（约 50 → 60 行）

v2 修订让 ADR Step 5 段从约 50 行膨胀到约 60 行（追加"第三方 action 严格度判断"段 + "v2 修订工程纪律小总结"段 + Phase 11+ 强化项）。

**审视点**：
- 是否接受 ADR Step 5 段约 60 行（仍 ≤ 65 行合理范围）？
- 还是需要进一步精简？

**AI 建议**：保留约 60 行。理由：v2 修订追加内容是工程纪律延伸沉淀（"第三方 action 严格度判断"段是 K.1 决议的核心 + Phase 11+ 沿用基础）；这些是 Step 5 工程价值（用户工程纪律小总结明示）；不应为追求"≤ 50 行"而牺牲沉淀完整性。

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
