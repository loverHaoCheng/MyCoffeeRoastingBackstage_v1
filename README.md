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

开发环境下，Vite 会把同源 `/api/*` 请求代理到云端 BFF，不需要额外启动 `auth:bff:start`。前提是服务器上的 PocketBase 与线上 auth BFF 配置可访问。

开发环境不再启动或挂载本地 BFF，所有 `/api/*` 请求都会由 Vite 代理到云端 BFF。`.env.local` 只允许保留前端公开配置，不得写入 `PB_SUPERUSER_EMAIL`、`PB_SUPERUSER_PASSWORD`、`QINIU_QWEN_API_KEY` 等服务端密钥。

默认 API 配置见 `.env.example`：

```bash
VITE_API_BASE_URL=/api
VITE_DEV_API_PROXY_TARGET=https://www.easybake.top
```

如果云端 BFF 地址变化，可以在本地 `.env.local` 里只覆盖 `VITE_DEV_API_PROXY_TARGET`。
业务数据默认使用当前浏览器同源 BFF 地址；生产站点会请求 `https://www.easybake.top/api/collections/...`，由 BFF 转发到 PocketBase。主库不支持由浏览器直接切换到外部 PocketBase 地址，避免绕过 HttpOnly Cookie 认证边界。

## 正式发布

先发布到测试环境：

```bash
./deploy_test.sh
```

脚本会把前端、BFF 分别发布到测试服务。测试站当前不再默认使用 Basic Auth，便于验证登录态、PWA 和 AI 训练上传接口。

测试环境通过发布前验收后，再执行正式发布：

```bash
./deploy.sh
```

发布脚本会在前端构建后扫描即将上传的静态快照，发现 `.env*`、私钥文件、部署密码或服务端密钥标记时会中止发布。不要手工上传包含 `dist/server/`、本地 `.env.local` 或 `.deploy_test.local` 的目录。

发布脚本会先保存前端构建快照，再构建、上传并验证服务器 BFF；BFF 以整个 `dist/server/` 目录发布，探测失败时自动恢复前一个服务端目录。前端发布使用版本目录和原子入口链接切换，公网验收失败会自动切回上一版本。随后验证版本号、`/api/health` 以及无凭据认证端点。验证通过后，用户只需要通过 HTTPS 443 访问 `https://www.easybake.top`。

前端版本目录默认最多保留 `5` 个，其中当前版本（`/var/www/easybake`）与上一版本（`/var/www/easybake.previous`）始终受保护；其余版本按修改时间从新到旧保留，超出的目录在发布验收成功后清理。需要调整数量时可执行 `FRONTEND_RELEASES_TO_KEEP=8 ./deploy.sh`；该值不得小于 `2`。

发布阶段通过服务器发布目录中的原子锁互斥。已有发布任务时，后发任务不会修改 BFF、前端入口或版本目录，而是立即退出并显示锁持有者、创建时间、最后更新时间和发布阶段；正常结束或脚本异常退出都会尝试释放自己的锁。若电脑被强制关闭或连接中断，必须先确认原发布任务已停止，再按部署文档移除精确锁目录，脚本不会自动抢占锁。

### 更新进群二维码

“进群交流 bugs”二维码从服务器独立路径 `/var/www/easybake-assets/community-qr.png` 读取，不随前端发布包更新。将新的 PNG 或 JPEG 图片保存到本机后执行：

```bash
./update_community_qr.sh /absolute/path/to/community-qr.png
```

脚本会先将 JPEG 自动转换为 PNG，再上传临时文件并由服务器原子替换正式二维码；正式站与测试站共用同一张图片，刷新页面后即可看到新二维码，无需执行发布脚本。

## 质量检查

```bash
npm run typecheck
npm run test
npm run build
```

## 目录约定

业务代码按 Feature First 组织在 `src/modules` 下。跨模块能力放入 `src/shared`、`src/services`、`src/stores`、`src/types`。

服务端 auth BFF 按职责组织在 `server/auth-bff` 下：入口 `server/pocketbase-auth-bff.ts` 只负责组装 handler 和启动本地 HTTP 服务；认证、业务集合代理、realtime、AI 图片识别、账号注销、HTTP 工具和 PocketBase 客户端分别放在独立模块中，单文件必须低于 500 行。

## 财务模块

- 新增 `#/finance` 一级页面，用于查看经营总览、手工收入台账、经营费用台账和单锅成本核算记录。
- 已实现收入仅统计“已收款”记录；经营费用仅统计“已支付”记录。
- 当前库存预估收入按剩余生豆、默认售价和最近一次成本核算脱水率估算，用于经营预判，不替代真实销售数据。

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

- 前端通过当前浏览器同源 BFF 连接服务器上的 PocketBase 业务接口；BFF 再访问 PocketBase 内网地址。
- 注册、登录和登出通过同源 `/api/auth/*` 网关完成，浏览器关闭后仍可通过 `HttpOnly Cookie` 恢复会话；PocketBase Token 不会返回或存储在前端。
- 所有业务记录按 `owner` 字段进行用户隔离。
- 可直接导入的 collection JSON 见 [docs/pocketbase-collections.json](/Users/keepwatchthemoon/个人/gitProject/MyCoffeeRoastingBackstage_v1/docs/pocketbase-collections.json)。
- collection 和权限规则清单见 [docs/pocketbase-server-setup.md](/Users/keepwatchthemoon/个人/gitProject/MyCoffeeRoastingBackstage_v1/docs/pocketbase-server-setup.md)。
- 登录态网关说明见 [docs/pocketbase-auth-persistence.md](/Users/keepwatchthemoon/个人/gitProject/MyCoffeeRoastingBackstage_v1/docs/pocketbase-auth-persistence.md)。

## 设置模块

- 新增 `/settings` 页面，用于查看和调整 PocketBase 主库连接、熟豆 Supabase 镜像连接与本地显示设置
- 发布版本不再使用 `localStorage` 保存设置、业务缓存或认证会话
- 应用启动时会清理所有 `coffee-roasting-backstage:` 前缀的历史 `localStorage` 数据，旧数据不做迁移
- 后续本地离线缓存统一接入 IndexedDB 缓存仓储，个人数据备份/恢复端口已预留服务层接口
- 财务模块的手工收入台账和经营费用台账已接入 `finance` 命名空间的 IndexedDB 缓存

## PocketBase 部署预留

- 推荐使用反向代理和 HTTPS 终止，PocketBase 数据目录在服务器侧单独持久化。
- 现在的登录态方案依赖同源 `Node BFF + HttpOnly Cookie`，前端无需保存 token 到 `localStorage`。
- 未来申请 HTTPS 后，只需要把 BFF 的 Cookie `Secure` 开启并补齐 Nginx SSL 即可。

## 开源协议

本项目采用 `GPL-3.0-only` 开源协议发布。使用、修改和再分发本项目时，需要遵守 GNU General Public License v3.0 的相关要求。

完整协议文本见 [LICENSE](/Users/keepwatchthemoon/个人/gitProject/MyCoffeeRoastingBackstage_v1/LICENSE)。
