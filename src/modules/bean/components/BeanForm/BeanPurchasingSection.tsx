import type { Control, FieldErrors } from 'react-hook-form';

import type { CostTemplate } from '@/modules/settings/types';
import type { GreenBeanFormInput } from '../../types/localGreenBean';
import { BeanCostTemplateField } from '../BeanCostTemplateField';
import { BeanPricingFields } from '../BeanPricingFields';
import { BeanPurchasingFields } from '../BeanPurchasingFields';
import styles from '../BeanForm.module.css';

interface BeanPurchasingSectionProps {
  control: Control<GreenBeanFormInput>;
  errors: FieldErrors<GreenBeanFormInput>;
  enableCostTemplateSelection: boolean;
  autoApplyDefaultCostTemplate: boolean;
  currentRoastInputGrams: number;
  selectedTemplate: CostTemplate | null;
  templateOptions: CostTemplate[];
  templatePreview: {
    errorMessage: string | null;
    values: { defaultSaleUnitPrice: number; defaultSaleUnitWeightGrams: number } | null;
  };
  onTemplateChange: (templateId: string | null) => void;
  onSaleWeightChange: (value: number | null) => void;
  onSalePriceChange: (value: number) => void;
}

export function BeanPurchasingSection({
  control,
  errors,
  enableCostTemplateSelection,
  autoApplyDefaultCostTemplate,
  currentRoastInputGrams,
  selectedTemplate,
  templateOptions,
  templatePreview,
  onTemplateChange,
  onSaleWeightChange,
  onSalePriceChange,
}: BeanPurchasingSectionProps) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <h3>采购与定价</h3>
        <p>这些字段会直接参与库存、成本和未来利润分析。</p>
      </header>
      <div className={styles.fieldGrid}>
        {enableCostTemplateSelection ? (
          <BeanCostTemplateField
            autoApplyDefaultCostTemplate={autoApplyDefaultCostTemplate}
            currentRoastInputGrams={currentRoastInputGrams}
            errors={errors}
            selectedTemplate={selectedTemplate}
            templateOptions={templateOptions}
            templatePreview={templatePreview}
            onTemplateChange={onTemplateChange}
          />
        ) : null}

        <BeanPurchasingFields control={control} errors={errors} />

        <BeanPricingFields
          control={control}
          errors={errors}
          selectedTemplate={selectedTemplate}
          templatePreview={templatePreview}
          onWeightChange={onSaleWeightChange}
          onPriceChange={onSalePriceChange}
        />
      </div>
    </section>
  );
}
