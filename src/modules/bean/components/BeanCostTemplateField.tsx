import { Select } from '@/shared/components/ui/select';
import type { FieldErrors } from 'react-hook-form';

import type { CostTemplate } from '@/modules/settings/types';
import type { GreenBeanFormInput } from '../types/localGreenBean';
import styles from './BeanForm.module.css';

const joinClassNames = (...classNames: (string | undefined)[]): string => classNames.filter(Boolean).join(' ');
const NO_COST_TEMPLATE_OPTION = '__no_cost_template__';

const renderLabel = (label: string, required = false) => {
  return (
    <span className={styles.labelText}>
      {label}
      {required ? (
        <em aria-hidden="true" className={styles.requiredMark}>
          *
        </em>
      ) : null}
    </span>
  );
};

interface BeanCostTemplateFieldProps {
  errors: FieldErrors<GreenBeanFormInput>;
  autoApplyDefaultCostTemplate: boolean;
  selectedTemplate: CostTemplate | null;
  templateOptions: CostTemplate[];
  templatePreview: {
    errorMessage: string | null;
    values: { defaultSaleUnitPrice: number; defaultSaleUnitWeightGrams: number } | null;
  };
  currentRoastInputGrams: number;
  onTemplateChange: (templateId: string | null) => void;
}

export function BeanCostTemplateField({
  errors,
  autoApplyDefaultCostTemplate,
  selectedTemplate,
  templateOptions,
  templatePreview,
  currentRoastInputGrams,
  onTemplateChange,
}: BeanCostTemplateFieldProps) {
  return (
    <label className={joinClassNames(styles.field, styles.fieldWide)} data-field-path="costTemplate">
      {renderLabel('成本模板')}
      <Select
        aria-label="成本模板"
        onChange={(value: string | undefined) => {
          const nextTemplateId = value === NO_COST_TEMPLATE_OPTION ? null : value ?? null;
          onTemplateChange(nextTemplateId);
        }}
        options={[
          { label: '暂不选择成本模板', value: NO_COST_TEMPLATE_OPTION },
          ...templateOptions.map((template) => ({
            label: template.name,
            value: template.id,
          })),
        ]}
        placeholder="选择一个成本模板"
        showSearch={false}
        value={selectedTemplate?.id ?? NO_COST_TEMPLATE_OPTION}
      />
      <span className={joinClassNames(styles.helpText, errors.costTemplateId ? styles.helpTextError : undefined)}>
        {errors.costTemplateId?.message ??
          (selectedTemplate
            ? '会带入默认单次烘焙量，并根据当前采购重量与总价实时给出参考售价'
            : autoApplyDefaultCostTemplate
              ? '暂无默认模板，可先手工填写售价和规格，之后再补充模板'
              : '可选：用于计算库存预估和销售利润，也可以稍后补充')}
      </span>
      <div className={joinClassNames(styles.linkedHint, styles.inlineHint)}>
        {selectedTemplate ? (
          templatePreview.errorMessage ?? (
            <>
              模板"{selectedTemplate.name}"当前参考值：
              单次烘焙量 {String(currentRoastInputGrams)}g，
              建议单份出售重量 {String(selectedTemplate.saleUnitWeightGrams)}g，
              建议定价 ¥{templatePreview.values?.defaultSaleUnitPrice.toFixed(2) ?? '0.00'}。
            </>
          )
        ) : (
          '选择成本模板后，会生成最终单份出售重量、最终定价与默认单次烘焙量的参考值；没有模板时可手工填写这些字段。'
        )}
      </div>
    </label>
  );
}
