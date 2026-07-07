# EasyBake

React + TypeScript 前端工程，当前切换为 PocketBase 本地优先方案。首版以手机和平板运行体验为优先，同时保留桌面后台的侧边导航与数据密度。

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
npm run pb:serve
npm run dev
```

默认 PocketBase 地址通过 `.env` 配置：

```bash
VITE_PB_URL=http://127.0.0.1:8090
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

## PocketBase 本地运行

- 本地 PocketBase 运行目录统一放在仓库根目录的 `PocketBase/` 下。
- 前端通过 `VITE_PB_URL` 连接本地 PocketBase。
- 注册、登录和登出由前端直接对接 PocketBase Auth collection 完成。
- 所有业务记录按 `owner` 字段进行用户隔离。
- 可直接导入的 collection JSON 见 [docs/pocketbase-collections.json](/Users/keepwatchthemoon/个人/gitProject/MyCoffeeRoastingBackstage_v1/docs/pocketbase-collections.json)。
- collection 和权限规则清单见 [docs/pocketbase-local-setup.md](/Users/keepwatchthemoon/个人/gitProject/MyCoffeeRoastingBackstage_v1/docs/pocketbase-local-setup.md)。
- 本地 runtime 说明见 [PocketBase/README.md](/Users/keepwatchthemoon/个人/gitProject/MyCoffeeRoastingBackstage_v1/PocketBase/README.md)。

## 设置模块

- 新增 `/settings` 页面，用于查看和调整 PocketBase 连接信息与本地显示设置
- 设置会保存在浏览器本地，当前仅用于前端连接配置管理，不会保存高权限密钥
- 生豆列表会在成功拉取后写入 `localStorage` 本地缓存；当 PocketBase 出现超时、断网或限流等可恢复错误时，页面会自动回退到缓存数据

## PocketBase 部署预留

- 本地联调通过后，可将同一套 PocketBase 目录结构迁到腾讯云 CVM。
- 推荐使用反向代理和 HTTPS 终止，PocketBase 数据目录单独持久化。
- 前端仅需要切换 `VITE_PB_URL` 和部署域名即可。
