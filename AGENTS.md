# **React 企业级项目工程规范**

Version: 1.0

>

Last Updated: 2026-06-26

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
5.如果按本文件为前提执行，则回答中句首包含“（本回答以最新的 AGENTS 为前提）“
6.对功能及逻辑等修改时，可以参照交互文档进行定位。当修改完成或新建功能逻辑时对交互文档做对应的修改。
```
