# 数据模型

首版预留核心领域实体：

- `Bean`: 生豆批次和基础库存属性。
- `RoastPlan`: 烘焙计划，包含生豆、批次重量、烘焙目标和节点表。
- `RoastPlanStep`: 烘焙节点，包含时间、事件、操作、炉温、火力和备注。
- `RoastBatch`: 烘焙批次执行记录。
- `InventoryItem`: 库存条目。
- `ProductionBatch`: 生产批次。
- `CostRecord`: 成本记录。
- `FinanceExpenseRecord`: 经营费用台账记录，覆盖房租、水电、工资、营销、物流、折旧等支出。

所有持久化实体统一包含 `id`、`createdAt`、`updatedAt`。

生产批次通过 `roastPlanId` 关联烘焙计划，现场执行时可按计划节点确认操作。

财务模块当前采用分层口径：

- `直接成本`：来自 `cost_calculations` 的单锅总成本汇总。
- `经营费用`：手工录入的房租、水电、工资、营销、物流、折旧等费用。
- `已实现收入`：来自烘焙历史中去向为“销售”的烘焙记录，每条销售记录按 `1 份 × 默认单份售价` 计入。
- `当前库存预估收入`：按剩余生豆、默认售价和最近一次核算脱水率估算的潜在收入。

## 生豆未来拆表

为了支持更准确的成本、库存和烘焙追踪，生豆数据后续拆为以下模型：

- `green_beans`: 生豆主档案
- `green_bean_purchase_batches`: 采购批次与剩余库存
- `bean_sale_specs`: 销售规格
- `roast_profiles`: 烘焙方案
- `roast_records`: 烘焙记录
- `green_bean_inventory_overview`: 前端读取用汇总视图

详细字段说明见 `docs/data-models/green-bean-pocketbase.md`。
