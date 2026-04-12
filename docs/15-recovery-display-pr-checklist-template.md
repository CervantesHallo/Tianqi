# Recovery Display / DTO PR Checklist Template (Phase 1)

> 复制到 PR 描述并逐项勾选。

- [ ] 本次 adapter 变更分类：`internal_only` / `non_breaking_external` / `breaking_external`
- [ ] 我是否触及了共享核心字段集合（`RECOVERY_EXTERNAL_SHARED_CORE_FIELDS`）？
- [ ] 我是否更新了 adapter 相关测试（含 baseline 回归）？
- [ ] 我是否更新了 version rehearsal 模板测试？
- [ ] 我是否更新了 docs（display/adapter/versioning/fork policy）？
- [ ] 我的改动是否需要 bump `RecoveryDisplayView.viewVersion`？
- [ ] 我的改动是否影响了 console/api 轻量分叉策略（仅可选扩展，不改共享核心语义）？
- [ ] 我是否核对了 impact checklist（`createRecoveryDisplayChangeImpactChecklistTemplate()`）？
- [ ] 我是否填写了 baseline 更新原因模板（`RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE`）？

## 极简填写建议（减少歧义）

> 目标是“写清关键理由”，不是增加字数负担。

- classification 选择：给出 1 句证据（是否触及 external DTO、是否触及共享核心字段）。
- baseline 更新原因：按 `RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE` 填写，并引用本次分类。
- 若写“无需更新 baseline”：最少说明“未触及哪些 DTO/共享核心字段”以及“依据哪条分类规则”。
- 若写“无需 bump viewVersion”：最少说明“为何仍兼容（可选/默认/语义不变）”。
- 建议同时对照 `RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS`，把分类转换为可执行评审动作。
- 若本次改动涉及 baseline 回归，建议补充 `RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE`。
- 建议补充 `RECOVERY_REVIEW_TRACE_TEMPLATE` 作为最小审阅留痕（rule basis + checked items + risk note）。
