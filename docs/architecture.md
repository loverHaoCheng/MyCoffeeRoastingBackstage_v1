# 架构说明

项目采用 Feature First + Clean Architecture 的组织方式。

## 分层

- UI: 页面和展示组件，只负责交互与展示。
- Hooks/ViewModel: 组合查询、状态和页面行为。
- Services: 封装 API 与 mock 数据入口。
- Domain Types: 定义领域实体和接口返回类型。

Finance 领域当前拆分为三层能力：

- `cost_calculations`：沿用现有 PocketBase 主库能力，负责单锅直接成本。
- `income-records / expense-records`：先落前端本地台账，负责经营收入和经营费用。
- `FinancePage + useFinanceOverview`：在页面层汇总已实现收入、预估收入、毛利润、经营利润与利润率。

## 响应式策略

- 手机：顶部轻量标题栏 + 底部主导航 + 可横向滚动数据区。
- 平板和桌面：侧边导航 + 内容区响应式网格。
- 固定格式组件通过 `minmax`、`overflow-x` 和稳定间距避免布局跳动。

## 连接配置

- 新增 `设置` 模块，负责维护生豆主库连接，以及熟豆 Supabase 镜像所需的 `Project URL` / `Publishable Key`。
- 设置模块当前通过 Zustand 管理运行期状态，连接信息后续应迁移到服务端用户配置，不再写入浏览器持久存储。
- 详细流程见 `docs/architecture/settings-and-roasted-bean-supabase.md`。

## 本地缓存

- 发布版本不再使用 `localStorage` 保存业务数据、设置、连接信息或认证会话。
- 应用启动和退出登录时会清理所有 `coffee-roasting-backstage:` 前缀的历史 `localStorage` 键，不做旧数据迁移。
- 当前业务服务以运行期内存状态 + PocketBase 远端同步为主。
- 财务模块的手工收入与经营费用已统一接入 PocketBase 集合，不再依赖本地 IndexedDB 缓存。
