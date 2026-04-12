# Phase 4 / Step 1 — 执行编排骨架启动：Orchestrator 主链路 + Saga 骨架 + 幂等入口 + 外部系统适配消费边界

## Phase 4 原始目标

Phase 4 严格只有四项：
1. 应用层 orchestrator
2. saga / 补偿
3. 幂等保护
4. 外部系统适配

## 为什么 Step 1 先做 Orchestrator 主链路骨架

Phase 2 的案件流和 Phase 3 的策略 bundle 此前各自独立闭环。Phase 4 的首要任务是让应用层第一次真正成为"编排入口"——拿到一个案件命令，加载上下文，解析 active config，resolve bundle，执行策略组合，产出结构化结果。主链路骨架是后续 saga 补偿、幂等保护、外部适配的挂载基座。

## 为什么 Saga / 幂等 / Port Boundary 必须一起落地

总文档约束明确：
- **saga**："涉及外部系统多步动作时，使用应用层 saga 管理"（§13.3）
- **幂等**："所有命令入口必须定义幂等键策略"（§12.3）
- **ports**："必须通过明确契约接口与这些系统协作"（§2.3）

如果只做 orchestrator 而不带 saga/幂等/ports，编排入口将缺少错误恢复路径、重复请求防护和外部系统隔离。三者缺一不可。

## 最小主路径 O1

```
ExecuteRiskCaseOrchestrationCommand
  → idempotency check
  → load case (via port)
  → load active config (via port)
  → resolve & dry-run bundle (via port)
  → execute candidate selection (via port)
  → execute ranking (via port)
  → execute fund waterfall (via port)
  → finalize
  → RiskCaseOrchestrationResult
```

7 个 saga step，每步显式记录成功/失败。策略执行步骤失败时，如果有已完成的可补偿步骤，saga 自动标记 `compensation_required`。

## 本步不做

- 不做真实 DB / MQ / HTTP / Kafka 接入
- 不做完整 worker 运行时
- 不做 UI / API / console
- 不做复杂调度 / 批量并发
- 不做完整补偿引擎
- 不扩到 Phase 5 / 7

## 下一步建议

- Step 2：saga 补偿执行骨架 + 幂等结果重放 + 审计事件产出
- Step 3：更多编排路径（liquidation case 编排）
