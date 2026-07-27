# Changelog

## Unreleased

- 安全审计修复（P0/P1）：列表分页取全、财务收入使用本次最终定价、收入台账错误不再静默置空、生豆服务端事务级联删除、内部任务端点共享密钥鉴权、登录账号维度限流、账号注销清理范围补全、部署产物权限归一化与密钥扫描加固；详见 `docs/changelog.md` 2026-07-26 条目。

- 新增 `GPL-3.0-only` 开源协议文件，并同步更新 `package.json` 与 `README` 的许可证说明。
- 新增同源 `/api/auth/*` 登录态网关，支持通过 `HttpOnly Cookie` 恢复 PocketBase 登录态。
- 前端启动时自动拉取会话并恢复登录，关闭浏览器后下次打开仍可保持登录状态。
- 新增 PocketBase auth BFF 的构建、启动和开发脚本，以及对应的 Nginx 代理说明。
- 调整开发环境 API 链路：Vite 不再挂载本地 BFF，统一把 `/api/*` 代理到云端 BFF，并清理本地 `.env.local` 中的服务端密钥。
- 清理历史 Supabase 依赖与脚本，仅保留熟豆设置页配置和烘焙历史创建后的熟豆镜像写入。

## 0.1.0

- 初始化 Vite + React + TypeScript 项目。
- 接入 Ant Design、React Router、TanStack Query、Zustand。
- 新增移动优先的主布局、工作台首页和核心业务模块入口。
- 新增统一 API client、领域类型和基础测试。
- 新增烘焙计划节点表、JSON 快速创建能力，以及生产批次选择烘焙计划流程。
- 调整烘焙计划创建交互为底部抽屉，支持 AI 导入计划与界面创建；移除计划概览卡片和内联 JSON 模块。
- 修复 iPhone 主屏幕 PWA 独立窗口模式下的视口高度与底部导航留白问题，统一移动端安全区和底栏占位逻辑。
