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

## 设置模块本地配置契约

```ts
interface SupabaseConnectionSettings {
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

该配置当前由前端设置页维护，供后续 Repository 层分别连接生豆库和熟豆库使用。
