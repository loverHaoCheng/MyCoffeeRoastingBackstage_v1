import { Select } from '@/shared/components/ui/select';
import Input from '@/shared/components/ui/input';
import InputNumber from '@/shared/components/ui/input-number';
import AntdSelect from "antd/es/select";
import type { GreenBeanFormInput } from '@/modules/bean/types/localGreenBean';
import { beanFlavorTagTokenSeparators, normalizeFlavorTags } from '@/modules/bean/utils/flavorTags';
import type { CostTemplateSettings } from '@/modules/settings/types';
import type { BeanEditableFieldPath } from './fieldMeta';
import { fieldMeta } from './fieldMeta';

interface RenderFieldControlProps {
  effectiveFieldPath: BeanEditableFieldPath;
  currentDraft: GreenBeanFormInput;
  costTemplateSettings: CostTemplateSettings;
  updateDraft: <K extends BeanEditableFieldPath>(key: K, value: GreenBeanFormInput[K]) => void;
}

export const renderFieldControl = ({
  effectiveFieldPath,
  currentDraft,
  costTemplateSettings,
  updateDraft,
}: RenderFieldControlProps) => {
  const fieldConfig = fieldMeta[effectiveFieldPath];

  if (!fieldConfig) {
    return null;
  }

  switch (effectiveFieldPath) {
    case 'defaultRoastInputGrams':
      return (
        <InputNumber
          min={1}
          onChange={(value) => {
            updateDraft(effectiveFieldPath, value ?? 0);
          }}
          precision={0}
          suffix="g"
          style={{ width: '100%' }}
          value={currentDraft.defaultRoastInputGrams}
        />
      );
    case 'agingDays':
    case 'tastingEndDays':
      return (
        <InputNumber
          min={effectiveFieldPath === 'agingDays' ? 0 : 1}
          onChange={(value) => {
            updateDraft(effectiveFieldPath, value ?? (effectiveFieldPath === 'agingDays' ? 0 : 40));
          }}
          precision={0}
          suffix="天"
          style={{ width: '100%' }}
          value={currentDraft[effectiveFieldPath]}
        />
      );
    case 'defaultSaleUnitPrice':
      return (
        <InputNumber
          min={0.01}
          onChange={(value) => {
            updateDraft(effectiveFieldPath, value ?? 0);
          }}
          precision={2}
          prefix="¥"
          style={{ width: '100%' }}
          value={currentDraft.defaultSaleUnitPrice}
        />
      );
    case 'defaultSaleUnitWeightGrams':
      return (
        <InputNumber
          min={1}
          onChange={(value) => {
            updateDraft(effectiveFieldPath, value ?? null);
          }}
          precision={0}
          suffix="g"
          style={{ width: '100%' }}
          value={currentDraft.defaultSaleUnitWeightGrams ?? null}
        />
      );
    case 'costTemplateId':
      return (
        <Select
          aria-label="成本模板"
          onChange={(value: string | undefined) => {
            if (value) {
              updateDraft(effectiveFieldPath, value);
            }
          }}
          options={costTemplateSettings.templates.map((template) => ({
            label: template.name,
            value: template.id,
          }))}
          placeholder={fieldConfig.placeholder}
          showSearch={false}
          style={{ width: '100%' }}
          value={currentDraft.costTemplateId ?? undefined}
        />
      );
    case 'flavorTags':
      return (
        <AntdSelect
          aria-label="风味"
          mode="tags"
          onChange={(value) => {
            updateDraft(effectiveFieldPath, normalizeFlavorTags(value));
          }}
          open={false}
          placeholder={fieldConfig.placeholder}
          tokenSeparators={beanFlavorTagTokenSeparators}
          value={currentDraft.flavorTags}
        />
      );
    case 'purchasedTotalPrice':
      return (
        <InputNumber
          min={0.01}
          onChange={(value) => {
            updateDraft(effectiveFieldPath, value ?? 0);
          }}
          precision={2}
          prefix="¥"
          style={{ width: '100%' }}
          value={currentDraft.purchasedTotalPrice}
        />
      );
    case 'purchasedWeightGrams':
    case 'remainingWeightGrams':
      return (
        <InputNumber
          min={0}
          onChange={(value) => {
            updateDraft(effectiveFieldPath, value ?? 0);
          }}
          precision={0}
          suffix="g"
          style={{ width: '100%' }}
          value={currentDraft[effectiveFieldPath]}
        />
      );
    case 'altitudeMetersMax':
    case 'altitudeMetersMin':
      return (
        <InputNumber
          min={0}
          onChange={(value) => {
            updateDraft(effectiveFieldPath, value ?? null);
          }}
          precision={0}
          suffix="m"
          style={{ width: '100%' }}
          value={currentDraft[effectiveFieldPath] ?? null}
        />
      );
    case 'densityGPerL':
      return (
        <InputNumber
          min={0}
          onChange={(value) => {
            updateDraft(effectiveFieldPath, value ?? null);
          }}
          precision={0}
          suffix="g/L"
          style={{ width: '100%' }}
          value={currentDraft.densityGPerL ?? null}
        />
      );
    case 'moisturePercent':
      return (
        <InputNumber
          min={0}
          onChange={(value) => {
            updateDraft(effectiveFieldPath, value ?? null);
          }}
          precision={2}
          suffix="%"
          style={{ width: '100%' }}
          value={currentDraft.moisturePercent ?? null}
        />
      );
    case 'notes':
      return (
        <Input.TextArea
          autoSize={{ minRows: 3, maxRows: 8 }}
          onChange={(event) => {
            updateDraft(effectiveFieldPath, event.target.value as GreenBeanFormInput[typeof effectiveFieldPath]);
          }}
          placeholder={fieldConfig.placeholder}
          value={currentDraft.notes ?? ''}
        />
      );
    default:
      return (
        <Input
          onChange={(event) => {
            updateDraft(effectiveFieldPath, event.target.value as GreenBeanFormInput[typeof effectiveFieldPath]);
          }}
          placeholder={fieldConfig.placeholder}
          value={currentDraft[effectiveFieldPath] ?? ''}
        />
      );
  }
};
