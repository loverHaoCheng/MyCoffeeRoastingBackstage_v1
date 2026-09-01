import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';

import accordionStyles from './SettingsAccordionItem.module.css';
import pageStyles from '../pages/SettingsPage.module.css';

const calculationRules = [
  {
    description: '熟豆出豆量 = 生豆重量 × (1 - 脱水率)。可销售份数 = 熟豆出豆量 ÷ 单份熟豆重量，向下取整；不足一份时无法生成建议售价。单份总成本 = 本锅生豆成本、包装、能耗、人工与其他费用之和 ÷ 可销售份数。建议售价 = 单份总成本 ÷ (1 - 毛利率)。',
    title: '成本模板与建议售价',
  },
  {
    description: '销售烘焙记录收入 = 已售份数 × 本次最终定价；未填写本次最终定价时使用生豆默认单份售价。已收款手工补录收入一并计入，待收款不计入。',
    title: '已实现收入',
  },
  {
    description: '已实现利润 = 销售烘焙记录收入 - 已售出生豆成本 - 成本模板的包装、能耗与其他费用 - 关联邮费。手工补录收入只增加已实现收入，不产生烘焙成本。',
    title: '已实现利润',
  },
  {
    description: '可烘焙锅数 = 剩余生豆重量 ÷ 模板生豆重量，向下取整。库存预估收入 = 可销售份数 × 默认单份售价；预估成本 = 可销售份数 × (模板生豆重量 ÷ 1000 × 生豆成本单价)；预估利润 = 预估收入 - 预估成本 - 模板包装、能耗与其他费用。',
    title: '当前库存预估',
  },
  {
    description: '总支出 = 时间范围内的生豆采购总价 + 已付款手工支出。毛利润 = 已实现收入 - 生豆采购总价 - 已付款包装与邮费；经营利润 = 已实现收入 - 总支出。',
    title: '经营概览',
  },
];

export function FinanceCalculationRulesSection() {
  return (
    <AccordionItem as="section" className={accordionStyles.item} value="finance-calculation-rules">
      <AccordionTrigger
        className={accordionStyles.trigger}
        collapsedAriaLabel="展开"
        expandedAriaLabel="收起"
      >
        <div className={accordionStyles.triggerBody}>
          <div className={accordionStyles.triggerMain}>
            <div className={accordionStyles.titleGroup}>
              <h2 className={accordionStyles.title}>财务计算规则</h2>
            </div>
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className={accordionStyles.content}>
        <div className={pageStyles.informationList}>
          {calculationRules.map((rule) => (
            <article className={pageStyles.informationItem} key={rule.title}>
              <strong>{rule.title}</strong>
              <p>{rule.description}</p>
            </article>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
