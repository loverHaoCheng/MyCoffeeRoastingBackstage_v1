import { App, Input, InputNumber, Select } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { type FieldPath } from 'react-hook-form';
import { useEffect, useMemo, useRef, useState } from 'react';

import { beanEditableDetailQueryKeys } from '@/modules/bean/hooks';
import { useUpdateBean } from '@/modules/bean/hooks/useBeans';
import { beanService } from '@/modules/bean/services';
import { greenBeanCreateFormSchema } from '@/modules/bean/schemas';
import type { GreenBeanFormInput } from '@/modules/bean/types/localGreenBean';
import { useCostTemplateSettings } from '@/modules/settings/hooks';
import { FieldEditorDrawer } from '@/shared/components/FieldEditorDrawer';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';
import type { Bean } from '@/types/domain';

type BeanEditableFieldPath =
  | 'code'
  | 'altitudeMetersMax'
  | 'altitudeMetersMin'
  | 'costTemplateId'
  | 'defaultRoastInputGrams'
  | 'defaultSaleUnitPrice'
  | 'defaultSaleUnitWeightGrams'
  | 'densityGPerL'
  | 'grade'
  | 'harvestSeason'
  | 'millName'
  | 'moisturePercent'
  | 'notes'
  | 'originArea'
  | 'originCountry'
  | 'originRegion'
  | 'processMethod'
  | 'purchasedTotalPrice'
  | 'purchasedWeightGrams'
  | 'remainingWeightGrams'
  | 'supplierName'
  | 'variety';

interface BeanFieldEditorDrawerProps {
  bean: Bean | null;
  fieldPath?: FieldPath<GreenBeanFormInput>;
  onClose: () => void;
  open: boolean;
  placement?: 'bottom' | 'right';
  width?: number;
  height?: string;
}

const fieldMeta: Record<
  BeanEditableFieldPath,
  {
    label: string;
    placeholder: string;
  }
> = {
  altitudeMetersMax: { label: '海拔上限', placeholder: '例如 2200' },
  altitudeMetersMin: { label: '海拔下限', placeholder: '例如 1800' },
  code: { label: '生豆编号', placeholder: '例如 GB-2026-001' },
  costTemplateId: { label: '成本模板', placeholder: '选择一个成本模板' },
  defaultRoastInputGrams: { label: '默认烘焙量', placeholder: '例如 200' },
  defaultSaleUnitPrice: { label: '默认单份售价', placeholder: '例如 48' },
  defaultSaleUnitWeightGrams: { label: '默认单份重量', placeholder: '例如 250' },
  densityGPerL: { label: '密度', placeholder: '例如 680' },
  grade: { label: '等级', placeholder: '例如 G1 / SHB / AA' },
  harvestSeason: { label: '产季', placeholder: '例如 2025/26' },
  millName: { label: '处理厂', placeholder: '例如 某某处理厂' },
  moisturePercent: { label: '含水率', placeholder: '例如 10.5' },
  notes: { label: '备注', placeholder: '填写补充说明' },
  originArea: { label: '产地小产区', placeholder: '例如 艾瑞莎' },
  originCountry: { label: '产地', placeholder: '例如 埃塞俄比亚' },
  originRegion: { label: '产区', placeholder: '例如 古吉' },
  processMethod: { label: '处理法', placeholder: '例如 水洗 / 日晒 / 厌氧' },
  purchasedTotalPrice: { label: '购买总价', placeholder: '例如 1280' },
  purchasedWeightGrams: { label: '购买总重', placeholder: '例如 1000' },
  remainingWeightGrams: { label: '剩余重量', placeholder: '例如 9600' },
  supplierName: { label: '供应商', placeholder: '例如 Nordic Approach' },
  variety: { label: '豆种', placeholder: '例如 Heirloom / SL28 SL34' },
};

const parseOriginCountry = (origin: string): string => {
  const trimmed = origin.trim();

  if (!trimmed) {
    return '';
  }

  const [firstPart] = trimmed.split(/[·,，/|]/).map((part) => part.trim()).filter(Boolean);

  return firstPart ?? trimmed;
};

const createFallbackEditableDetail = (bean: Bean): GreenBeanFormInput => {
  const purchasedWeightGrams = Math.max(0, Math.round(bean.purchasedWeightGrams ?? bean.stockKg * 1000));
  const remainingWeightGrams = Math.max(0, Math.round(bean.remainingWeightGrams ?? bean.stockKg * 1000));
  const totalPurchasedPrice = Math.max(
    0,
    Number((bean.purchasedTotalPrice ?? bean.costPerKg * (purchasedWeightGrams / 1000)).toFixed(2)),
  );

  return {
    altitudeMetersMax: bean.altitudeMetersMax ?? null,
    altitudeMetersMin: bean.altitudeMetersMin ?? null,
    code: bean.code ?? '',
    costTemplateId: bean.costTemplateId ?? null,
    defaultRoastInputGrams: bean.defaultRoastInputGrams ?? 0,
    defaultSaleUnitPrice: bean.defaultSaleUnitPrice ?? 0,
    defaultSaleUnitWeightGrams: bean.defaultSaleUnitWeightGrams ?? null,
    densityGPerL: bean.densityGPerL ?? null,
    displayName: bean.name,
    grade: bean.grade,
    harvestSeason: bean.harvestSeason ?? '',
    millName: bean.millName ?? '',
    moisturePercent: bean.moisturePercent ?? null,
    notes: bean.notes ?? '',
    originArea: bean.originArea ?? '',
    originCountry: bean.originCountry?.trim() ? bean.originCountry : parseOriginCountry(bean.origin),
    originRegion: bean.originRegion ?? '',
    processMethod: bean.process,
    purchasedTotalPrice: totalPurchasedPrice,
    purchasedWeightGrams,
    remainingWeightGrams,
    supplierName: bean.supplierName ?? '',
    variety: bean.variety ?? '',
  };
};

export function BeanFieldEditorDrawer({
  bean,
  fieldPath,
  height,
  onClose,
  open,
  placement,
  width,
}: BeanFieldEditorDrawerProps) {
  const { message } = App.useApp();
  const updateBeanMutation = useUpdateBean();
  const { costTemplateSettings } = useCostTemplateSettings();
  const editableFieldPath = fieldPath as BeanEditableFieldPath | undefined;
  const fieldConfig = editableFieldPath ? fieldMeta[editableFieldPath] : undefined;
  const fallbackDraft = useMemo(() => (bean ? createFallbackEditableDetail(bean) : null), [bean]);
  const editableDetailQuery = useQuery({
    enabled: open && bean != null && editableFieldPath != null,
    initialData: fallbackDraft ?? undefined,
    queryFn: async () => {
      if (!bean) {
        throw new Error('缺少生豆信息');
      }

      const response = await beanService.getEditableBean(bean.id);

      return response.data;
    },
    queryKey: bean == null ? beanEditableDetailQueryKeys.all : beanEditableDetailQueryKeys.detail(bean.id),
  });
  const [draft, setDraft] = useState<GreenBeanFormInput | null>(fallbackDraft);
  const hasUserEditedRef = useRef(false);
  const sessionKey = String(bean?.id ?? '') + ':' + (editableFieldPath ?? '');
  const currentDraft = draft ?? fallbackDraft;

  useEffect(() => {
    hasUserEditedRef.current = false;
    setDraft(editableDetailQuery.data ?? fallbackDraft);
  }, [editableDetailQuery.data, fallbackDraft, sessionKey]);

  useEffect(() => {
    if (hasUserEditedRef.current || !editableDetailQuery.data) {
      return;
    }

    setDraft(editableDetailQuery.data);
  }, [editableDetailQuery.data]);

  const fieldLabel = fieldConfig?.label ?? '修改信息';

  if (!open || bean == null || editableFieldPath == null || currentDraft == null) {
    return null;
  }

  const handleSubmit = () => {
    const parsed = greenBeanCreateFormSchema.safeParse(currentDraft);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      void message.error(firstIssue?.message ?? '保存失败，请检查输入');
      if (firstIssue?.path.length) {
        window.requestAnimationFrame(() => {
          const fieldName = firstIssue.path.join('.');
          const target = document.querySelector<HTMLElement>(`[data-field-path="${fieldName}"]`);
          target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
      return;
    }

    onClose();
    submissionBackupService.save('update', { beanId: bean.id, input: parsed.data }, 'bean');

    const updateTask = updateBeanMutation.mutateAsync({ beanId: bean.id, input: parsed.data }).catch(
      (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : '生豆同步失败，本地已备份。';
        void message.error(errorMessage);
      },
    );

    void updateTask;
  };

  const updateDraft = <K extends BeanEditableFieldPath>(key: K, value: GreenBeanFormInput[K]) => {
    hasUserEditedRef.current = true;
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const nextDraft: GreenBeanFormInput = { ...current };
      nextDraft[key] = value;

      return nextDraft;
    });
  };

  const renderFieldControl = () => {
    if (!fieldConfig) {
      return null;
    }

    switch (editableFieldPath) {
      case 'defaultRoastInputGrams':
        return (
          <InputNumber
            min={1}
            onChange={(value) => {
              updateDraft(editableFieldPath, value ?? 0);
            }}
            precision={0}
            suffix="g"
            style={{ width: '100%' }}
            value={currentDraft.defaultRoastInputGrams}
          />
        );
      case 'defaultSaleUnitPrice':
        return (
          <InputNumber
            min={0.01}
            onChange={(value) => {
              updateDraft(editableFieldPath, value ?? 0);
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
              updateDraft(editableFieldPath, value ?? null);
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
            allowClear
            aria-label="成本模板"
            onChange={(value: string | undefined) => {
              updateDraft(editableFieldPath, value ?? null);
            }}
            options={costTemplateSettings.templates.map((template) => ({
              label: template.name,
              value: template.id,
            }))}
            placeholder={fieldConfig.placeholder}
            style={{ width: '100%' }}
            value={currentDraft.costTemplateId ?? undefined}
          />
        );
      case 'purchasedTotalPrice':
        return (
          <InputNumber
            min={0.01}
            onChange={(value) => {
              updateDraft(editableFieldPath, value ?? 0);
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
              updateDraft(editableFieldPath, value ?? 0);
            }}
            precision={0}
            suffix="g"
            style={{ width: '100%' }}
            value={currentDraft[editableFieldPath]}
          />
        );
      case 'altitudeMetersMax':
      case 'altitudeMetersMin':
        return (
          <InputNumber
            min={0}
            onChange={(value) => {
              updateDraft(editableFieldPath, value ?? null);
            }}
            precision={0}
            suffix="m"
            style={{ width: '100%' }}
            value={currentDraft[editableFieldPath] ?? null}
          />
        );
      case 'densityGPerL':
        return (
          <InputNumber
            min={0}
            onChange={(value) => {
              updateDraft(editableFieldPath, value ?? null);
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
              updateDraft(editableFieldPath, value ?? null);
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
              updateDraft(editableFieldPath, event.target.value as GreenBeanFormInput[typeof editableFieldPath]);
            }}
            placeholder={fieldConfig.placeholder}
            value={currentDraft.notes ?? ''}
          />
        );
      default:
        return (
          <Input
            onChange={(event) => {
              updateDraft(editableFieldPath, event.target.value as GreenBeanFormInput[typeof editableFieldPath]);
            }}
            placeholder={fieldConfig.placeholder}
            value={currentDraft[editableFieldPath] ?? ''}
          />
        );
    }
  };

  return (
    <FieldEditorDrawer
      height={height}
      loadingLabel="保存中"
      onClose={onClose}
      onSubmit={handleSubmit}
      open={open}
      placement={placement}
      submitLabel={`保存${fieldLabel}`}
      title={`修改${fieldLabel}`}
      width={width}
    >
      <section style={{ display: 'grid', gap: '10px', padding: 0 }}>
        <label style={{ display: 'grid', gap: '6px' }}>
          <span style={{ color: 'var(--app-text-secondary)', fontSize: '12px', fontWeight: 700 }}>{fieldLabel}</span>
          {renderFieldControl()}
        </label>
      </section>
    </FieldEditorDrawer>
  );
}
