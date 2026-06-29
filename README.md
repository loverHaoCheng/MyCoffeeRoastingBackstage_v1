# 咖啡烘焙管理后台

React + TypeScript 前端工程，面向 Go REST 后端服务。首版以手机和平板运行体验为优先，同时保留桌面后台的侧边导航与数据密度。

## 技术栈

- React 19
- TypeScript 5 strict mode
- Vite
- Ant Design
- TanStack Query
- Zustand
- React Router
- React Hook Form + Zod
- Vitest + React Testing Library

## 本地运行

```bash
npm install
npm run dev
```

默认后端地址通过 `.env` 配置：

```bash
VITE_API_BASE_URL=http://localhost:8080/api
```

## 质量检查

```bash
npm run typecheck
npm run test
npm run build
```

## 目录约定

业务代码按 Feature First 组织在 `src/modules` 下。跨模块能力放入 `src/shared`、`src/services`、`src/stores`、`src/types`。

## 烘焙计划创建

烘焙计划页点击“新建计划”后，会从底部打开创建抽屉。抽屉内支持两种方式：

- `AI 导入计划`：通过 JSON 快速创建计划。
- `界面创建`：通过表单录入计划基础信息和烘焙节点。

JSON 基础结构如下：

```json
{
  "name": "肯尼亚 柏拉 AA Plus SL28 SL34 水洗",
  "beanName": "肯尼亚 柏拉 AA Plus SL28 SL34 水洗",
  "batchWeightGrams": 200,
  "roastLevel": "手冲浅烘",
  "purpose": "手冲",
  "steps": [
    {
      "time": "0:00",
      "event": "入豆",
      "operation": "入豆",
      "temperature": "235°C",
      "firePower": "90%"
    }
  ]
}
```

生产批次页会读取烘焙计划列表，创建生产任务时可选择计划并预览执行节点。

## 生豆库存数据源

生豆库存模块当前使用 `src/modules/bean/constants/bean.mock.ts` 的本地数据。后续接入 Supabase 时，替换 `src/modules/bean/services/bean.service.ts` 中的 `beanRepository` 即可；文件内已预留 `createSupabaseBeanRepository`、`SupabaseBeanClient` 与 `SupabaseBeanRecord` 映射类型。

烘焙计划表单的生豆字段会读取同一套生豆服务数据，选择后写入 `beanId` 与 `beanName`，便于后续与 Supabase 同步的生豆表保持一致。

## 设置模块

- 新增 `/settings` 页面，用于录入生豆库和熟豆库两套 Supabase `Project URL` 与 `Publishable Key`
- 设置会保存在浏览器本地，当前仅用于前端连接配置管理，不会保存高权限密钥
- 生豆列表会在成功拉取后写入 `localStorage` 本地缓存；当 Supabase 出现超时、断网或限流等可恢复错误时，页面会自动回退到缓存数据

## Supabase 建表

- 生豆拆表迁移 SQL：`supabase/migrations/20260628_create_green_bean_core.sql`
- 数据模型说明：`docs/data-models/green-bean-supabase.md`
- 双库连接架构：`docs/architecture/settings-and-supabase.md`
