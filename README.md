# EasyBake

React + TypeScript 前端工程，当前切换为 PocketBase 服务器优先方案。首版以手机和平板运行体验为优先，同时保留桌面后台的侧边导航与数据密度。

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

开发环境下，Vite 会直接挂载同源 `/api/auth/*` 登录态网关，不需要额外启动 `auth:bff:start`。前提是服务器上的 PocketBase 与线上 auth BFF 配置可访问。

默认 PocketBase 地址通过 `.env` 配置，开发和生产构建都默认指向服务器 PocketBase：

```bash
VITE_PB_URL=http://81.70.224.75
```

如果线上 PocketBase 地址变化，可以重新在部署环境里覆盖 `VITE_PB_URL`。

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

## PocketBase 服务器连接

- 前端通过 `VITE_PB_URL` 连接服务器上的 PocketBase，默认地址为 `http://81.70.224.75`。
- 注册、登录和登出通过同源 `/api/auth/*` 网关完成，浏览器关闭后仍可通过 `HttpOnly Cookie` 恢复会话。
- 所有业务记录按 `owner` 字段进行用户隔离。
- 可直接导入的 collection JSON 见 [docs/pocketbase-collections.json](/Users/keepwatchthemoon/个人/gitProject/MyCoffeeRoastingBackstage_v1/docs/pocketbase-collections.json)。
- collection 和权限规则清单见 [docs/pocketbase-server-setup.md](/Users/keepwatchthemoon/个人/gitProject/MyCoffeeRoastingBackstage_v1/docs/pocketbase-server-setup.md)。
- 登录态网关说明见 [docs/pocketbase-auth-persistence.md](/Users/keepwatchthemoon/个人/gitProject/MyCoffeeRoastingBackstage_v1/docs/pocketbase-auth-persistence.md)。

## 设置模块

- 新增 `/settings` 页面，用于查看和调整 PocketBase 服务器连接信息与本地显示设置
- 发布版本不再使用 `localStorage` 保存设置、业务缓存或认证会话
- 应用启动时会清理所有 `coffee-roasting-backstage:` 前缀的历史 `localStorage` 数据，旧数据不做迁移
- 后续本地离线缓存统一接入 IndexedDB 缓存仓储，个人数据备份/恢复端口已预留服务层接口

## PocketBase 部署预留

- 推荐使用反向代理和 HTTPS 终止，PocketBase 数据目录在服务器侧单独持久化。
- 现在的登录态方案依赖同源 `Node BFF + HttpOnly Cookie`，前端无需保存 token 到 `localStorage`。
- 未来申请 HTTPS 后，只需要把 BFF 的 Cookie `Secure` 开启并补齐 Nginx SSL 即可。

## 开源协议

本项目采用 `GPL-3.0-only` 开源协议发布。使用、修改和再分发本项目时，需要遵守 GNU General Public License v3.0 的相关要求。

完整协议文本见 [LICENSE](/Users/keepwatchthemoon/个人/gitProject/MyCoffeeRoastingBackstage_v1/LICENSE)。
