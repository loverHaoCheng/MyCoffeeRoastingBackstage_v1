# **React 企业级项目工程规范**

Version: 1.2

>

Last Updated: 2026-08-10

>

适用于长期维护的 React + TypeScript 项目，包括 SaaS 系统、管理后台、ERP、数据平台、工具型应用及中大型业务系统。

---

# **1. 项目设计目标**

## **1.1 核心原则**

本项目必须满足以下目标：

- 高可维护性（Maintainability）
- 高可扩展性（Scalability）
- 高可测试性（Testability）
- 高稳定性（Reliability）
- 高性能（Performance）
- 高内聚低耦合（High Cohesion / Low Coupling）
- 类型安全（Type Safety）
- AI 协作友好（AI Friendly）

---

## **1.2 架构原则**

遵循：

- SOLID 原则
- KISS 原则
- DRY 原则
- Feature First 原则
- DDD（领域驱动设计）
- Clean Architecture

禁止：

- 巨型组件
- 巨型 Store
- 巨型页面
- 业务逻辑散落 UI

---

# **2. 技术栈规范**

## **2.1 前端框架**

必须使用：

```text
React 19+
TypeScript 5+
```

禁止：

```text
JavaScript 业务代码
```

---

## **2.2 构建工具**

优先级：

```text
1. Vite
2. Next.js（SSR场景）
```

禁止：

```text
Create React App
```

---

## **2.3 UI组件库**

推荐：

```text
Ant Design
Mantine
Shadcn/UI
HeroUI
```

原则：

```text
优先复用成熟组件
避免重复造轮子
```

---

## **2.4 样式方案**

推荐：

```text
TailwindCSS
CSS Module
```

禁止：

```text
全局样式污染
!important 滥用
```

---

## **2.7 UI 设计大前提**

所有 UI 设计必须遵循：

```text
Apple 公司设计风格
```

原则：

```text
简洁
克制
清晰
轻量
高可读性
触控友好
响应式优先
```

禁止：

```text
复杂装饰
过度堆叠
低对比度文本
移动端横向页面滚动
```

---

## **2.5 数据请求**

统一：

```text
TanStack Query
```

禁止：

```text
页面内部直接 fetch
```

---

## **2.6 状态管理**

推荐：

```text
Zustand
```

复杂项目：

```text
Zustand + React Query
```

禁止：

```text
单一全局超级 Store
```

---

# **3. 项目目录结构**

```text
src/

├── app/
│
├── router/
│
├── layouts/
│
├── modules/
│
├── shared/
│
├── hooks/
│
├── services/
│
├── stores/
│
├── utils/
│
├── constants/
│
├── assets/
│
├── types/
│
├── tests/
│
└── main.tsx
```

---

# **4. Feature First 架构**

## **正确结构**

```text
modules/

├── bean/
├── roast/
├── inventory/
├── production/
├── user/
└── finance/
```

---

## **单模块结构**

```text
bean/

├── components/
├── pages/
├── hooks/
├── services/
├── store/
├── types/
├── schemas/
├── constants/
└── index.ts
```

---

# **5. DDD 领域设计**

## **核心领域**

### **Bean**

```text
生豆管理
```

---

### **Roast**

```text
烘焙计划
烘焙曲线
```

---

### **Inventory**

```text
库存管理
```

---

### **Production**

```text
生产批次
```

---

### **Formula**

```text
烘焙配方
```

---

### **Finance**

```text
成本分析
利润分析
```

---

# **6. TypeScript 规范**

## **开启严格模式**

```json
{
	"strict": true
}
```

---

## **禁止**

```ts
any;
```

---

## **使用**

```ts
unknown;
```

---

## **所有数据必须定义类型**

正确：

```ts
interface Bean {
	id: number;
	name: string;
}
```

错误：

```ts
const bean = {};
```

---

# **7. 组件开发规范**

## **单一职责原则**

正确：

```text
BeanCard
BeanEditor
BeanDeleteDialog
```

错误：

```text
BeanCardEditorDeleteManager
```

---

## **文件大小限制**

推荐：

```text
< 200 行
```

警戒：

```text
> 300 行
```

必须拆分：

```text
> 500 行
```

---

## **Props 必须声明**

正确：

```ts
interface Props {
	beanId: number;
}
```

禁止：

```ts
props: any;
```

---

# **8. Hooks 规范**

业务逻辑必须抽离：

```text
useBeanInventory
useRoastProfile
useProductionBatch
```

禁止：

```text
页面组件承担全部业务逻辑
```

---

# **9. 状态管理规范**

按领域拆分：

```text
useBeanStore
useInventoryStore
useRoastStore
useUserStore
```

禁止：

```text
useGlobalStore
```

---

# **10. API 设计规范**

统一放置：

```text
services/
```

示例：

```text
bean.service.ts
roast.service.ts
inventory.service.ts
```

---

## **统一返回格式**

```ts
interface ApiResponse<T> {
	code: number;
	message: string;
	data: T;
}
```

---

# **11. Repository 模式**

数据流：

```text
UI
↓
ViewModel
↓
Service
↓
Repository
↓
Database
```

禁止：

```text
UI直接访问数据库
```

---

# **12. 表单规范**

统一：

```text
React Hook Form
```

验证：

```text
Zod
```

---

## **示例**

```ts
const BeanSchema = z.object({
	name: z.string().min(1),
	weight: z.number().positive(),
});
```

---

# **13. 错误处理规范**

统一异常对象：

```ts
class AppError extends Error {}
```

---

统一边界：

```tsx
<ErrorBoundary>
```

---

禁止：

```ts
console.log(error);
```

后直接结束。

---

# **14. 日志规范**

统一日志工具：

```ts
logger.debug();
logger.info();
logger.warn();
logger.error();
```

禁止：

```ts
console.log();
```

进入生产环境。

---

# **15. 测试规范**

工具：

```text
Vitest
React Testing Library
```

---

覆盖率要求：

```text
核心业务 ≥ 80%
普通模块 ≥ 60%
```

---

# **16. 性能规范**

允许：

```tsx
React.memo;
useMemo;
useCallback;
```

---

原则：

```text
按需优化
避免过度优化
```

---

# **17. 安全规范**

## **Token**

禁止：

```text
LocalStorage
```

推荐：

```text
HttpOnly Cookie
```

---

## **输入校验**

所有用户输入必须：

```text
类型校验
长度校验
XSS过滤
```

---

# **18. Git 提交规范**

统一格式：

```text
feat:
fix:
docs:
style:
refactor:
test:
chore:
```

---

示例：

```text
feat(bean): add bean inventory page

fix(roast): correct development ratio calculation

refactor(inventory): optimize stock update flow
```

---

# **19. AI 协作开发规范**

AI生成代码必须满足：

```text
TypeScript Strict Mode
ESLint 通过
Type Check 通过
单元测试通过
```

---

禁止 AI 生成：

```text
any
巨型组件
重复代码
隐藏业务逻辑
```

---

# **20. 文档规范**

新增模块必须同步更新：

```text
README
架构图
数据模型
接口文档
变更记录
```

禁止：

```text
代码完成后不更新文档
```

---

# **21. 插件化架构预留**

目录：

```text
plugins/

├── ai-analysis/
├── report/
├── cost-analysis/
└── export/
```

原则：

```text
核心业务与插件解耦
```

---

# **22. 数据库设计原则**

实体：

```text
Bean
Roast
Inventory
Production
User
```

---

统一包含：

```text
id
createdAt
updatedAt
```

---

禁止：

```text
字段命名不统一
```

---

# **23. 项目演进路线**

## **V1**

```text
单用户工具
```

---

## **V2**

```text
多用户系统
```

---

## **V3**

```text
权限系统
```

---

## **V4**

```text
工作流引擎
```

---

## **V5**

```text
插件系统
```

---

## **V6**

```text
微前端架构
```

---

# **24. 生豆管理系统专项要求**

适用于：

```text
生豆管理
库存管理
烘焙管理
生产管理
成本分析
```

领域模型：

```text
Bean
RoastPlan
RoastBatch
Inventory
Formula
CostRecord
Supplier
Customer
```

未来扩展：

```text
ERP
CRM
MES
AI烘焙建议
自动排产
数据分析平台
```

所有架构设计必须保证未来扩展无需推翻现有系统。

---

# **25. 最终原则**

任何新增代码必须满足：

```text
可维护
可扩展
可测试
可阅读
可复用
```

若出现冲突：

```text
可维护性 > 开发速度
可扩展性 > 临时实现
代码质量 > 功能数量
```

## 其他需求

```text
1.以黑白灰为主色调。
2.存在可以复用的组件或功能展示类似的组件尽可能复用，便于后期维护。
3.请你在回答前先向我提问，要求一次只问一个问题，请根据我的回答继续追问，直到你有95%的信心，完全理解我的真实需求和目标时，再给出最终方案。同时，你有没有其他的边界条件可以增加答案的准确度的，你可以随时问我，再给出答案。
4.以本文档为执行需求的底线，如果我的需求违反本文档的要求，要为我提示并给出优化的解决方案。
5.如果按本文件为前提执行，则回答中句首包含“（本回答以最新的 AGENTS 1.2 为前提）“
6.对功能及逻辑等修改时，可以参照交互文档进行定位。当修改完成或新建功能逻辑时对交互文档做对应的修改。
7.计划执行时，先将任务拆分为人工自行操作部分和其他，第一步完成人工操作部分，此部分优先为对服务器和环境变量的配置等无法自动完成的项目，并详细给出操作步骤和流程。若没有人工操作部分则跳过这一步，并说明“当前操作无需人工操作进行提前准备“。
8.需要人工逐步执行时，需拆分为多次逐步执行，每次人工执行后返回给你结果，判断结果后再说明下一步需要执行的操作。
9.修改服务器时，需要为我提示是否会影响目前已发布的项目。
10.如需新增样式或功能，优先考虑ui.shadcn的组件。
11.测试端与正式端的PocketBase、BFF、web等同步修改，如果需要单独修改时我会进行提示。
```

## UI/UX 设计系统（EasyBake）

本节由 `ui-ux-pro-max` 基于当前 React 19 + Vite 企业级烘焙运营后台生成，并在不违背本文件既有约束的前提下作为界面统一标准。

### 产品与风格

- 产品类型：咖啡烘焙生产与库存运营 SaaS / 管理后台。
- 视觉方向：Minimalism & Swiss，Apple 风格；信息优先、克制留白、稳定层级。
- 默认以浅色黑白灰为主，深色模式使用同一语义 token 的反差配对；禁止渐变装饰、彩色堆叠和 emoji 图标。
- 页面优先移动端，再扩展至 768px、1024px、1440px；任何页面不得产生移动端横向滚动。

### 颜色 Token

组件不得直接写页面级 hex 颜色，统一使用 `src/app/styles/global.css` 中的语义变量：

```text
--app-bg / --app-bg-elevated / --app-bg-surface / --app-bg-soft
--app-text / --app-text-secondary / --app-text-tertiary
--app-border / --app-border-soft / --app-border-hover
--app-selected-surface / --app-hover-surface
--app-focus-ring / --app-danger / --app-danger-surface
```

品牌主色保持中性深灰；错误、成功、警告仅用于表达状态且必须同时有文字或图标，不得仅靠颜色传达信息。普通文本对背景保持至少 4.5:1 对比度。

### 字体、尺寸与间距

- 中文界面优先系统字体：`-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`；数字、时间、批次和指标使用等宽数字。
- 正文最小 14px（移动端可读文本优先 16px），行高 1.5–1.75；标题使用 600–700 字重，不使用负字间距。
- 间距只使用 4/8px 节奏：4、8、12、16、24、32、48、64px。
- 触控目标最小 44×44px，控件之间至少 8px 间距；输入框移动端高度不低于 44px。
- 圆角按层级使用 6–16px，避免卡片嵌套卡片；阴影只使用轻量语义层级。

### 组件与状态

- 优先复用 Ant Design、现有 shared UI 与 `@/components/ui` 组件；新增通用交互组件必须先抽象后复用。
- 所有按钮、链接、Tabs、Select、输入控件必须有明确 hover/pressed/disabled/focus-visible 状态，状态变化使用 150–300ms 过渡且不改变布局尺寸。
- 图标统一使用 Lucide 或 Ant Design SVG 图标；图标按钮必须提供 `aria-label`，装饰图标设置 `aria-hidden="true"`。
- 表单使用可见标签、关联控件、邻近错误提示；提交失败保留用户输入并聚焦首个错误字段。
- 抽屉、弹窗和固定操作栏不得遮挡键盘焦点；关闭后恢复触发控件焦点。

### 响应式与无障碍验收

- 必须检查 375px、768px、1024px、1440px，以及窄屏横向布局；长文本可换行，禁止 `word-break: break-all`。
- 页面固定头部/底部需预留安全区和滚动内边距；移动端优先使用 `dvh` 相关高度。
- 支持键盘完整操作、可见焦点环、屏幕阅读器语义、`prefers-reduced-motion: reduce`；不依赖 hover 或颜色完成关键操作。
- 视觉检查需覆盖浅色/深色主题，确保文本、边框、禁用态和选中态均可辨识。
