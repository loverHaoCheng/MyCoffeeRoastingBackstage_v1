# API 约定

前端通过 `VITE_API_BASE_URL` 指向后端服务。当前认证、账号注销与 AI 图片识别能力由 Node BFF 承接。

## 统一返回格式

```ts
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
```

`code === 0` 视为业务成功。HTTP 错误或业务错误会统一转换为 `AppError`。

## 生豆 AI 图片识别

接口：

```text
GET /api/ai/bean-image-recognition
POST /api/ai/bean-image-recognition
```

认证：

- 使用现有 HttpOnly Cookie 登录态。
- BFF 先通过 PocketBase `auth-refresh` 校验用户，再用服务端 `PB_SUPERUSER_EMAIL` / `PB_SUPERUSER_PASSWORD` 读写 AI 额度和日志。
- 七牛云 API Key 只读取服务端环境变量 `QINIU_QWEN_API_KEY`，禁止进入前端构建产物。

请求体：

GET 不需要请求体，用于创建方式选择中读取当月额度。

```ts
Content-Type: image/jpeg | image/png | image/webp
Body: binary image bytes
```

说明：

- 前端上传图片后压缩为 JPEG Blob，并以 `image/jpeg` 二进制 body 提交，避免移动端大 JSON body 不稳定。
- BFF 仍兼容旧的 JSON base64 请求体：`imageDataUrl` 或 `imageBase64 + mimeType`。
- BFF 调用七牛云 Qwen 识别和 JSON 整理时都会传入 `enable_thinking: false`，关闭深度思考。
- BFF 通过 prompt 要求七牛云 Qwen 返回 JSON，并兼容 `message.content` 字符串、数组 text part、`choice.text`、`output_text`、`reasoning_content` 等返回结构；当前不强制传 `response_format`，避免部分多模态兼容接口返回空内容。
- 当视觉模型返回了可读文本但不是严格 JSON 时，BFF 会追加一次文本整理请求，把识别文本转为固定字段 JSON；只有最终结构化成功才写入 `success` 计次日志。
- BFF 会把 `harvestSeason` 统一规范为年份后两位，例如 `2026` 或 `2025/26` 返回 `26`。
- 七牛云返回 `401 / 403` 时，BFF 会提示检查 `QINIU_QWEN_API_KEY`、`QINIU_QWEN_MODEL` 与账号模型/视觉调用权限；错误提示不得回显 API Key。
- 当前支持 `jpeg / png / webp`。
- 默认图片体积上限为 `6MB`，可通过服务端 `AI_IMAGE_MAX_BYTES` 调整。

GET 返回：

```ts
interface BeanImageRecognitionUsage {
  enabled: boolean;
  monthlyLimit: number;
  usedThisMonth: number;
  remainingUses: number;
}
```

POST 返回：

```ts
interface BeanImageRecognitionResponse {
  monthlyLimit: number;
  usedThisMonth: number;
  remainingUses: number;
  recognition: {
    code: string;
    displayName: string;
    originCountry: string;
    originRegion: string;
    originArea: string;
    processMethod: string;
    variety: string;
    grade: string;
    harvestSeason: string;
    millName: string;
    flavorTags: string[];
    altitudeMetersMin: number | null;
    altitudeMetersMax: number | null;
    moisturePercent: number | null;
    densityGPerL: number | null;
    supplierName: string;
    notes: string;
  };
}
```

计次规则：

- `ai_usage_limits` 未配置用户记录时，默认 `10 次/月`。
- 只有七牛云识别成功、模型 JSON 解析成功，并成功写入 `success` 日志后才计 1 次。
- 请求参数错误、七牛云失败、模型返回不可解析等写入 `failed` 日志，不计入额度。
- `enabled = false` 或当月成功次数达到 `monthly_limit` 时，BFF 不会调用七牛云。

## 烘焙计划 JSON

前端 JSON 快速创建功能会先在本地校验字段，再转换为标准 `RoastPlan`。后续接入 Go 后端时，可将校验后的计划通过 REST 接口提交。

必填字段：

- `name`
- `beanName`
- `batchWeightGrams`
- `roastLevel`
- `steps`

`steps` 内每一项需要包含 `time`、`event`、`operation`、`temperature`、`firePower`。

## 设置模块运行时配置契约

```ts
interface PocketBaseConnectionSettings {
  greenBean: {
    projectUrl: string;
    publishableKey: string;
  };
  roastedBean: {
    projectUrl: string;
    publishableKey: string;
  };
  updatedAt: string | null;
}
```

该配置当前由前端设置页维护：`greenBean` 用于主库 PocketBase，`roastedBean` 仅用于熟豆镜像写入与设置页探活。

## 财务模块台账契约

当前 `#/finance` 页面分两类数据源：

- `cost_calculations`：继续走 PocketBase 主库同步，用于直接成本汇总。
- `finance_expense_records`：走 PocketBase 主库同步，用于手工经营费用台账。
- `已实现收入`：不再走手工台账集合，而是根据烘焙历史中去向为“销售”的记录实时聚合。

相关前端表单输入契约：

```ts
interface FinanceExpenseFormInput {
  title: string;
  expenseDate: string;
  amount: number;
  category:
    | 'beanPurchase'
    | 'packaging'
    | 'shipping'
    | 'custom'
    | 'depreciation'
    | 'other';
  customCategoryLabel?: string | null;
  status: 'paid' | 'pending';
  notes?: string | null;
}
```
