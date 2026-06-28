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

