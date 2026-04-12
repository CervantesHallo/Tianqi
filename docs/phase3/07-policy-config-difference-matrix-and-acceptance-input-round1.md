# Phase 3 / Step 7：策略配置主线差异矩阵 + 配置版本化验收输入物（第一轮）+ Phase 3 收口模式启动

## 为什么 Step 7 进入 Phase 3 收口模式

Step 1–6 建立了策略契约、bundle 解析、版本激活/回滚、审计链、diff、read view、基线冻结。这些能力仍然分散在独立模块中。Step 7 将它们统一为一个可批量回归、可验收总览的差异矩阵，为 Step 8–10 的门禁和最终收口提供结构化输入。

## 两组场景矩阵覆盖什么

### 策略可插拔场景（S1–S5）

| 场景 | 覆盖内容 |
|------|----------|
| S1 | stub bundle dry-run 成功 |
| S2 | real bundle dry-run 成功 |
| S3 | stub/real 共存，无冲突 |
| S4 | 非法 descriptor 导致 bundle 解析失败 |
| S5 | stub 配置通过完整 preflight 管线 |

### 配置版本化场景（C1–C6）

| 场景 | 覆盖内容 |
|------|----------|
| C1 | 首次激活成功 |
| C2 | 版本切换成功 |
| C3 | preflight 失败被拒绝 |
| C4 | 回滚成功 |
| C5 | already_active 稳定 |
| C6 | 激活产出 audit + diff + read view |

## 差异矩阵比较什么

每个场景的实际执行结果对照冻结基线的 9 个 load-bearing 核心字段：

`configVersion` / `activationStatus` / `preflightPassed` / `policySelectionSummary` / `dryRunPassed` / `auditAction` / `diffSummary` / `currentActiveVersion` / `rollbackAvailable`

字段漂移分为两级：
- **blocking**（7 字段）：configVersion / activationStatus / preflightPassed / dryRunPassed / currentActiveVersion / auditAction / rollbackAvailable
- **notice**（2 字段）：diffSummary / policySelectionSummary

矩阵 overallStatus：
- `passed`：全部匹配
- `passed_with_notice`：仅 notice 级漂移
- `failed`：存在 blocking 级漂移

## Acceptance Input Snapshot 用来做什么

`Phase3AcceptanceInputSnapshot` 是 Step 8–10 门禁的标准化输入物，包含：
- 基线核心字段集合
- 两组场景 ID 清单
- 差异矩阵 overallStatus
- blocking / notice 分类结果
- 推荐下一步动作

## 本步没做什么

- 没有新策略 v2
- 没有外部配置中心
- 没有 orchestrator / 执行编排
- 没有 UI / API / console
- 没有发布平台
- 没有 acceptance gate（Step 8）

## 下一步建议

Phase 3 / Step 8 可选方向：
- Phase 3 Acceptance Gate 定义 + 门禁清单固化
- Phase 3 最终封板准备
