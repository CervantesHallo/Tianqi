# @tianqi/adapter-testkit

## 它是什么

`@tianqi/adapter-testkit` 是 Tianqi 适配器层（`packages/adapters/*`）共享的契约测试工具包。它存在的唯一目的，是让任何一个具体 Adapter（无论实现 EventStore、Notification、Config 还是 External Engine 端口）都通过一套同源的、由 Port 与 Contract 直接派生的契约测试套件来证明自己实现正确。

它依赖 `@tianqi/ports` 与 `@tianqi/contracts` 两个工作区包，且仅依赖这两个。这种依赖边界明确表达：契约测试只针对 Port 接口语义与契约 schema，不触碰 `@tianqi/domain`、`@tianqi/application`、`@tianqi/policy`、`@tianqi/shared` 中的任何业务语义。

## 它不是什么

- 它不是单元测试工具：不提供断言函数、不替代 `vitest` 本身。
- 它不是 mock 库：不生成 stub、不伪造端口实现、不维护内存替身。
- 它不是 stub 生成器：不输出脚手架代码、不接管 Adapter 自身的实现职责。
- 它不是基础设施容器：不启动数据库、不启动消息队列、不管理外部进程。

## 后续 Adapter 如何使用它

后续每一个具体 Adapter 包，都会在自己的开发依赖中以 `workspace:*` 的方式引入 `@tianqi/adapter-testkit`，并在自己的测试中直接调用本包导出的契约测试套件，传入被测 Adapter 实例与该 Adapter 所需的最小运行环境。Adapter 自身只负责"实现端口"，证明"实现正确"的语义责任由本包统一承担。这样，任何一个 Adapter 都不需要自己重写契约测试，整个适配器层在任意时点的契约一致性可以被一组共享套件统一保护。

本包当前为骨架状态，尚未对外导出任何契约测试 API。具体导出形态在 Phase 8 后续步骤中按需逐项落地，并在每次新增时同步更新本说明。
