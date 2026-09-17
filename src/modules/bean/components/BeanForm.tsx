import { type FieldPath } from 'react-hook-form';

import type { GreenBeanFormInput } from '../types/localGreenBean';
import { useBeanFormSetup } from './BeanForm/useBeanFormSetup';
import { useBeanFormSubmit } from './BeanForm/useBeanFormSubmit';
import { BeanPurchasingSection } from './BeanForm/BeanPurchasingSection';
import styles from './BeanForm.module.css';
import { BeanFormActions } from './BeanFormActions';
import { BeanIdentitySection } from './BeanIdentitySection';
import { BeanNotesSection } from './BeanNotesSection';
import { BeanPostRoastSection } from './BeanPostRoastSection';
import { BeanQualitySection } from './BeanQualitySection';

interface BeanFormProps {
  autoApplyDefaultCostTemplate?: boolean;
  enableCostTemplateSelection?: boolean;
  focusFieldPath?: FieldPath<GreenBeanFormInput>;
  initialValues: GreenBeanFormInput;
  formId?: string;
  showBottomActions?: boolean;
  onCancel?: () => void;
  onSubmit: (input: GreenBeanFormInput) => Promise<void> | void;
  resetOnSubmit?: boolean;
  submitLabel: string;
}

const getErrorMessage = (message: string | undefined, fallback: string): string => message ?? fallback;

export function BeanForm({
  autoApplyDefaultCostTemplate = false,
  enableCostTemplateSelection = false,
  focusFieldPath,
  initialValues,
  onCancel,
  onSubmit,
  resetOnSubmit = false,
  formId,
  showBottomActions = true,
  submitLabel,
}: BeanFormProps) {
  const {
    control,
    errors,
    handleSubmit,
    reset,
    clearErrors,
    setError,
    setFocus,
    costTemplateSettings,
    currentRoastInputGrams,
    selectedTemplate,
    templatePreview,
    handleTemplateChange,
    handleSaleWeightChange,
    handleSalePriceChange,
  } = useBeanFormSetup({
    initialValues,
    focusFieldPath,
    autoApplyDefaultCostTemplate,
    enableCostTemplateSelection,
  });

  const submitForm = useBeanFormSubmit({
    clearErrors,
    setError,
    setFocus,
    templatePreview,
    onSubmit,
  });

  const handleFormSubmit = async (values: GreenBeanFormInput) => {
    await submitForm(values);
    if (resetOnSubmit) {
      reset(initialValues);
    }
  };

  const formatOptionalHelp = (message: string | undefined, fallback: string): string => {
    return getErrorMessage(message, `${fallback}，可稍后补充`);
  };

  return (
    <form
      className={styles.form}
      id={formId}
      onSubmit={handleSubmit((values) => {
        void handleFormSubmit(values);
      })}
    >
      <BeanIdentitySection control={control} errors={errors} optionalHelp={formatOptionalHelp} />
      <BeanPostRoastSection control={control} errors={errors} />
      <BeanQualitySection control={control} errors={errors} optionalHelp={formatOptionalHelp} />

      <BeanPurchasingSection
        autoApplyDefaultCostTemplate={autoApplyDefaultCostTemplate}
        control={control}
        currentRoastInputGrams={currentRoastInputGrams}
        enableCostTemplateSelection={enableCostTemplateSelection}
        errors={errors}
        selectedTemplate={selectedTemplate}
        templateOptions={costTemplateSettings.templates}
        templatePreview={templatePreview}
        onSalePriceChange={handleSalePriceChange}
        onSaleWeightChange={handleSaleWeightChange}
        onTemplateChange={handleTemplateChange}
      />

      <BeanNotesSection control={control} errors={errors} />

      {showBottomActions ? <BeanFormActions formId={formId} onCancel={onCancel} submitLabel={submitLabel} /> : null}
    </form>
  );
}
