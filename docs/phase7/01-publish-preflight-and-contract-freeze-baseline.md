# Phase 7 / Step 1 — 生产门禁骨架启动：配置发布预检 + 契约冻结基线 + 发布阻断规则

## Phase 7 原始目标

Phase 7 严格只有四项：
1. 配置发布守卫
2. 契约冻结
3. 回滚方案
4. Runbook 与应急手册

## 为什么 Step 1 先做 Publish Preflight + Contract Freeze Baseline

Phase 3 已有配置版本化能力，但缺少"发布前守卫"总入口。Phase 1-6 已有 contracts/events/errors，但缺少"冻结基线"视图。Step 1 建立发布预检 + 契约冻结的正式骨架，为后续回滚方案和 runbook 提供基座。

## 当前 Preflight 覆盖的发布阻断类别

### A. 配置发布阻断（5 项）
- 配置版本不存在
- 配置预校验未通过
- 配置 dry-run 未通过
- 配置审计链不完整
- 配置 read view 不一致

### B. 契约冻结阻断（3 项）
- API contract 版本集合变更
- Event contract 版本集合变更
- Error code 版本集合变更

### C. 审计/回放阻断（2 项）
- Replay 语义未通过
- Event store 不可访问

## Contract Freeze Baseline 当前粒度

`ContractFreezeBaseline` 冻结三类版本集合标识：
- `apiContractVersionSet`
- `eventContractVersionSet`
- `errorCodeVersionSet`

当前只做版本标识级别对比，不做完整 schema diff。

## 本步不做

- 不做真实配置中心 / CI/CD 接入
- 不做最终回滚执行器
- 不做完整 runbook / 手册系统
- 不做 acceptance gate / final close

## 下一步建议

- Step 2：回滚方案骨架 + Runbook 占位 + Phase 7 差异矩阵 + 收口
