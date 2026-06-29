# 架构说明

项目采用 Feature First + Clean Architecture 的组织方式。

## 分层

- UI: 页面和展示组件，只负责交互与展示。
- Hooks/ViewModel: 组合查询、状态和页面行为。
- Services: 封装 API 与 mock 数据入口。
- Domain Types: 定义领域实体和接口返回类型。

## 响应式策略

- 手机：顶部轻量标题栏 + 底部主导航 + 可横向滚动数据区。
- 平板和桌面：侧边导航 + 内容区响应式网格。
- 固定格式组件通过 `minmax`、`overflow-x` 和稳定间距避免布局跳动。

## 双 Supabase 配置

- 新增 `设置` 模块，负责维护生豆库和熟豆库两套 `Project URL` / `Publishable Key`。
- 设置模块当前通过 Zustand + 本地存储保存连接信息，后续仓库层可按领域读取并创建对应客户端。
- 详细流程见 `docs/architecture/settings-and-supabase.md`。

## 本地缓存

- 生豆数据新增 `localStorage` 缓存层，键名为 `coffee-roasting-backstage:beans-cache`。
- 成功拉取 Supabase 数据后会写入缓存；遇到可恢复请求失败时会自动回退到缓存。
- 设置页底部会展示缓存条数、最近同步时间、当前同步状态与数据来源。
