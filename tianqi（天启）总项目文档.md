Tianqi（天启）项目架构与代码规范总文档

0. 文档定位

本文档是 Tianqi（天启） 项目的唯一顶层工程约束文档，用于约束后续所有由编程 AI 生成、修改、重构、补全、审查的代码、配置、测试、脚本与技术设计。

本文档目标只有一个：确保任何接手 Tianqi 的编程 AI 或工程师，在不依赖口头补充、不依赖隐式理解、不依赖“常识猜测”的前提下，也能稳定产出高质量、可维护、可审计、可扩展、不会降智的工程结果。

本文档不是建议，不是参考，不是灵感来源，而是 强约束规范。

⸻

1. 项目定义

1.1 项目名称

Tianqi（天启）

1.2 项目使命

Tianqi 的目标不是简单复制传统交易所中的 ADL / Clawback 型尾部兜底机制，而是：

在保留“极端风险可被系统吸收与有序处置”这一愿景的前提下，重构为一个工程结构清晰、接口语义稳定、状态转换可审计、策略配置可演化、性能与正确性可共同保障的风险处置系统。

1.3 核心理念

Tianqi 必须从“脏的灾难状态机”重构为“清晰的分层风险处置平台”。

其核心思想：
	1.	风险前置：尽量在限仓、保证金、风险限额、集中度惩罚阶段消化问题。
	2.	处置分层：把风险处置分成独立、边界清晰的阶段，而不是写成一个巨型 if/else 引擎。
	3.	强审计：每一个决策必须可回放、可解释、可追溯。
	4.	接口稳定：外部只看到稳定语义，不暴露内部混乱实现。
	5.	策略可插拔：排序、减仓、接管、资金池分摊、通知策略必须通过明确接口插拔。
	6.	正确性优先于投机式性能：但在正确性被保障后，必须追求低延迟、高吞吐、低抖动。
	7.	绝不魔法编码：严禁隐式规则、暗含状态、看不见的副作用、无注释常量、猜谜式命名。

⸻

2. 系统边界

2.1 Tianqi 负责什么

Tianqi 负责以下能力：
	1.	风险事件感知
	2.	风险事件归类
	3.	风险处置阶段推进
	4.	保证金不足 / 穿仓风险识别
	5.	保险资金池消耗与核算
	6.	自动减仓（ADL）候选筛选与排序
	7.	减仓执行编排
	8.	极端尾部场景下的损失吸收流程推进
	9.	风险处置事件审计与回放
	10.	风险处置结果对外广播与查询

2.2 Tianqi 不负责什么

除非明确扩展，否则 Tianqi 不直接负责：
	1.	撮合引擎内部成交逻辑
	2.	行情撮合价格计算本体
	3.	用户下单前台交互页面
	4.	普通订单路由
	5.	通用账户系统全部逻辑
	6.	非风险事件通知系统本体

2.3 Tianqi 与外部系统的关系

Tianqi 是一个 风险处置编排核心，依赖但不吞并以下外部系统：
	•	Margin Engine（保证金引擎）
	•	Position Engine（仓位引擎）
	•	Mark Price Engine（标记价格引擎）
	•	Matching Engine（撮合引擎）
	•	Insurance Fund Ledger（保险基金账本）
	•	Account System（账户系统）
	•	Notification Bus（通知总线）
	•	Audit Log / Event Store（审计事件存储）
	•	Config Center（配置中心）

Tianqi 必须通过 明确契约接口 与这些系统协作，严禁在业务代码中直接写死对方内部实现细节。

⸻

3. 顶层架构原则

3.1 架构原则

P1. 单一职责原则必须落地到模块级

任何模块只负责一类问题。不能把“识别 + 排序 + 执行 + 审计 + 广播”写在同一个文件或类中。

P2. 状态机显式化

所有风险处置流程必须是 显式状态机。禁止通过多个布尔变量拼凑隐藏状态。

P3. 事件优先

内部跨模块通信优先使用领域事件，不允许随意共享可变对象。

P4. 决策与执行分离

“应该怎么做”与“实际怎么做”必须分层。策略决策不能直接调用底层执行器写库或发消息。

P5. 纯核心 + 薄适配器

核心领域层尽可能纯净：
	•	不直接依赖数据库
	•	不直接依赖消息队列
	•	不直接依赖网络框架
	•	不直接依赖第三方 SDK

基础设施通过适配器注入。

P6. 可回放性不是附加功能，而是基础约束

任何会改变风险处置结果的输入都必须可记录，任何状态推进都必须可重放。

P7. 配置可版本化

所有规则、阈值、策略切换都必须可版本化、可审计、可回滚。

P8. 接口语义稳定优先于“短期省事”

对外 DTO、事件、错误码一旦发布，不得随意破坏兼容性。

⸻

4. 推荐架构风格

采用：

DDD（领域驱动设计） + Hexagonal Architecture（六边形架构） + Event Sourcing Lite（轻量事件溯源） + Explicit State Machine（显式状态机）

这里不是为了追求术语，而是为了把 Tianqi 这种高耦合高风险问题拆干净。

4.1 分层模型

建议分为以下 6 层：
	1.	Interface Layer（接口层）
	2.	Application Layer（应用编排层）
	3.	Domain Layer（领域层）
	4.	Policy Layer（策略层）
	5.	Infrastructure Layer（基础设施层）
	6.	Observability & Audit Layer（观测与审计层）

⸻

5. 模块划分

5.1 推荐仓库结构

/tianqi
  /docs
    00-overview.md
    01-architecture.md
    02-domain-model.md
    03-state-machine.md
    04-api-contracts.md
    05-event-contracts.md
    06-config-spec.md
    07-test-strategy.md
    08-runbook.md
    09-failure-scenarios.md
  /apps
    /tianqi-api
    /tianqi-worker
    /tianqi-replayer
    /tianqi-admin
  /crates or /packages
    /domain
      /risk_event
      /adl_case
      /liquidation_case
      /insurance_fund
      /deleveraging_policy
      /state_machine
      /audit_model
    /application
      /commands
      /queries
      /orchestrators
      /sagas
    /policy
      /ranking
      /fund_waterfall
      /position_selection
      /throttle
      /fallback
    /ports
      /market_data_port
      /position_port
      /margin_port
      /fund_port
      /match_port
      /event_store_port
      /notification_port
      /config_port
    /infrastructure
      /db
      /mq
      /redis
      /http_clients
      /kafka
      /metrics
      /logging
    /contracts
      /api
      /events
      /errors
      /dto
    /shared
      /types
      /time
      /id
      /result
      /enum
      /errors
      /utils
  /tests
    /unit
    /integration
    /contract
    /e2e
    /replay
    /chaos
  /scripts
  /tools
  /configs

5.2 模块职责

domain

只放核心业务对象与规则，不放数据库与网络细节。

application

负责用例编排：接收命令、加载聚合、调用策略、提交事件、触发后续动作。

policy

放可替换策略实现，例如：
	•	ADL 排序策略
	•	资金池瀑布策略
	•	候选账户筛选策略
	•	降级策略

ports

定义对外部系统的抽象接口。

infrastructure

实现 ports，连接数据库、缓存、消息系统、RPC、HTTP。

contracts

统一 API、事件、DTO、错误码契约。

shared

只放真正公共且稳定的基础类型。禁止把业务逻辑偷偷塞进 shared。

⸻

6. 领域模型设计

6.1 核心实体 / 聚合建议

6.1.1 RiskCase

表示一次完整风险处置案件。

字段至少包括：
	•	case_id
	•	case_type
	•	market_id
	•	symbol
	•	trigger_source
	•	trigger_reason
	•	severity_level
	•	current_stage
	•	current_state
	•	config_version
	•	created_at
	•	updated_at
	•	closed_at

6.1.2 RiskEvent

表示触发案件的原始风险事件。

6.1.3 LiquidationCase

表示保证金不足后进入强平流程的处理单元。

6.1.4 ADLCase

表示进入自动减仓编排阶段的处理单元。

6.1.5 InsuranceFundAccount

表示保险资金池账本视图。

6.1.6 DeleveragingPlan

表示一次具体减仓执行计划。

6.1.7 AuditRecord

表示一个可追溯的决策与状态迁移记录。

6.2 值对象建议
	•	CaseId
	•	UserId
	•	PositionId
	•	MarketId
	•	Money
	•	Quantity
	•	Leverage
	•	RiskScore
	•	MarginRatio
	•	PriorityRank
	•	ConfigVersion
	•	EventId
	•	TraceId
	•	Timestamp

值对象必须：
	•	不可变
	•	强类型
	•	可序列化
	•	有明确单位

禁止直接在领域层用裸 float 表示资金、价格、数量而不加约束。

⸻

7. 状态机规范

7.1 必须使用显式状态枚举

示例：

Detected
  -> Validating
  -> Classified
  -> Liquidating
  -> FundAbsorbing
  -> EvaluatingADL
  -> PlanningADL
  -> ExecutingADL
  -> Settling
  -> Closed
  -> Failed
  -> ManualInterventionRequired

7.2 状态机约束
	1.	每个状态迁移必须定义：
	•	进入条件
	•	退出条件
	•	允许动作
	•	禁止动作
	•	失败处理
	2.	每个迁移必须带原因。
	3.	不允许静默跳状态。
	4.	不允许在没有审计记录的情况下修改状态。
	5.	状态机推进必须幂等。

7.3 状态迁移接口示例

不要写成：

case.status = "ADL"

必须写成类似：

transition_result = state_machine.transition(
    case=case,
    action=EvaluateAdlAction(...),
    context=TransitionContext(...),
)

让迁移逻辑集中、可审计、可测试。

⸻

8. 策略层规范

8.1 策略层存在的原因

Tianqi 的很多规则本质上不是“永恒真理”，而是“平台可调整策略”，例如：
	•	ADL 排序方式
	•	减仓候选选择方式
	•	保险基金使用顺序
	•	节流阈值
	•	极端情况下的降级策略

因此必须抽象为策略接口。

8.2 策略接口示例

interface DeleveragingRankingPolicy
interface FundWaterfallPolicy
interface CandidateSelectionPolicy
interface ManualEscalationPolicy
interface NotificationPolicy

8.3 策略实现要求
	1.	每个策略都必须有唯一策略名和版本号。
	2.	策略决策输入输出必须可序列化。
	3.	策略结果必须带 explanation 字段。
	4.	策略不得直接写库、发消息、调外部接口。
	5.	策略必须可被回放。

⸻

9. 接口设计规范

9.1 API 设计原则
	1.	所有对外 API 使用明确版本，例如 /api/v1/...
	2.	DTO 与领域对象分离
	3.	不直接暴露内部实体
	4.	错误码统一
	5.	字段命名统一
	6.	时间统一为 UTC ISO 8601 或 epoch_ms，项目内统一一种，不得混用
	7.	数值精度必须明示

9.2 API 分类

Command API

用于触发动作，例如：
	•	创建风险案件
	•	推进某阶段
	•	重放案件
	•	手动接管案件

Query API

用于查询：
	•	案件详情
	•	状态流转历史
	•	ADL 排序结果
	•	保险基金消耗情况

Admin API

用于：
	•	发布配置版本
	•	冻结策略
	•	手动切换降级模式

9.3 错误码规范

错误码必须结构化，例如：

TQ-DOM-001 领域校验失败
TQ-APP-001 应用命令冲突
TQ-POL-001 策略执行失败
TQ-INF-001 基础设施暂时不可用
TQ-CON-001 契约版本不兼容

严禁：
	•	返回模糊字符串报错
	•	用异常 message 充当对外错误协议
	•	同一错误多种表达方式

⸻

10. 事件契约规范

10.1 事件是一级公民

所有关键流程必须产出领域事件和审计事件。

10.2 事件字段规范

每个事件至少包括：
	•	event_id
	•	event_type
	•	event_version
	•	trace_id
	•	case_id
	•	occurred_at
	•	producer
	•	payload
	•	metadata

10.3 关键事件建议
	•	RiskCaseDetected
	•	RiskCaseValidated
	•	LiquidationStarted
	•	LiquidationPartiallyCompleted
	•	InsuranceFundDebited
	•	ADLEvaluationStarted
	•	ADLCandidatesRanked
	•	ADLExecutionPlanned
	•	ADLExecutionStarted
	•	ADLExecutionCompleted
	•	CaseSettled
	•	CaseFailed
	•	ManualInterventionRequested

10.4 事件约束
	1.	事件 schema 必须版本化
	2.	不允许无版本裸 JSON
	3.	事件字段删除必须走兼容流程
	4.	消费方不得依赖未声明字段

⸻

11. 配置系统规范

11.1 配置分类
	•	静态配置：服务端口、日志级别
	•	领域配置：阈值、规则开关、策略选择
	•	运行配置：限流、并发、降级开关

11.2 配置约束
	1.	所有关键配置必须带版本号
	2.	配置变更必须审计
	3.	配置必须支持预校验
	4.	配置必须支持 dry-run
	5.	配置不得散落在代码常量中

11.3 严禁项

严禁在业务代码中写：

if ratio < 0.035:
    ...

必须写成：

if ratio < config.margin.adl_entry_threshold:
    ...


⸻

12. 数据与存储规范

12.1 存储原则
	•	领域真相与查询模型分离
	•	审计日志不可篡改
	•	可回放输入必须持久化
	•	临时缓存不能成为唯一事实来源

12.2 建议存储划分
	•	OLTP DB：案件状态、执行记录
	•	Event Store：关键事件流
	•	Object Storage：重放快照、批量审计归档
	•	Cache：查询加速，不存唯一真相

12.3 幂等键

所有命令入口必须定义幂等键策略。

示例：
	•	request_id
	•	case_id + action_type + action_seq

幂等逻辑必须可测试，不允许“凭感觉防重”。

⸻

13. 并发与一致性规范

13.1 并发原则
	1.	同一 case_id 的状态推进必须串行化或使用乐观锁保证顺序一致。
	2.	跨 case 的并发必须明确资源隔离策略。
	3.	不允许通过全局大锁掩盖架构设计问题。

13.2 一致性原则
	•	核心状态使用强一致语义
	•	通知与报表可以最终一致
	•	审计记录不能丢
	•	执行动作必须有因果链

13.3 Saga / 补偿

涉及外部系统多步动作时，使用应用层 saga 管理，而不是在领域对象内部乱调远程服务。

⸻

14. 可观测性规范

14.1 日志

日志必须结构化。

每条关键日志必须带：
	•	trace_id
	•	case_id
	•	event_id（如有）
	•	module
	•	action
	•	result
	•	latency_ms

禁止：
	•	打印无上下文字符串
	•	关键失败无 trace_id
	•	用日志替代审计记录

14.2 Metrics

至少提供：
	•	风险案件创建速率
	•	状态迁移成功率
	•	ADL 评估耗时
	•	执行耗时分位数
	•	失败率
	•	重试率
	•	手动接管率
	•	配置版本分布

14.3 Tracing

每个案件必须支持全链路 trace。

⸻

15. 安全规范

15.1 基本原则
	•	最小权限
	•	审计留痕
	•	配置变更需要权限控制
	•	手动干预操作必须双重审计

15.2 敏感数据

对用户敏感信息采取脱敏输出。禁止在日志中打印明文敏感字段。

⸻

16. 编码规范（总则）

16.1 最高原则

代码必须让后续接手者“一眼看出系统边界、两眼看懂数据流、三眼能安全修改”。

16.2 命名规范

类 / 结构体 / 类型

使用清晰、完整、可检索的业务命名：
	•	AdlCandidate
	•	RiskCaseRepository
	•	FundWaterfallPolicy
	•	TransitionGuard

禁止：
	•	DataManager
	•	Helper
	•	UtilService
	•	Processor2
	•	TmpHandler

函数命名

函数名必须体现动作和对象：
	•	evaluate_adl_candidates
	•	build_deleveraging_plan
	•	persist_audit_record
	•	transition_case_state

禁止使用模糊命名：
	•	handle
	•	process
	•	doit
	•	run2

除非语义在上下文极度明确，否则不得使用泛化函数名。

16.3 文件长度限制

建议：
	•	单文件控制在 300~500 行以内
	•	超过 600 行必须拆分并说明原因
	•	单函数超过 80 行必须重构
	•	单函数超过 120 行默认视为设计失败，除非有明确注释解释

16.4 函数设计规范
	1.	单函数只做一件事
	2.	输入输出明确
	3.	副作用显式
	4.	不隐式读取全局配置
	5.	不隐式访问网络/数据库

16.5 参数规范

参数个数建议不超过 5 个。超过 5 个必须封装参数对象。

禁止位置参数谜语化。复杂函数必须使用命名参数或结构化参数对象。

⸻

17. 类型系统规范

17.1 强类型优先

严禁大量使用：
	•	dict[str, Any]
	•	Map<String, Object>
	•	interface{}
	•	裸 JSON 到处传

应优先使用：
	•	DTO
	•	Value Object
	•	Typed Enum
	•	Result Type

17.2 Null 处理

禁止随意返回 null / None 作为业务失败表达。必须使用明确的：
	•	Result
	•	Option
	•	Either
	•	DomainError

17.3 Enum 规范

状态、事件类型、错误类型、策略类型必须使用枚举，不允许魔法字符串。

⸻

18. 错误处理规范

18.1 分层错误

错误必须分层：
	•	DomainError
	•	ApplicationError
	•	PolicyError
	•	InfrastructureError
	•	ContractError

18.2 错误传播

禁止到处 try/except 然后吞异常。禁止返回 False 表示失败而不给原因。

必须保留：
	•	错误类别
	•	错误码
	•	错误上下文
	•	原因链

18.3 用户可见错误 vs 内部错误

外部返回安全、稳定的错误协议；内部保留完整错误上下文。

⸻

19. 注释与文档规范

19.1 注释原则

注释不是翻译代码，而是解释：
	•	为什么这样设计
	•	这里的边界条件是什么
	•	为什么不能更简单

19.2 必须写注释的地方
	1.	状态迁移守卫
	2.	排序策略核心公式
	3.	精度处理逻辑
	4.	幂等处理逻辑
	5.	补偿/回滚逻辑
	6.	非直觉性业务规则

19.3 禁止无效注释

禁止：

# increase i
i += 1


⸻

20. 测试规范

20.1 测试是门禁，不是装饰

任何关键模块没有测试不得合并。

20.2 测试分层

单元测试

覆盖：
	•	值对象
	•	领域规则
	•	状态机守卫
	•	策略排序

集成测试

覆盖：
	•	仓位接口适配器
	•	基金账本适配器
	•	事件发布链路
	•	配置读取

契约测试

覆盖：
	•	API schema
	•	Event schema
	•	Error code schema

回放测试

给定历史事件流，重建相同处理结果。

混沌 / 故障测试

模拟：
	•	外部依赖超时
	•	重复消息
	•	乱序消息
	•	部分写成功
	•	配置切换中断

20.3 测试命名规范

测试名必须说明：
	•	前置条件
	•	动作
	•	期望结果

例如：
	•	test_case_moves_to_planning_adl_when_insurance_fund_is_insufficient
	•	test_duplicate_execution_request_is_rejected_by_idempotency_guard

20.4 DoD（完成定义）

一个功能完成，至少满足：
	1.	代码通过 lint / format / type check
	2.	单元测试通过
	3.	新增契约测试通过
	4.	有必要的设计注释
	5.	更新相关文档
	6.	关键路径有 metrics / log / trace
	7.	失败场景被覆盖

⸻

21. 性能规范

21.1 性能原则

Tianqi 不是超高频撮合内核，但仍属于关键链路系统，必须具备低延迟、高稳定、可预期性能。

21.2 性能红线

禁止：
	•	在热路径反复序列化/反序列化大型对象
	•	在循环中频繁请求配置中心
	•	在状态迁移中进行阻塞式远程调用而无隔离
	•	无界重试
	•	无界队列

21.3 性能优化原则
	1.	先保证正确性
	2.	再用 profile 定位瓶颈
	3.	优化前后必须有基准测试对比
	4.	不允许“猜测式微优化”污染代码

⸻

22. AI 编程执行规范（关键）

本节直接约束编程 AI 的行为。

22.1 AI 严禁行为

编程 AI 严禁：
	1.	为了“省事”省略模块边界
	2.	为了“跑通”把多个职责硬塞进一个函数
	3.	使用含糊命名敷衍架构设计
	4.	用注释掩盖糟糕设计
	5.	为了减少文件数而牺牲分层清晰度
	6.	未经说明擅自引入重型依赖
	7.	用裸字典 / 裸 JSON 代替明确数据模型
	8.	把状态机写成分散在各处的 if/else
	9.	为了“兼容”保留脏接口而不做隔离层
	10.	没有测试就宣称完工
	11.	没有错误码就输出异常字符串
	12.	没有审计事件就推进关键状态
	13.	在不说明影响的情况下修改契约
	14.	遇到复杂处直接使用“TODO”逃避实现
	15.	用反射、动态魔法、隐式全局单例制造不可控复杂度

22.2 AI 必须遵守的输出格式

每次进行设计或编码时，编程 AI 必须输出以下结构：

A. 当前任务

说明本次要完成什么。

B. 影响范围

列出受影响的模块、契约、事件、配置、测试。

C. 设计决策

清晰说明为什么这样设计，不得只给代码。

D. 代码变更

逐文件说明新增 / 修改内容。

E. 风险点

指出可能破坏兼容性或容易出错的地方。

F. 测试计划

列出新增 / 修改哪些测试。

G. 验收结果

明确说明 lint、type check、unit test、contract test 是否通过。

22.3 AI 代码生成原则
	1.	先搭边界，再填实现
	2.	先定义契约，再写适配器
	3.	先定义状态机，再写编排器
	4.	先写类型，再写逻辑
	5.	先写测试，再完善边界条件
	6.	优先小步提交、每步闭环

⸻

23. 分阶段实施路线

Phase 1：骨架搭建
	•	建立仓库结构
	•	定义 contracts
	•	定义 core domain types
	•	定义 ports
	•	建立 state machine 基础框架

Phase 2：核心案件流
	•	RiskCase
	•	LiquidationCase
	•	ADLCase
	•	基本状态迁移
	•	基本审计记录
	•	案件联动一致性约束（主案件与专项案件最小联动规则）
	•	专项终态协同收敛（专项终态触发主案件最小收敛动作）
	•	多专项最小顺序与终态冲突裁决（同主案件下多信号最小可解释规则）
	•	多专项终态信号最小时间序与幂等重放边界（晚到/重复/重放稳定处理）
	•	协同裁决结果最小回读视图与跨命令一致性（同一业务事实稳定可读）
	•	协同裁决结果最小持久化边界与最小 replay validation 占位（读写一致性跨会话基础）
	•	协同结果最小 observation 与 read-view 最小 repair 边界（持久化失败可修补）
	•	repair 状态模型与读侧诊断聚合视图（失败后可确认/再尝试/可聚合诊断）
	•	诊断视图最小风险分级与人工处理建议（风险可判读、下一步动作可解释）
	•	判读规则最小可配置化边界与规则版本占位（规则演进可见、语义兼容可护栏）
	•	诊断结果版本兼容读取策略与历史结果最小对比占位（读侧升级可控、历史差异可见）
	•	诊断历史槽最小持久化占位与跨会话一致性校验（历史对比跨会话更稳定）
	•	persisted history slot 最小 replay validation 与冲突归因字段（读侧冲突来源可解释）
	•	replay notice/failure 最小运维处理建议与读侧告警占位（冲突后动作语义可见）
	•	hint/alert 最小抑制与去重占位（同 factKey 重复提醒可控、读侧信噪比增强）
	•	suppression state 最小持久化占位与跨会话连续性校验（repeatCount 跨会话可延续）
	•	suppression persisted state 最小版本兼容读取与异常 state 最小修复占位（continuity 护栏更可解释）
	•	suppression state repair 生命周期最小状态模型与 confirm/retry 边界（冲突后续动作可解释且可控）
	•	suppression repair lifecycle 最小持久化槽与跨会话回读校验（confirm/retry 生命周期连续性跨会话可见）
	•	lifecycle slot 与 repair command record 最小审计关联回读占位（跨会话追责链可闭环）
	•	核心案件诊断 aggregate view 端到端收敛（单次查询可解释风险、修复、追责、连续性）
	•	Step 22 起进入端到端聚合收口阶段，后续步骤以 Step 30 封板验收为倒排目标
	•	Step 23 起进入封板回归基线阶段：冻结关键路径 baseline、关键 failure 语义与跨命令/跨会话一致性门禁

Phase 3：策略可插拔
	•	RankingPolicy
	•	FundWaterfallPolicy
	•	CandidateSelectionPolicy
	•	配置版本化

Phase 4：执行编排
	•	应用层 orchestrator
	•	saga / 补偿
	•	幂等保护
	•	外部系统适配

Phase 5：审计与回放
	•	事件存储
	•	回放器
	•	案件重建
	•	一致性校验

Phase 6：观测与压测
	•	tracing
	•	metrics
	•	关键路径性能基准
	•	故障演练

Phase 7：生产门禁
	•	配置发布守卫
	•	契约冻结
	•	回滚方案
	•	Runbook 与应急手册

⸻

24. PR / 变更评审规范

24.1 PR 必须包含
	1.	背景
	2.	变更范围
	3.	设计理由
	4.	契约变化
	5.	测试结果
	6.	风险评估
	7.	回滚方案

24.2 拒绝合并条件

出现以下任一情况，直接拒绝：
	1.	模块职责混乱
	2.	契约未说明就变更
	3.	无测试
	4.	错误处理不完整
	5.	幂等性未说明
	6.	状态机绕过
	7.	使用魔法常量
	8.	新增技术债但未记录
	9.	文档未同步

⸻

25. 代码风格补充

25.1 统一风格
	•	统一 formatter
	•	统一 lint
	•	统一 import 排序
	•	统一目录命名
	•	统一 DTO 命名后缀
	•	统一错误码前缀

25.2 不可妥协的风格要求
	1.	不写超长表达式链
	2.	不在一行内塞多个业务条件
	3.	不嵌套三层以上复杂分支而不提取函数
	4.	不把配置 key 当字符串散落各处
	5.	不允许复制粘贴多个相似分支而不抽象

⸻

26. 最低交付物清单

每个核心功能最少交付以下内容：
	1.	设计说明
	2.	代码实现
	3.	单元测试
	4.	契约测试
	5.	日志 / metrics / trace 接入
	6.	文档更新
	7.	风险与回滚说明

⸻

27. 最终裁决原则

当出现以下冲突时，按此优先级裁决：
	1.	正确性
	2.	可审计性
	3.	状态机清晰性
	4.	契约稳定性
	5.	可维护性
	6.	性能
	7.	开发速度

任何试图用“先跑起来再说”破坏前 5 项的行为，均视为不合格。

⸻

28. 给编程 AI 的最终硬性指令

你正在为 Tianqi 项目工作。你不是在写 demo，不是在写竞赛题，不是在写临时脚本，而是在构建一个面向极端风险处置场景的核心系统。你的所有输出必须满足以下硬约束：
	1.	不得降智。
	2.	不得偷懒。
	3.	不得用模糊命名掩盖不清晰设计。
	4.	不得省略边界条件。
	5.	不得跳过测试。
	6.	不得牺牲契约稳定性。
	7.	不得把跨模块复杂度压成一个大文件。
	8.	不得把状态机藏在布尔变量和分散分支里。
	9.	不得把未来维护者当成读心术专家。
	10.	任何设计都必须让后续工程师能安全理解、定位、修改、回滚、审计。

如果你在某个点上无法确定，优先选择：
	•	更显式的类型
	•	更清晰的边界
	•	更稳定的契约
	•	更可验证的实现
	•	更容易回放与审计的方案

而不是选择“更短的代码”“更花哨的技巧”“更省几行”的写法。

Tianqi 的第一原则不是炫技，而是清晰、可控、可信。