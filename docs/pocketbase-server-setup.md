# PocketBase 服务器优先配置

这份说明用于服务器侧 PocketBase 集合、权限和部署结构初始化。

## 目标

- 让当前项目先在服务器 PocketBase 跑通注册、登录和用户隔离。
- 让每个业务 collection 都带 `owner`，确保“每个用户只能看自己的数据”。
- 让当前项目与服务器上的 PocketBase 保持同一套 collection 命名和权限规则。

## 运行前提

- 服务器上已经有可访问的 PocketBase 服务。
- 可通过 PocketBase Dashboard 或 API 管理集合与权限。
- 前端通过 `VITE_PB_URL=http://81.70.224.75` 连接服务器服务。
- BFF 通过服务端环境变量保存 `PB_SUPERUSER_EMAIL`、`PB_SUPERUSER_PASSWORD`、`QINIU_QWEN_API_KEY`、`QINIU_QWEN_BASE_URL`、`QINIU_QWEN_MODEL`，这些值不得写入前端 `VITE_` 环境变量。
- 本地 `npm run dev` 会读取 `.env.local` 中的 BFF 服务端变量，并仅注入 Node dev middleware 的 `process.env`，不得把私密变量命名为 `VITE_` 前缀。

本地 `.env.local` 示例：

```bash
PB_BASE_URL=http://81.70.224.75
PB_SUPERUSER_EMAIL=你的 PocketBase 管理员邮箱
PB_SUPERUSER_PASSWORD=你的 PocketBase 管理员密码
QINIU_QWEN_API_KEY=你的七牛云 API Key
QINIU_QWEN_BASE_URL=https://api.qnaigc.com/v1
QINIU_QWEN_MODEL=qwen/qwen3.6-27b
```

## 当前客户端兼容约定

- 前端已经会自动给业务写入补 `owner` 字段。
- 前端已经会自动补 `created_at` 和 `updated_at` 字段。
- 当前代码把 `roast_plan_overview` 视为 `roast_profiles` 的兼容别名。
- 当前代码把 `roast_batch_overview` 视为 `roast_batches` 的兼容别名。
- 若继续保留 `roast_batch_overview` 视图，请确保它至少暴露 `sales_mode` 字段；否则前端会自动回退到 `roast_batches` 读取真实去向数据。

## 认证集合

### `users`

- 类型：Auth collection
- 用途：注册、登录、当前用户身份
- 认证方式：Email + Password
- 建议：先用 Dashboard 创建第一个 admin，再允许前端注册普通用户

### 权限规则

```text
listRule: id = @request.auth.id
viewRule: id = @request.auth.id
createRule: true
updateRule: id = @request.auth.id
deleteRule: id = @request.auth.id
```

## 业务集合模板

所有业务集合都建议加一个 `owner` 字段：

- 字段类型：`relation`
- 关联集合：`users`
- 最大选择：`1`
- 必填：`yes`

通用规则模板：

```text
listRule: owner = @request.auth.id
viewRule: owner = @request.auth.id
createRule: @request.auth.id != "" && owner = @request.auth.id
updateRule: @request.auth.id != "" && owner = @request.auth.id
deleteRule: @request.auth.id != "" && owner = @request.auth.id
```

## Collection 清单

### `green_beans`

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `owner` | relation(users) | 归属用户 |
| `code` | text | 生豆编号 |
| `display_name` | text | 生豆名称 |
| `flavor_tags` | text | 风味标签，使用逗号分隔存储 |
| `aging_days` | number | 养豆时间，单位天，默认建议 14 |
| `process_method` | text | 处理法 |
| `tasting_end_days` | number | 赏味结束期，单位天，默认建议 40 |
| `variety` | text | 豆种 |
| `grade` | text | 等级 |
| `origin_country` | text | 国家 |
| `origin_region` | text | 产区 |
| `origin_area` | text | 更细分产区 |
| `harvest_season` | text | 产季 |
| `default_roast_input_grams` | number | 默认单次投豆量 |
| `altitude_meters_min` | number | 最低海拔 |
| `altitude_meters_max` | number | 最高海拔 |
| `moisture_percent` | number | 含水率 |
| `density_g_per_l` | number | 密度 |
| `mill_name` | text | 处理厂 |
| `notes` | text | 备注 |
| `created_at` | text | 兼容前端时间戳 |
| `updated_at` | text | 兼容前端时间戳 |

建议索引：

- `owner,code`

### `green_bean_purchase_batches`

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `owner` | relation(users) | 归属用户 |
| `green_bean_id` | relation(green_beans) | 关联生豆 |
| `purchased_total_price` | number | 采购总价 |
| `purchased_weight_grams` | number | 采购重量 |
| `remaining_weight_grams` | number | 剩余重量 |
| `supplier_name` | text | 供应商 |
| `received_at` | date | 到货日期 |
| `created_at` | text | 兼容前端时间戳 |
| `updated_at` | text | 兼容前端时间戳 |

建议索引：

- `owner,green_bean_id,received_at`

### `bean_sale_specs`

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `owner` | relation(users) | 归属用户 |
| `green_bean_id` | relation(green_beans) | 关联生豆 |
| `channel` | text | 销售渠道 |
| `is_default` | bool | 是否默认规格 |
| `unit_price` | number | 单价 |
| `unit_weight_grams` | number | 单份重量 |
| `created_at` | text | 兼容前端时间戳 |
| `updated_at` | text | 兼容前端时间戳 |

建议索引：

- `owner,green_bean_id,channel`

### `app_settings`

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `owner` | relation(users) | 归属用户 |
| `key` | text | 设置键 |
| `value` | json | 设置值 |
| `created_at` | text | 兼容前端时间戳 |
| `updated_at` | text | 兼容前端时间戳 |

这里会存：

- 单豆售价默认值
- 成本模板绑定
- 单豆等级覆盖

建议索引：

- `owner,key`

### `roast_profiles`

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `owner` | relation(users) | 归属用户 |
| `green_bean_id` | relation(green_beans) | 关联生豆 |
| `bean_name` | text | 冗余显示名称 |
| `name` | text | 方案名称 |
| `batch_weight_grams` | number | 单批投豆量 |
| `planned_batch_kg` | number | 计划批量 |
| `roast_purpose` | text | 用途 |
| `status` | select | `draft` / `inProgress` / `completed` / `cancelled` |
| `steps` | json | 烘焙步骤 |
| `target_roast_level` | text | 目标烘焙程度 |
| `is_active` | bool | 是否启用 |
| `created_at` | text | 兼容前端时间戳 |
| `updated_at` | text | 兼容前端时间戳 |

建议索引：

- `owner,green_bean_id,status`

### `roast_batches`

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `owner` | relation(users) | 归属用户 |
| `roast_date` | date | 烘焙日期 |
| `green_bean_id` | relation(green_beans) | 关联生豆 |
| `green_bean_name` | text | 冗余生豆名称 |
| `roasted_bean_name` | text | 熟豆名称 |
| `roast_plan_id` | relation(roast_profiles) | 关联烘焙计划 |
| `roast_plan_name` | text | 冗余计划名称 |
| `input_weight_grams` | number | 入豆量 |
| `output_weight_grams` | number | 出豆量 |
| `roast_level` | text | 烘焙程度 |
| `development_ratio` | number | 发展比 |
| `first_crack_time` | number | 一爆时间 |
| `total_roast_time` | number | 总烘焙时间 |
| `notes` | text | 备注 |
| `image_urls` | json | 图片地址数组 |
| `status` | select | `completed` / `draft` |
| `created_at` | text | 兼容前端时间戳 |
| `updated_at` | text | 兼容前端时间戳 |

建议索引：

- `owner,roast_date`
- `owner,green_bean_id`

### `roast_records`

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `owner` | relation(users) | 归属用户 |
| `green_bean_id` | relation(green_beans) | 关联生豆 |
| `created_at` | text | 兼容前端时间戳 |
| `updated_at` | text | 兼容前端时间戳 |

这个集合当前主要用于删除关联数据时兜底，后面如果完全迁移到 PocketBase 也可以再细化。

### `cost_calculations`

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `owner` | relation(users) | 归属用户 |
| `bean_id` | text | 生豆 ID |
| `bean_name` | text | 生豆名称 |
| `calculation_name` | text | 计算名称 |
| `purchase_cost_per_kg` | number | 生豆单价 |
| `dehydration_rate` | number | 脱水率 |
| `roast_input_weight_grams` | number | 单锅投豆量 |
| `packaging_cost` | number | 包装费 |
| `energy_cost` | number | 能耗费 |
| `labor_cost` | number | 人工费 |
| `other_cost` | number | 其他费用 |
| `sale_unit_weight_grams` | number | 单份重量 |
| `sale_unit_price` | number | 单份售价 |
| `target_profit_rate` | number | 目标利润率 |
| `cost_per_roasted_kg` | number | 每千克熟豆成本 |
| `cost_per_sale_unit` | number | 单份成本 |
| `profit_per_sale_unit` | number | 单份利润 |
| `profit_rate` | number | 利润率 |
| `roasted_output_weight_grams` | number | 预计出豆量 |
| `sale_unit_count` | number | 可售份数 |
| `suggested_sale_price` | number | 建议售价 |
| `total_batch_cost` | number | 单锅总成本 |
| `data_source` | text | 成本来源 |
| `created_at` | text | 兼容前端时间戳 |
| `updated_at` | text | 兼容前端时间戳 |

建议索引：

- `owner,bean_id,updated_at`

### `finance_expense_records`

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `owner` | relation(users) | 归属用户 |
| `title` | text | 支出标题 |
| `expense_date` | date | 支出日期 |
| `category` | select | `beanPurchase / packaging / shipping / custom / depreciation / other` |
| `custom_category_label` | text | 自定义类别名称 |
| `amount` | number | 支出金额 |
| `status` | select | `paid / pending` |
| `notes` | text | 备注 |
| `source` | select | `auto-bean-purchase / manual` |
| `source_entity_id` | text | 来源实体 ID |
| `created_at` | text | 兼容前端时间戳 |
| `updated_at` | text | 兼容前端时间戳 |

建议索引：

- `owner,updated_at`
- `owner,expense_date`

### `coffee_beans`

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `owner` | relation(users) | 归属用户 |
| `user_id` | text | 兼容熟豆镜像写入 |
| `data` | json | 熟豆镜像数据 |
| `deleted_at` | date | 软删除时间 |
| `version` | number | 版本号 |
| `created_at` | text | 兼容前端时间戳 |
| `updated_at` | text | 兼容前端时间戳 |

### `ai_usage_limits`

用途：控制每个用户每月可使用的 AI 图片识别次数，当前由 PocketBase Dashboard 直接维护。

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `owner` | relation(users) | 归属用户，单选，必填 |
| `feature` | text | 功能码，生豆图片识别固定为 `bean_image_recognition` |
| `monthly_limit` | number | 月度成功识别次数上限，默认建议 10，允许 0 |
| `enabled` | bool | 是否启用该用户的功能 |
| `created_at` | date | 创建时间 |
| `updated_at` | date | 更新时间 |

权限规则：

```text
listRule: 留空
viewRule: 留空
createRule: 留空
updateRule: 留空
deleteRule: 留空
```

建议索引：

- `owner,feature` 唯一索引

### `ai_usage_logs`

用途：记录 AI 图片识别成功/失败结果。只有 `status = success` 会参与额度统计，失败不扣次数。

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `owner` | relation(users) | 归属用户，单选，必填 |
| `feature` | text | 功能码，生豆图片识别固定为 `bean_image_recognition` |
| `month` | text | 月份，格式如 `2026-07` |
| `status` | select | `success / failed`，单选 |
| `error_message` | text | 失败原因，成功时为空 |
| `created_at` | date | 创建时间 |
| `updated_at` | date | 更新时间 |

权限规则同样全部留空，仅允许 superuser 与 BFF 服务端维护。

建议索引：

- `owner,feature,month,status`

## 推荐实施顺序

1. 先建 `users` auth collection。
2. 再建 `green_beans`、`green_bean_purchase_batches`、`bean_sale_specs`、`app_settings`。
3. 接着建 `roast_profiles`、`roast_batches`、`roast_records`。
4. 最后建 `cost_calculations`、`finance_expense_records`、`coffee_beans`、`ai_usage_limits` 和 `ai_usage_logs`。

## 推荐初始化方式

优先推荐：

1. 打开 PocketBase Dashboard。
2. 进入 `Collections`。
3. 使用 `Import collections` 导入 [docs/pocketbase-collections.import.json](/Users/keepwatchthemoon/个人/gitProject/MyCoffeeRoastingBackstage_v1/docs/pocketbase-collections.import.json)。
4. 确认新增了 `finance_expense_records` 集合。

说明：

- 当前项目已经按当前 PocketBase Dashboard 导出格式维护了可直接导入的文件。
- 现有导入 JSON 中如果仍包含历史 `finance_income_records` 集合，可保留但前端已不再使用；当前财务页只依赖 `finance_expense_records`。
- 相比直接改底层 SQLite 系统表，这种方式更安全，也更符合 PocketBase 的集合管理方式。

## 腾讯云部署建议

- 服务器侧数据目录单独挂载持久化盘
- 前面挂 Nginx，统一做 HTTPS 和域名
- 前端或 BFF 部署后只需要切 `VITE_PB_URL` / `PB_BASE_URL`
- 备份以服务器上的 PocketBase 数据目录为准
