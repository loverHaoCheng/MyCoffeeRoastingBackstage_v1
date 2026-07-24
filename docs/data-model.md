# 数据模型

首版预留核心领域实体：

- `Bean`: 生豆批次和基础库存属性。
- `RoastPlan`: 烘焙计划，包含生豆、批次重量、烘焙目标和节点表。
- `RoastPlanStep`: 烘焙节点，包含时间、事件、操作、炉温、火力和备注。
- `RoastBatch`: 烘焙批次执行记录。
- `RoastCurveRecord`: 烘焙曲线记录，一个烘焙批次只保留一条当前有效曲线，支持 HiBean JSON 与 Artisan JSON 导入覆盖。
- `InventoryItem`: 库存条目。
- `ProductionBatch`: 生产批次。
- `CostRecord`: 成本记录。
- `FinanceExpenseRecord`: 经营费用台账记录，覆盖房租、水电、工资、营销、物流、折旧等支出。
- `AiUsageLimit`: 用户级 AI 功能月度额度配置。
- `AiUsageLog`: AI 功能成功/失败调用日志，成功记录参与月度额度统计。

所有持久化实体统一包含 `id`、`createdAt`、`updatedAt`。

生产批次通过 `roastPlanId` 关联烘焙计划，现场执行时可按计划节点确认操作。

烘焙曲线采用主记录和曲线记录拆分：

- `roast_batches`：保存烘焙日期、生豆、入豆量、出豆量、烘焙程度、发展比、一爆时间、总烘焙时间、本次销售最终定价、已售份数等摘要字段。
- `roast_curve_records`：保存标准化曲线点、事件、阶段、设备快照、生豆快照和导入指标。
- `roast_curve_records.roast_batch_id` 与 `roast_batches.id` 一对一；重新导入时覆盖当前曲线，不创建历史版本。
- AI 优化上下文应使用“烘焙计划 + 烘焙记录摘要 + 标准化曲线 + 人工备注”，不要直接依赖 HiBean 或 Artisan 原始字段名。

财务模块当前采用分层口径：

- `直接成本`：来自 `cost_calculations` 的单锅总成本汇总。
- `经营费用`：手工录入的房租、水电、工资、营销、物流、折旧等费用。
- `成本模板`：每条生豆必须关联一个模板。每锅预估熟豆重量为 `模板生豆重量 × (1 - 脱水率)`，计划份数为预估熟豆重量除以出售单份熟豆重量的整数部分。
- `当前库存预估收入 / 利润`：先用 `剩余生豆重量 ÷ 模板生豆重量` 取可烘焙锅数，再累计计划份数。收入为份数乘以“最终定价减包装、能耗、其他费用”；利润在收入基础上再扣除每份对应的生豆成本。
- `已实现收入 / 利润`：销售烘焙记录按已售份数计算，且不得超过该锅的计划份数。收入使用“最终定价减包装、能耗、其他费用”，已售出生豆成本为“已售份数 × 生豆成本(元/kg) × 模板生豆重量(kg)”，利润再扣除关联邮费；一笔邮费仅可关联已完成的销售记录，并可为同一记录关联不超过计划份数的多份。邮费按关联总份数平均分摊。

AI 功能额度当前采用服务端辅助口径：

- `ai_usage_limits`：由 PocketBase Dashboard 维护用户额度，`feature` 用于区分具体 AI 功能。
- `ai_usage_logs`：由 BFF 写入调用结果，按 `owner + feature + month + status = success` 统计当月已用次数。
- 失败记录只用于排查，不参与月度额度扣减。
- 未配置用户额度时默认 `10 次/月`；当前 `bean_image_recognition`、`roast_analysis`、`roast_training_recommendation`、`roast_plan_recommendation` 均独立计次。

## 生豆未来拆表

为了支持更准确的成本、库存和烘焙追踪，生豆数据后续拆为以下模型：

- `green_beans`: 生豆主档案
- `green_bean_purchase_batches`: 采购批次与剩余库存
- `bean_sale_specs`: 销售规格
- `roast_profiles`: 烘焙方案
- `roast_records`: 烘焙记录
- `green_bean_inventory_overview`: 前端读取用汇总视图

详细字段说明见 `docs/data-models/green-bean-pocketbase.md`。
