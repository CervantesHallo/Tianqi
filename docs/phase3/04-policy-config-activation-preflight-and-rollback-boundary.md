# Phase 3 / Step 4：配置版本激活链路启动 —— PolicyConfigVersion 激活/切换/回滚最小边界 + 发布前守卫（Preflight）落地

## 为什么 Step 4 先做配置版本激活链路

Step 1-3 建立了策略契约、bundle 解析、真实策略实现和 dry-run。但配置版本仍是静态快照——没有生命周期、没有激活语义、没有切换/回滚能力。

Phase 3 的四个原始目标之一是"配置版本化"。版本化不仅是"配置带版本号"，还需要：可激活、可预校验、可切换、可回滚。Step 4 把这些能力首次闭环。

## 配置版本生命周期模型

```
draft → [preflight passes] → active
draft → [preflight fails] → rejected
active → [new version activated] → rolled_back
active → [explicit rollback] → rolled_back
rolled_back → [re-activate] → active (after preflight)
```

| 状态 | 说明 |
|------|------|
| draft | 已创建但未激活 |
| validated | 已通过 preflight 但未激活（预留） |
| active | 当前激活版本 |
| rolled_back | 已被替换或回滚 |
| rejected | preflight 失败，不可激活 |

`PolicyConfigVersionRecord` 包含：configVersion、status、config、createdAt、activatedAt、rolledBackAt、previousVersion、summary。

## Preflight 汇总了什么

`runPolicyConfigActivationPreflight(config, policyRegistry)` 顺序执行：

1. `prevalidatePolicyConfiguration` — 配置结构完整性 + descriptor 校验 + 策略可解析
2. `resolvePolicyBundle` — 三类策略实例解析
3. `dryRunPolicyBundle` — 三类策略可调用 + 契约合法性

输出 `PolicyConfigPreflightResult`：

| 字段 | 说明 |
|------|------|
| passed | 整体是否通过 |
| validationPassed | 配置校验是否通过 |
| bundleResolved | bundle 是否成功解析 |
| dryRunPassed | dry-run 是否通过 |
| warnings | 警告列表 |
| errors | 结构化错误列表 |
| summary | 人可读摘要 |

任一阶段失败即短路，后续阶段标记为 false。

## 激活和回滚边界

### 激活（activatePolicyConfigVersion）

接收 `ActivatePolicyConfigVersionCommand`（targetConfigVersion、activatedBy、activatedAt、allowOverrideActive）。

流程：
1. 查版本记录是否存在 → 否则 rejected
2. 是否已是 active → 返回 already_active
3. 若已有 active 且 allowOverrideActive=false → rejected
4. 检查生命周期状态（仅 draft/validated/rolled_back 可激活）
5. 执行 preflight → 失败则标记 rejected
6. 成功则更新状态为 active，旧版本标记 rolled_back

返回 `PolicyConfigActivationResult`（含 previous/current version、preflight summary、bundle summary、rollback availability）。

### 回滚（rollbackToPreviousPolicyConfigVersion）

接收 `RollbackPolicyConfigVersionCommand`（rolledBackBy、rolledBackAt）。

流程：
1. 获取当前 active 版本 → 无则 rejected
2. 获取 previousVersion → 无则 rejected
3. 对 previous 版本执行 preflight → 失败则 rejected
4. 成功则当前版本标记 rolled_back，previous 版本恢复为 active

## 当前 active version 如何管理

`PolicyConfigActivationRegistry`（内存级实现）：
- `addVersion(record)` — 注册版本记录
- `getVersion(configVersion)` — 按版本号查询
- `updateVersion(record)` — 更新版本记录
- `getActiveVersion()` — 获取当前激活版本
- `setActiveVersion(configVersion)` — 设置激活指针
- `listVersions()` — 列出所有版本

当前不允许 active version 散落在代码常量中。所有激活/切换操作必须通过 registry。

## 本步没做什么

- 没有外部配置中心
- 没有热更新平台
- 没有多环境发布
- 没有 UI / API / console
- 没有 orchestrator / 执行层
- 没有 DB / MQ / RPC
- 没有 Phase 7 完整发布系统

## 下一步建议

Phase 3 / Step 5 可选方向：
- 配置版本审计日志（激活/回滚操作留痕）
- 更多策略变体支持
- 策略配置序列化/反序列化
- Phase 3 封板收口准备
