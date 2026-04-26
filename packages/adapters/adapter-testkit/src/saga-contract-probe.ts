// Phase 9 / Step 2 — SagaContractProbe 类型（Saga 契约套件的只读观察面）。
//
// §M（probe 模式）一致：
//   - 所有方法是纯读，无副作用
//   - 携带品牌字段 __sagaContractProbe: true 防止生产代码误用为运行 Port
//   - 仅适配器测试套 (defineSagaContractTests) 与其参考实现产出此接口
//
// 设计原则（与 EventStoreContractProbe / NotificationContractProbe 一致）：
//   - 文件极小（单一职责：只承载观察接口）
//   - 增加新方法须在 ADR-0002 留痕（元规则 B：本接口一旦发布即被 Step 3+ 消费）
//
// 为何引入 probe 而非仅用 SagaResult.stepStatuses？
//   SagaResult 只承载 Step 的"最终态"（status / failureReason），不承载：
//     - execute 顺序（用于断言"补偿是逆序的"，必须知正向顺序）
//     - 同一 Step 的 compensate 调用次数（用于幂等断言）
//     - compensate 实际收到的 compensationContext（用于 §4.4 上下文承载断言）
//   这些是契约语义验证的"必要观察量"，不能从 SagaResult 反推。

export type SagaContractProbe = {
  readonly __sagaContractProbe: true;
  /**
   * 已 invoke execute 的 Step 名（按 invoke 顺序）。
   *
   * 长度等于"已开始执行"的 Step 数（无论后续成功/失败）。第一个失败的 Step
   * 会出现在序列末尾。
   */
  getExecuteSequence(): ReadonlyArray<string>;
  /**
   * 首次 invoke compensate 的 Step 名（按 invoke 顺序）。
   *
   * 用于验证《§4.6》"逆序补偿"——assert 此序列与 execute 序列前缀互为逆。
   * 同一 Step 多次调用 compensate 只在序列中出现一次（首次入序）；多次调用
   * 计数由 getCompensationCallCount 提供。
   */
  getCompensationSequence(): ReadonlyArray<string>;
  /**
   * 同一 Step 的 compensate 被调用次数。
   *
   * 用于验证《§4.2》补偿幂等性——assert 多次 invoke 后状态仍稳定。
   * 未被 compensate 的 Step 返回 0。
   */
  getCompensationCallCount(stepName: string): number;
  /**
   * 该 Step 的 compensate 实际收到的 compensationContext。
   *
   * 用于验证《§4.4》补偿信息承载——assert compensate 收到的与 execute 返回
   * 的 compensationContext 严格相等（深度）。
   * 未被 compensate 的 Step 返回 undefined。
   */
  getCompensateContextPayload(stepName: string): unknown;
};
