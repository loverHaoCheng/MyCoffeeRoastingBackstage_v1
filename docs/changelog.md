# 变更记录

## 2026-06-28

- 新增 `设置` 模块，可录入并本地保存生豆库和熟豆库的 Supabase `Project URL` / `Publishable Key`
- 新增生豆未来数据结构规划类型，覆盖主数据、采购批次、销售规格、烘焙方案和烘焙记录
- 新增 Supabase 迁移脚本 `supabase/migrations/20260628_create_green_bean_core.sql`
- 补充设置模块与双 Supabase 连接架构说明
- 新增生豆 `localStorage` 本地缓存与请求失败缓存回退能力，并在设置页底部展示当前数据同步状态

## 2026-06-29

- 重构 `成本` 模块，支持从生豆库选择生豆并按脱水率、单锅重量、包装费、能耗费、人工费、其他费用实时计算单锅与单份售价
- 新增成本核算 Supabase 持久化服务与历史列表，优先写入熟豆库，未配置时可降级写入生豆库
- 新增迁移脚本 `supabase/migrations/20260629_update_green_beans_and_create_cost_calculations.sql`
- 放宽生豆主档初始必填约束，允许产地、产季、处理厂、含水率、海拔、密度等字段后续补录
- 生豆编辑抽屉改为复用统一表单，支持更完整地编辑主档、采购批次与默认销售规格
