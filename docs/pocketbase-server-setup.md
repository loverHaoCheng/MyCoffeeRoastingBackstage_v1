# PocketBase 服务器优先配置

这份说明用于服务器侧 PocketBase 集合、权限和部署结构初始化。

## 目标

- 让当前项目先在服务器 PocketBase 跑通注册、登录和用户隔离。
- 让每个业务 collection 都带 `owner`，确保“每个用户只能看自己的数据”。
- 让当前项目与服务器上的 PocketBase 保持同一套 collection 命名和权限规则。

## 运行前提

- 服务器上已经有可访问的 PocketBase 服务。
- 可通过 PocketBase Dashboard 或 API 管理集合与权限。
- 前端主业务请求固定通过当前站点同源 `/api/*` 进入 BFF，不直接连接 PocketBase，也不使用 `VITE_PB_URL` 配置主库地址。
- BFF 通过服务器环境变量保存 `PB_BASE_URL`、`PB_SUPERUSER_EMAIL`、`PB_SUPERUSER_PASSWORD`、`QINIU_QWEN_API_KEY`、`QINIU_QWEN_BASE_URL`、`QINIU_QWEN_MODEL`；这些值不得写入前端 `VITE_` 环境变量。
- 本地 `npm run dev` 仅代理同源 `/api/*` 到云端 BFF，不启动本地 BFF，也不需要在本地 `.env.local` 填写服务端密钥。

生产服务器 BFF 环境变量示例：

```bash
PB_BASE_URL=http://127.0.0.1:8090
PB_SUPERUSER_EMAIL=你的 PocketBase 管理员邮箱
PB_SUPERUSER_PASSWORD=你的 PocketBase 管理员密码
PB_AUTH_COOKIE_SECURE=true
PB_REQUEST_TIMEOUT_MS=15000
AI_REQUEST_TIMEOUT_MS=90000
QINIU_QWEN_API_KEY=你的七牛云 API Key
QINIU_QWEN_BASE_URL=https://api.qnaigc.com/v1
QINIU_QWEN_MODEL=qwen/qwen3.6-27b
AI_ROAST_PROVIDER=anthropic
AI_ROAST_BASE_URL=https://weilai.chat/v1
AI_ROAST_API_KEY=烘焙 AI（曲线复盘/计划建议）使用的 API Key，例如 OpenAI 的 sk- 开头密钥
AI_ROAST_MODEL=gpt-5.6-terra
INTERNAL_JOBS_TOKEN=用 openssl rand -hex 32 生成的内部任务令牌
```

> 注意：`AI_ROAST_API_KEY` 与 `AI_ROAST_MODEL` 缺失时，烘焙 AI 曲线复盘与计划建议接口会返回“服务器未配置烘焙 AI API Key/模型”。这组 `AI_ROAST_*` 变量与图像识别的 `QINIU_QWEN_*` 相互独立，需要分别配置。`AI_ROAST_PROVIDER=anthropic` 时 BFF 按 Anthropic Messages API 发送到 `/messages`，使用 `x-api-key` 和 `anthropic-version` 请求头；`AI_ROAST_PROVIDER=openai` 时使用 OpenAI 新版接口规范；七牛云等 OpenAI 兼容网关继续使用 Chat Completions 协议。

### 内部任务端点鉴权（INTERNAL_JOBS_TOKEN）

- `/internal/jobs/cleanup-unverified-users` 与 `/internal/jobs/check-roast-training-samples` 使用共享密钥鉴权：请求必须携带 `X-Internal-Jobs-Token` 请求头，且值与 `INTERNAL_JOBS_TOKEN` 一致。
- 未配置 `INTERNAL_JOBS_TOKEN` 时，内部任务端点整体禁用（返回 404）。
- systemd 定时任务的调用命令需同步加请求头，例如：`curl -X POST -H "X-Internal-Jobs-Token: ${INTERNAL_JOBS_TOKEN}" http://127.0.0.1:3001/internal/jobs/cleanup-unverified-users`。
- Nginx 侧应同时配置 `location ^~ /internal/ { return 404; }`，禁止公网访问内部任务路径（纵深防御）。
- 测试端与正式端使用各自独立生成的令牌，并放入对应的 `/etc/easybake/*.env`（`root:root 0600`）。

## 当前客户端兼容约定

- 前端已经会自动给业务写入补 `owner` 字段。
- 前端已经会自动补 `created_at` 和 `updated_at` 字段。
- 当前代码把 `roast_plan_overview` 视为 `roast_profiles` 的兼容别名。
- 当前代码把 `roast_batch_overview` 视为 `roast_batches` 的兼容别名。
- 若继续保留 `roast_batch_overview` 视图，请确保它暴露 `sales_mode` 与三个销售快照字段；否则前端会自动回退到 `roast_batches` 读取真实去向及冻结的销售成本数据。

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
| `altitude_meters_min` | number | 最低海拔，可为空，最小值 1 |
| `altitude_meters_max` | number | 最高海拔，可为空，最小值 1 |
| `moisture_percent` | number | 含水率，可为空，最小值 0.01 |
| `density_g_per_l` | number | 密度，可为空，最小值 0.1 |
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
| `roaster_machine_id` | relation(roasting_machines) | 本计划关联的实体烘焙机；界面显示其 `display_name`。历史未匹配记录可为空，新建和编辑时必须选择 |
| `roast_purpose` | text | 用途 |
| `status` | select | `draft` / `inProgress` / `completed` / `cancelled` |
| `steps` | json | 烘焙步骤，节点内包含时间、事件、操作、炉温、风温、火力、转速 |
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
| `roast_level_source` | text | 烘焙程度判断依据：`beanAgtron`、`groundAgtron`、`dehydrationRate`、`manual` |
| `bean_agtron_color` | number | 咖啡豆表色 Agtron 数值，0-100 |
| `ground_agtron_color` | number | 咖啡粉色 Agtron 数值，0-100 |
| `development_ratio` | number | 发展比 |
| `first_crack_time` | number | 一爆时间 |
| `total_roast_time` | number | 总烘焙时间 |
| `final_sale_unit_price` | number | 本次销售单份最终定价，仅影响本次烘焙记录收入 |
| `sale_unit_price_snapshot` | number | 销售发生时的有效单份售价快照；历史销售回填后不再受默认售价变更影响 |
| `bean_cost_per_sale_unit_snapshot` | number | 销售发生时的单份生豆成本快照 |
| `non_bean_cost_per_sale_unit_snapshot` | number | 销售发生时的单份包装、能耗及其他成本快照；不含人工费 |
| `sold_unit_count` | number | 已售成品份数，非必填、最小值 `0`、仅整数；空值按 `1` 份兼容历史记录 |
| `evaluation` | json | 评价表单，包含评分、风味、缺陷、调整建议与训练授权 |
| `notes` | text | 备注 |
| `image_urls` | json | 图片地址数组 |
| `status` | select | `completed` / `draft` |
| `created_at` | text | 兼容前端时间戳 |
| `updated_at` | text | 兼容前端时间戳 |

建议索引：

- `owner,roast_date`
- `owner,green_bean_id`

### `roast_curve_records`

用途：保存烘焙记录绑定的当前有效曲线。一个 `roast_batches` 记录只保留一条曲线；重新导入 HiBean JSON 时覆盖当前记录，不保留历史版本。

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `owner` | relation(users) | 归属用户 |
| `roast_batch_id` | relation(roast_batches) | 关联烘焙记录，建议唯一 |
| `source` | text | 曲线来源，首版固定 `hibean` |
| `source_version` | text | HiBean 导出版本 |
| `sample_interval` | number | 采样间隔，单位秒 |
| `temperature_unit` | text | 温度单位，首版通常为 `C` |
| `curve_data` | json | 标准化曲线点数组 |
| `event_list` | json | 标准化事件数组 |
| `phase_list` | json | 阶段数组 |
| `device_info` | json | 设备快照 |
| `bean_snapshot` | json | 导出文件中的生豆快照 |
| `metrics` | json | 解析出的总时长、一爆、发展比、下豆温等指标 |
| `event_overrides` | json | 手动编辑节点对应的原始采样点索引；不覆盖完整曲线和导入事件 |
| `original_file_name` | text | 导入文件名 |
| `imported_at` | text | 导入时间 |
| `created_at` | text | 兼容前端时间戳 |
| `updated_at` | text | 兼容前端时间戳 |

建议索引：

- `owner,roast_batch_id`
- `roast_batch_id` 唯一索引，保证一个烘焙记录只有一条当前有效曲线

标准化约定：

- 测试端与正式端必须使用同一套 `roast_curve_records` collection 结构。
- 新写入的 `curve_data`、`event_list`、`phase_list`、`metrics` JSON 必须使用应用标准 camelCase 字段，例如 `timeSeconds`、`beanTemperature`、`rateOfRise`、`roastDuration`。
- 读取历史备份或旧数据时可兼容 `time_seconds`、`bean_temperature`、`rate_of_rise`、`roast_duration` 等旧字段，但这些兼容字段不得作为新写入格式。
- `event_overrides` 只保存入豆、回温点、转黄、一爆开始、一爆结束和下豆所选的 `sampleIndex`；展示与 AI 以它重建有效曲线，原始 `curve_data`、`event_list`、`metrics` 与 `phase_list` 始终保留完整导入值。

### `roast_training_samples`

用途：保存用于后续训练的不可变快照。当前阶段只在测试环境写入，不触发训练、不生成推荐。

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `owner` | relation(users) | 归属用户，必填 |
| `roast_batch_id` | relation(roast_batches) | 关联烘焙记录，必填 |
| `roaster_model` | text | 烘焙记录关联的实体烘焙机显示名称；不使用固定型号枚举 |
| `snapshot` | json | 服务端读取 PocketBase 后生成的训练快照 |
| `quality_status` | select | 质量状态，当前默认 `pending`，预留 `passed` / `failed` |
| `quality_report` | json | 自动质量检查报告，包含错误、警告与核心指标 |
| `quality_checked_at` | text | 质量检查完成时间，ISO 字符串 |

建议索引：

- `owner,roast_batch_id`
- `owner,roaster_model,created`

### `roast_training_uploads`

用途：保存训练上传审计记录，并防止同一条烘焙记录重复上传。

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `owner` | relation(users) | 归属用户，必填 |
| `roast_batch_id` | relation(roast_batches) | 关联烘焙记录，必填 |
| `sample_id` | relation(roast_training_samples) | 对应训练快照，必填 |
| `status` | select | 上传状态，当前固定 `uploaded` |

建议索引：

- `owner,roast_batch_id` 唯一索引，保证一个用户的一条烘焙记录只能上传一次
- `owner,status,created`

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
| `target_profit_rate` | number | 毛利率 |
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
| `roast_batch_ids` | relation(roast_batches) | 邮费关联的销售烘焙记录，多选，最多 100 条；同一 ID 重复次数代表关联份数；非必填，不级联删除 |
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

用途：控制每个用户每月可使用的 AI 功能次数，当前由 PocketBase Dashboard 直接维护。未配置用户记录时，`roast_analysis`、`roast_general_question` 与 `roast_plan_recommendation` 默认按 `20 次/月` 放行，其他 AI 功能默认按 `10 次/月` 放行。

可直接导入 [pocketbase-ai-usage-collections.import.json](pocketbase-ai-usage-collections.import.json) 创建 `ai_usage_limits` 与 `ai_usage_logs`；导入后不要将任一规则改为空字符串。

`feature` 必须是 select，且测试端与正式端均须包含：`bean_image_recognition`、`roaster_model_recognition`、`roast_analysis`、`roast_plan_recommendation`。已发布环境可保留 `roast_training_recommendation` 选项与历史日志，但新功能不再写入该功能码。

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `owner` | relation(users) | 归属用户，单选，必填 |
| `feature` | select | 功能码选项：`bean_image_recognition`、`roast_analysis`、`roast_plan_recommendation`；已发布环境可额外保留历史 `roast_training_recommendation` |
| `monthly_limit` | number | 月度成功调用次数上限；曲线复盘、常识性提问与计划建议建议 20，其他 AI 功能建议 10，允许 0 |
| `enabled` | bool | 是否启用该用户的功能 |
| `created_at` | date | 创建时间 |
| `updated_at` | date | 更新时间 |

权限规则：

```text
listRule: null（Dashboard 保持“锁定”，严禁填写空字符串 ""）
viewRule: null（Dashboard 保持“锁定”，严禁填写空字符串 ""）
createRule: null（Dashboard 保持“锁定”，严禁填写空字符串 ""）
updateRule: null（Dashboard 保持“锁定”，严禁填写空字符串 ""）
deleteRule: null（Dashboard 保持“锁定”，严禁填写空字符串 ""）
```

建议索引：

- `owner,feature` 唯一索引

后台调整方式：

1. 在 PocketBase Dashboard 打开 `ai_usage_limits`。
2. 为指定用户创建或编辑一条记录，`owner` 选择该用户，`feature` 填对应功能码。
3. `monthly_limit` 即该用户该功能的月度上限；填写 `0` 表示本月额度为 0。
4. `enabled = false` 表示关闭该用户该功能。
5. 若某个用户没有对应 `owner + feature` 记录，`roast_analysis`、`roast_general_question` 与 `roast_plan_recommendation` 默认按 `20 次/月` 处理，其他 AI 功能默认按 `10 次/月` 处理；删除既有记录后也会立即恢复该默认值。

### `ai_usage_logs`

用途：记录 AI 功能成功/失败结果。BFF 在调用模型前先写入 `status = success` 作为并发预占；调用失败时会改为 `failed`，因此最终只有成功调用会参与额度统计，失败不扣次数。`feature` 的 select 允许值必须与 `ai_usage_limits` 完全一致。

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `owner` | relation(users) | 归属用户，单选，必填 |
| `feature` | select | 功能码选项：`bean_image_recognition`、`roast_analysis`、`roast_plan_recommendation`；已发布环境可额外保留历史 `roast_training_recommendation` |
| `month` | text | 月份，格式如 `2026-07` |
| `status` | select | `success / failed`，单选 |
| `error_message` | text | 失败原因，成功时为空 |
| `created_at` | date | 创建时间 |
| `updated_at` | date | 更新时间 |

权限规则同样全部设为 `null`/Dashboard“锁定”，仅允许 superuser 与 BFF 服务端维护。严禁使用空字符串 `""`，其语义是公开访问。

建议索引：

- `owner,feature,month,status`

### `ai_analysis_tasks`

用途：保存 `curve_review`（AI 曲线复盘）任务。前端只负责提交，BFF worker 负责在后台执行并把结果写入既有 AI 结果集合；任务完成后前端确认 `notified_at`，关闭网页、刷新页面或退出 PWA 都不会中断任务。已发布环境可保留历史 `overall_analysis` 记录，但 worker 不会再处理该类型。

直接导入 [pocketbase-ai-analysis-tasks.import.json](pocketbase-ai-analysis-tasks.import.json)。测试端和正式端必须导入同一份文件，字段、索引和规则不得单独漂移。

关键字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `owner` | relation(users) | 任务归属用户，必填 |
| `roast_batch_id` | text | 烘焙记录 ID |
| `task_type` | select | `curve_review`；已发布环境可保留历史 `overall_analysis` |
| `status` | select | `queued` / `processing` / `completed` / `failed` |
| `active_key` | text | 活动任务去重键；完成或失败后由 BFF 改写 |
| `input_payload` | json | 服务端校验后的输入快照 |
| `result_payload` | json | worker 执行结果，供审计和恢复使用 |
| `error_message` | text | 失败原因，最多 500 字符 |
| `started_at` / `completed_at` / `notified_at` | text | 任务生命周期和提示确认时间 |

权限规则必须保持为 Dashboard 的“锁定”（`null`），不能填写空字符串 `""`：普通用户只能通过 BFF 查询自己的任务，创建、更新、删除全部由 BFF superuser 完成。唯一索引为 `owner, roast_batch_id, task_type, active_key`；worker 索引为 `status, created`，通知查询索引为 `owner, status, notified_at`。

BFF 启动后会立即扫描未完成任务，之后每 5 秒扫描一次。当前每个环境只运行一个 BFF 实例；若未来扩容为多实例，需要在 PocketBase 增加原子领取/租约字段后再扩容 worker，避免重复调用模型。

## 推荐实施顺序

1. 先建 `users` auth collection。
2. 再建 `green_beans`、`green_bean_purchase_batches`、`bean_sale_specs`、`app_settings`。
3. 接着建 `roast_profiles`、`roast_batches`、`roast_records`。
4. 最后建 `cost_calculations`、`finance_expense_records`、`coffee_beans`、`ai_usage_limits`、`ai_usage_logs` 和 `ai_analysis_tasks`。

## 推荐初始化方式

优先推荐：

1. 打开 PocketBase Dashboard。
2. 进入 `Collections`。
3. 使用 `Import collections` 导入仓库内的 `docs/pocketbase-collections.import.json`。
4. 确认新增了 `finance_expense_records` 集合。

说明：

- 当前项目已经按当前 PocketBase Dashboard 导出格式维护了可直接导入的文件。
- 现有导入 JSON 中如果仍包含历史 `finance_income_records` 集合，可保留但前端已不再使用；当前财务页只依赖 `finance_expense_records`。
- 相比直接改底层 SQLite 系统表，这种方式更安全，也更符合 PocketBase 的集合管理方式。

## 腾讯云部署建议

- 服务器侧数据目录单独挂载持久化盘
- 前面挂 Nginx，统一做 HTTPS 和域名
- BFF 的 `PB_BASE_URL` 必须指向同机 PocketBase 内网地址，例如 `http://127.0.0.1:8090`；不能填写前端站点域名或 PocketBase 公网地址
- 备份以服务器上的 PocketBase 数据目录为准

## 原子库存扩展

烘焙记录与采购批次库存必须使用 `server/pocketbase-extension` 构建的自定义 PocketBase 二进制。该扩展提供烘焙记录事务端点和采购批次版本更新端点，BFF 负责认证与白名单代理。

发布顺序：`./deploy_test.sh` 或 `./deploy.sh` 会同步 `server/pocketbase-extension`，在目标服务器构建带版本标识的候选二进制，通过高优先级 systemd 覆盖切换并重启单个服务，再请求 `/api/easybake/health` 校验版本。版本不一致或服务不健康会自动移除新覆盖并恢复上一版本。测试端验证通过后再按同一流程切换正式端；保留旧二进制和旧覆盖文件用于回滚。烘焙事务接口对未知字段直接返回错误，禁止静默丢弃业务数据。

BFF 的敏感配置使用 `/etc/easybake/*.env`，权限必须为 `root:root 0600`。服务单元使用 `EnvironmentFile=` 引用，禁止继续在 systemd 单元或 drop-in 中保存 API 密钥和管理员密码。
