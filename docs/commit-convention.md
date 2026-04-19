# Commit Message Convention

本文件固化 Tianqi 仓库当前实际在用的 commit 消息风格。规则一律以 `git log --no-merges` 可检索样本为证据，不凭空发明、不代未合入的假设未来背书。若仓库未来新增了本文件未覆盖的模式，应先修改样本、再更新本文件。

## 1. 规范基线

本仓库使用 [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) 作为 commit 消息结构。本文件不复述该规范全文，仅在规范范围内固化本仓库已经做出的显式选择。

## 2. Header

格式：

```
<type>[(<scope>)]: <subject>
```

- **type**：取自 Conventional Commits 规定的词表。本仓库允许使用 `feat` / `fix` / `chore` / `docs` / `refactor` / `test` / `build`。
- **scope**：可选，半角括号包裹，使用 kebab-case，指向受影响的顶层目录或逻辑分组（如 `adapters`、`infra`）。
- **subject**：祈使语气，句首小写，句尾不加标点。

证据（`git log --no-merges` 可复查）：

- `chore(adapters): scaffold adapter layer skeleton for Phase 8 (Step 1)` — 带 scope 的样本。
- `chore: exclude main project doc from version control` — 不带 scope 的样本。

仓库历史中已实际出现的 type 为 `chore`。新 type（`feat` / `fix` / `docs` / `refactor` / `test` / `build`）在首次使用时直接按本 Header 规则落地，无需额外审批。

## 3. Body

- Header 与 Body 之间以单个空行分隔。
- 行宽约 72 字符，允许多段落，允许使用 `- ` 开头的无序列表。
- Body 必须解释变更动机与影响范围；不得仅复述 Header。

证据：

- `chore(adapters): ...` 的 Body 同时使用自由段落与 `- ` 列表，分别阐述动机、受影响文件、非范围声明。
- 头两行为 `Initial commit` 与 GitHub 网页产生的 `Add files via upload` 等消息均无 Body；这些消息来自仓库搭建期，不作为本约定推荐的模板（参见第 6 节"历史分歧说明"）。

## 4. Trailer

- Body 与 Trailer 之间以单个空行分隔。
- 每条 Trailer 格式为 `Token: value`，Token 使用首字母大写、多词以连字符连接（符合 `git interpret-trailers` 默认解析规则）。
- AI / 工具协作标注统一放在 Trailer 段，不嵌入 Body。

证据：

- `chore(adapters): scaffold adapter layer skeleton for Phase 8 (Step 1)` 含 Trailer `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`。
- `chore: exclude main project doc from version control` 含 Trailer `Made-with: Cursor`。

## 5. 真实样本

可直接复制参考的完整 commit：

- [9e5ed46](https://github.com/CervantesHallo/Tianqi/commit/9e5ed46)：带 scope、段落 + 列表 Body、`Co-Authored-By:` Trailer。
- [3b4c96b](https://github.com/CervantesHallo/Tianqi/commit/3b4c96b)：不带 scope、极简 Body、`Made-with:` Trailer。

## 6. 历史分歧说明

仓库早期存在若干由 GitHub 网页界面产生的自动消息，例如：

- `Add files via upload`
- `Delete tianqi-logo.png`
- `Initialize README with project details and architecture`
- `Revise README with project highlights and status`

这些消息是当时环境的副产物，不作为本仓库 commit 消息样板。自 Phase 7 封板、Phase 8 启动起，所有手工创建的 commit 遵守本文件。

## 7. 例外与边界

- 本文件只约束 commit 消息本身，不约束 PR 标题、Release Note 或 changelog 生成工具的输入格式。
- 本文件不强制 commit 粒度（一件事一 commit / 多件事合并一 commit 由作者基于原子性判断），但在合并情况下 Body 必须分条说明每项职责。
- 本文件不涵盖 merge commit（当前仓库主线线性、无 merge commit 样本）。
