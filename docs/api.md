# API 约定

前端通过 `VITE_API_BASE_URL` 指向 Go 后端服务。

## 统一返回格式

```ts
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
```

`code === 0` 视为业务成功。HTTP 错误或业务错误会统一转换为 `AppError`。

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
