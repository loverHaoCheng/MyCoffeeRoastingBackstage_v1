import type { DriveStep } from 'driver.js';

export interface PageGuideDefinition {
  title: string;
  steps: DriveStep[];
}

const step = (element: string, title: string, description: string): DriveStep => ({
  element,
  popover: { title, description },
});

export const pageGuideDefinitions: Record<string, PageGuideDefinition> = {
  '/login': { title: '登录引导', steps: [step('main', '登录 EasyBake', '输入已验证的账号信息进入烘焙运营后台。'), step('form', '填写账号', '邮箱和密码用于恢复你的业务数据与设置。')] },
  '/register': { title: '注册引导', steps: [step('main', '创建账号', '注册后可保存生豆、烘焙、生产和财务数据。'), step('form', '完成验证', '提交后请按邮件提示完成验证，再返回登录。')] },
  '/forgot-password': { title: '找回密码引导', steps: [step('main', '找回密码', '输入注册邮箱获取密码重置邮件。'), step('form', '提交邮箱', '请使用当前账号邮箱，并按邮件中的链接继续操作。')] },
  '/verify-email': { title: '邮箱验证引导', steps: [step('main', '验证邮箱', '验证成功后返回登录即可进入系统。')] },
  '/reset-password': { title: '重置密码引导', steps: [step('main', '重置密码', '设置新的登录密码并确认两次输入一致。'), step('form', '提交新密码', '完成后返回登录页使用新密码登录。')] },
  '/terms': { title: '用户协议引导', steps: [step('main', '用户协议', '阅读服务规则与使用边界，页面支持纵向滚动。'), step('[aria-label="法律文档"]', '切换文档', '顶部导航可以切换用户协议、隐私政策和数据删除机制。')] },
  '/privacy': { title: '隐私政策引导', steps: [step('main', '隐私政策', '阅读数据收集、使用与保护说明。'), step('[aria-label="法律文档"]', '切换文档', '顶部导航可以切换其他合规文档。')] },
  '/data-deletion': { title: '数据删除引导', steps: [step('main', '数据删除机制', '阅读账号和业务数据的删除方式与影响。'), step('[aria-label="法律文档"]', '切换文档', '顶部导航可以切换其他合规文档。')] },
  '/beans': {
    title: '生豆库存引导',
    steps: [
      step('main', '生豆库存', '这里集中管理采购来的生豆批次、剩余库存和单公斤成本。'),
      step('[aria-label="搜索生豆"]', '搜索与筛选', '输入名称、产地、处理法或风味关键词；右侧筛选按钮可以按产地、处理法和排序条件缩小结果。'),
      step('[aria-label="生豆库存概览"]', '库存概览', '总剩余库存帮助你判断可用库存，均价用于快速估算当前库存成本。'),
      step('[aria-label="有库存生豆列表"]', '批次卡片', '点击卡片可以查看详情；使用卡片内的编辑、补货或删除操作维护单个批次。'),
      step('[aria-label="新增生豆"]', '新增生豆', '从这里选择手动录入或图片识别，创建新的生豆批次。'),
    ],
  },
  '/roasts/plan': {
    title: '烘焙计划引导',
    steps: [
      step('main', '烘焙计划', '烘焙前先建立计划，记录生豆、目标烘焙度、用途和批次参数。'),
      step('[aria-label="搜索烘焙计划"]', '搜索与筛选', '按名称、生豆或目标烘焙度搜索，并使用筛选按钮组合条件。'),
      step('[aria-label="烘焙计划列表"]', '计划列表', '点击计划卡片查看完整步骤；编辑可调整字段或烘焙曲线，删除会要求确认。'),
      step('[aria-label="新增烘焙计划"]', '新建计划', '支持手动创建，也支持导入 JSON 计划，适合复用外部记录。'),
    ],
  },
  '/roasts/history': {
    title: '烘焙历史引导',
    steps: [
      step('main', '烘焙历史', '这里记录实际完成的烘焙批次，是复盘、库存扣减和成本分析的基础。'),
      step('[aria-label="搜索烘焙记录"]', '搜索与筛选', '按熟豆、生豆、烘焙度或备注搜索；筛选按钮可进一步按销售状态过滤。'),
      step('[aria-label="烘焙历史列表"]', '历史卡片', '打开卡片查看批次详情、编辑实际数据，或进入关联的 AI 复盘对话。'),
      step('[aria-label="新增烘焙记录"]', '新增记录', '录入实际投入、产出、烘焙日期和销售设置，保存后会同步更新相关库存。'),
    ],
  },
  '/roast-assistant': {
    title: 'AI 烘焙助手引导',
    steps: [
      step('main', 'AI 烘焙助手', 'AI 助手用于知识问答、烘焙计划建议和历史批次复盘，最终决策仍由你确认。'),
      step('[aria-label="选择对话模式"]', '选择上下文', '选择复盘或计划模式，再关联生豆或烘焙历史，回答会更贴合当前批次。'),
      step('[aria-label="AI 对话输入框"]', '输入问题', '描述你想分析的烘焙现象、计划或曲线，再发送消息。'),
      step('[aria-label="发送问题"]', '发送与复用', '发送后等待回答；生成的计划草稿可以继续调整并回填到烘焙计划。'),
    ],
  },
  '/finance': {
    title: '财务引导',
    steps: [
      step('main', '经营总览', '财务页把采购、烘焙、收入与支出放在同一时间范围内，帮助你判断经营结果。'),
      step('[aria-label="财务时间筛选"]', '时间范围', '切换时间范围查看对应周期的收入、支出、成本和利润。'),
      step('[aria-label="利润计算说明"]', '计算说明', '这里解释指标如何由库存成本、销售记录和财务流水计算得到。'),
      step('[aria-label="新增财务动作"]', '新增财务记录', '从这里选择新增支出、收入或成本模板，保持财务记录结构统一。'),
    ],
  },
  '/settings': {
    title: '设置引导',
    steps: [
      step('main', '设置', '设置页集中管理数据连接、界面偏好、备份恢复和账号操作。'),
      step('form[aria-label="设置表单"]', '熟豆库与界面设置', '配置熟豆库连接、主题和字号比例，修改会立即应用到当前设备。'),
      step('[aria-label="数据备份"]', '备份与恢复', '导出备份文件用于迁移或留档；导入前选择合并或覆盖策略。'),
      step('[aria-label="注销账号"]', '账号操作', '注销账号会永久删除账号及关联业务数据，请仅在确认不再使用时操作。'),
    ],
  },
};
