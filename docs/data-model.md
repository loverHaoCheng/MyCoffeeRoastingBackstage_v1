# 数据模型

首版预留核心领域实体：

- `Bean`: 生豆批次和基础库存属性。
- `RoastPlan`: 烘焙计划，包含生豆、批次重量、烘焙目标和节点表。
- `RoastPlanStep`: 烘焙节点，包含时间、事件、操作、炉温、火力和备注。
- `RoastBatch`: 烘焙批次执行记录。
- `InventoryItem`: 库存条目。
- `ProductionBatch`: 生产批次。
- `CostRecord`: 成本记录。

所有持久化实体统一包含 `id`、`createdAt`、`updatedAt`。

生产批次通过 `roastPlanId` 关联烘焙计划，现场执行时可按计划节点确认操作。
