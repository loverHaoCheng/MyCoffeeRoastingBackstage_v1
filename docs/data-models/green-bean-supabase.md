# 生豆 Supabase 数据模型

本方案将“生豆主数据”和“交易/执行数据”拆开，避免把采购、库存、售价、烘焙方案和烘焙记录全部塞进一张表里。

## 拆表原则

- `green_beans`：保存稳定的生豆档案信息，如产地、处理法、等级、豆种、产季、含水率、海拔、密度、处理厂。
- `green_bean_purchase_batches`：保存每次采购重量与采购总价，用于成本核算和剩余库存追踪。
- `bean_sale_specs`：保存单份重量和单份售价，后续可扩展不同包装规格。
- `roast_profiles`：保存烘焙方案，使用 `jsonb` 记录节点步骤。
- `roast_records`：保存实际烘焙记录，记录输入重量、输出重量和损耗比。
- `green_bean_inventory_overview`：给前端列表页和统计卡片读取的汇总视图。

## 字段映射

| 业务字段 | 推荐落表 | 说明 |
| --- | --- | --- |
| 购买重量 | `green_bean_purchase_batches.purchased_weight_grams` | 用克存储，便于精度统一 |
| 购买价格 | `green_bean_purchase_batches.purchased_total_price` | 总价，单价由数据库生成 |
| 单次烘焙量 | `green_beans.default_roast_input_grams` | 默认建议投豆量 |
| 出售单份重量 | `bean_sale_specs.unit_weight_grams` | 支持未来多规格 |
| 出售单份售价 | `bean_sale_specs.unit_price` | 支持未来多渠道定价 |
| 烘焙记录 | `roast_records` | 一次实际烘焙一条 |
| 烘焙方案 | `roast_profiles` | 与生豆一对多 |
| 产地 | `green_beans.origin_country` | 国家级来源 |
| 等级 | `green_beans.grade` | 供应商等级、杯测等级或贸易分级 |
| 豆种 | `green_beans.variety` | 当前按文本存储，后续可拆字典表 |
| 产季 | `green_beans.harvest_season` | 如 `2025/2026` |
| 含水率 | `green_beans.moisture_percent` | 百分比 |
| 产区 | `green_beans.origin_region` / `origin_area` | 省州 / 更细分产区 |
| 处理法 | `green_beans.process_method` | 水洗、日晒、蜜处理等 |
| 海拔 | `green_beans.altitude_meters_min/max` | 用范围表达更稳妥 |
| 密度 | `green_beans.density_g_per_l` | 适合烘焙参考 |
| 处理厂 | `green_beans.mill_name` | 处理站 / 处理厂 |

## 为什么不直接一张表存完

- 采购价会随着批次变化，一张主表无法表达多次进货的加权成本。
- 烘焙方案和烘焙记录都属于一对多关系，直接塞主表会导致重复和更新困难。
- 单份售价未来往往会出现挂耳 / 250g / 500g 多规格，一张字段无法扩展。

## 前端推荐读取方式

- 生豆列表页：读取 `green_bean_inventory_overview`
- 生豆详情页：读取 `green_beans` + 采购批次 + 烘焙方案 + 烘焙记录
- 成本分析页：从采购批次、烘焙记录、销售规格继续做聚合

## SQL 位置

- `supabase/migrations/20260628_create_green_bean_core.sql`
- `supabase/migrations/20260629_update_green_beans_and_create_cost_calculations.sql`
- `supabase/migrations/20260706_add_green_bean_grade.sql`

## 2026-06-29 调整

- `green_beans.origin_country`、`origin_region`、`harvest_season` 允许为空，前端初始化时只强制要求名称、豆种、处理法、编号、购买量、购买价格、单次烘焙量、出售单份价格。
- 新增 `cost_calculations` 表，用于保存单锅成本核算因子与结果，字段覆盖：
  - 生豆选择
  - 生豆成本
  - 脱水率
  - 单锅生豆重量
  - 包装费用
  - 能耗费用
  - 人工费用
  - 其他费用
  - 单份熟豆重量
  - 单份熟豆售价
  - 目标利润率
  - 推算出豆量、单锅总成本、单份成本、建议售价、利润率
