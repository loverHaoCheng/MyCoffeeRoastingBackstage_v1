# 数据模型

首版预留核心领域实体：

- `Bean`: 生豆批次和基础库存属性。
- `RoastPlan`: 烘焙计划，包含生豆、批次重量、烘焙目标和节点表。
- `RoastPlanStep`: 烘焙节点，包含时间、事件、操作、炉温、火力和备注。
- `RoastBatch`: 烘焙批次执行记录。
- `RoastCurveRecord`: 烘焙曲线记录，一个烘焙批次只保留一条当前有效曲线，首版支持 HiBean JSON 导入覆盖。
- `InventoryItem`: 库存条目。
- `ProductionBatch`: 生产批次。
- `CostRecord`: 成本记录。
- `FinanceExpenseRecord`: 经营费用台账记录，覆盖房租、水电、工资、营销、物流、折旧等支出。
- `AiUsageLimit`: 用户级 AI 功能月度额度配置。
- `AiUsageLog`: AI 功能成功/失败调用日志，成功记录参与月度额度统计。

所有持久化实体统一包含 `id`、`createdAt`、`updatedAt`。

生产批次通过 `roastPlanId` 关联烘焙计划，现场执行时可按计划节点确认操作。

烘焙曲线采用主记录和曲线记录拆分：

- `roast_batches`：保存烘焙日期、生豆、入豆量、出豆量、烘焙程度、发展比、一爆时间、总烘焙时间、本次销售最终定价等摘要字段。
- `roast_curve_records`：保存标准化曲线点、事件、阶段、设备快照、生豆快照和导入指标。
- `roast_curve_records.roast_batch_id` 与 `roast_batches.id` 一对一；重新导入时覆盖当前曲线，不创建历史版本。
- AI 优化上下文应使用“烘焙计划 + 烘焙记录摘要 + 标准化曲线 + 人工备注”，不要直接依赖 HiBean 原始字段名。

财务模块当前采用分层口径：

- `直接成本`：来自 `cost_calculations` 的单锅总成本汇总。
- `经营费用`：手工录入的房租、水电、工资、营销、物流、折旧等费用。
- `已实现收入`：来自烘焙历史中去向为“销售”的烘焙记录，每条销售记录按 `1 份 × 本次最终定价` 计入；旧记录没有本次定价时回退生豆默认单份售价。
- `当前库存预估收入`：按剩余生豆、默认售价和最近一次核算脱水率估算的潜在收入。

AI 图片识别当前采用服务端辅助口径：

- `ai_usage_limits`：由 PocketBase Dashboard 维护用户额度，`feature = bean_image_recognition` 表示生豆图片识别。
- `ai_usage_logs`：由 BFF 写入调用结果，按 `owner + feature + month + status = success` 统计当月已用次数。
- 失败记录只用于排查，不参与月度额度扣减。

## 生豆未来拆表

为了支持更准确的成本、库存和烘焙追踪，生豆数据后续拆为以下模型：

- `green_beans`: 生豆主档案
- `green_bean_purchase_batches`: 采购批次与剩余库存
- `bean_sale_specs`: 销售规格
- `roast_profiles`: 烘焙方案
- `roast_records`: 烘焙记录
- `green_bean_inventory_overview`: 前端读取用汇总视图

详细字段说明见 `docs/data-models/green-bean-pocketbase.md`。
