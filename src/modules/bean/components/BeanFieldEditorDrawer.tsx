import { App } from 'antd';
import { Select } from '@/components/ui/select';
import Input from '@/shared/components/ui/input';
import InputNumber from '@/shared/components/ui/input-number';
import AntdSelect from "antd/es/select";
import { useQuery } from '@tanstack/react-query';
import { type FieldPath } from 'react-hook-form';
import { useEffect, useMemo, useRef, useState } from 'react';

import { beanEditableDetailQueryKeys } from '@/modules/bean/hooks';
import { useUpdateBean } from '@/modules/bean/hooks/useBeans';
import { beanService } from '@/modules/bean/services';
import { greenBeanCreateFormSchema } from '@/modules/bean/schemas';
import type { GreenBeanFormInput } from '@/modules/bean/types/localGreenBean';
import {
  beanFlavorTagMaxCount,
  beanFlavorTagTokenSeparators,
  normalizeFlavorTags,
} from '@/modules/bean/utils/flavorTags';
import { normalizeAgingDays, normalizeTastingEndDays } from '@/modules/bean/utils/postProcessDays';
import { useCostTemplateSettings } from '@/modules/settings/hooks';
import { FieldEditorDrawer } from '@/shared/components/FieldEditorDrawer';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';
import type { Bean } from '@/types/domain';

type BeanEditableFieldPath =
  | 'code'
  | 'altitudeMetersMax'
  | 'altitudeMetersMin'
  | 'agingDays'
  | 'costTemplateId'
  | 'defaultRoastInputGrams'
  | 'defaultSaleUnitPrice'
  | 'defaultSaleUnitWeightGrams'
  | 'densityGPerL'
  | 'flavorTags'
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
  | 'tastingEndDays'
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
  agingDays: { label: '养豆时间', placeholder: '例如 14' },
  code: { label: '生豆编号', placeholder: '例如 GB-2026-001' },
  costTemplateId: { label: '成本模板', placeholder: '选择一个成本模板' },
  defaultRoastInputGrams: { label: '默认烘焙量', placeholder: '例如 200' },
  defaultSaleUnitPrice: { label: '默认单份售价', placeholder: '例如 48' },
  defaultSaleUnitWeightGrams: { label: '默认单份重量', placeholder: '例如 250' },
  densityGPerL: { label: '密度', placeholder: '例如 680' },
  flavorTags: { label: '风味', placeholder: '输入后按回车生成标签，也支持逗号分隔' },
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
  tastingEndDays: { label: '赏味结束期', placeholder: '例如 40' },
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
    agingDays: normalizeAgingDays(bean.agingDays),
    code: bean.code ?? '',
    costTemplateId: bean.costTemplateId ?? null,
    defaultRoastInputGrams: bean.defaultRoastInputGrams ?? 0,
    defaultSaleUnitPrice: bean.defaultSaleUnitPrice ?? 0,
    defaultSaleUnitWeightGrams: bean.defaultSaleUnitWeightGrams ?? null,
    densityGPerL: bean.densityGPerL ?? null,
    displayName: bean.name,
    flavorTags: normalizeFlavorTags(bean.flavorTags),
    grade: bean.grade,
    harvestSeason: bean.harvestSeason ?? '',
    millName: bean.millName ?? '',
    moisturePercent: bean.moisturePercent ?? null,
    notes: bean.notes ?? '',
    originArea: bean.originArea ?? '',
    originCountry: bean.originCountry?.trim() ? bean.originCountry : parseOriginCountry(bean.origin),
    originRegion: bean.originRegion ?? '',
    processMethod: bean.process,
    purchaseDate: bean.purchaseDate ?? bean.createdAt.slice(0, 10),
    purchasedTotalPrice: totalPurchasedPrice,
    purchasedWeightGrams,
    remainingWeightGrams,
    supplierName: bean.supplierName ?? '',
    tastingEndDays: normalizeTastingEndDays(bean.tastingEndDays, bean.agingDays),
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
  const [lastOpenContext, setLastOpenContext] = useState<{
    bean: Bean;
    fieldPath: BeanEditableFieldPath;
  } | null>(null);

  useEffect(() => {
    if (open && bean != null && editableFieldPath != null) {
      setLastOpenContext({
        bean,
        fieldPath: editableFieldPath,
      });
    }
  }, [bean, editableFieldPath, open]);

  const effectiveBean = open && bean != null ? bean : lastOpenContext?.bean ?? null;
  const effectiveFieldPath = open && editableFieldPath != null ? editableFieldPath : lastOpenContext?.fieldPath;
  const fieldConfig = effectiveFieldPath ? fieldMeta[effectiveFieldPath] : undefined;
  const fallbackDraft = useMemo(() => (effectiveBean ? createFallbackEditableDetail(effectiveBean) : null), [effectiveBean]);
  const editableDetailQuery = useQuery({
    enabled: open && effectiveBean != null && effectiveFieldPath != null,
    initialData: fallbackDraft ?? undefined,
    queryFn: async () => {
      if (!effectiveBean) {
        throw new Error('缺少生豆信息');
      }

      const response = await beanService.getEditableBean(effectiveBean.id);

      return response.data;
    },
    queryKey: effectiveBean == null ? beanEditableDetailQueryKeys.all : beanEditableDetailQueryKeys.detail(effectiveBean.id),
  });
  const [draft, setDraft] = useState<GreenBeanFormInput | null>(fallbackDraft);
  const hasUserEditedRef = useRef(false);
  const sessionKey = String(effectiveBean?.id ?? '') + ':' + (effectiveFieldPath ?? '');
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

  if (effectiveBean == null || effectiveFieldPath == null || currentDraft == null) {
    return null;
  }

  const handleSubmit = () => {
    const normalizedDraft: GreenBeanFormInput = {
      ...currentDraft,
      agingDays: normalizeAgingDays(currentDraft.agingDays),
      tastingEndDays: normalizeTastingEndDays(currentDraft.tastingEndDays, currentDraft.agingDays),
    };
    const parsed = greenBeanCreateFormSchema.safeParse(normalizedDraft);

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
    submissionBackupService.save('update', { beanId: effectiveBean.id, input: parsed.data }, 'bean');

    const updateTask = updateBeanMutation.mutateAsync({ beanId: effectiveBean.id, input: parsed.data }).catch(
      (error: unknown) => {
        void message.error(getUserFacingErrorMessage(error, '生豆同步失败，本地备份已保留，请检查后重试。'));
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
            allowClear
            aria-label="成本模板"
            onChange={(value: string | undefined) => {
              updateDraft(effectiveFieldPath, value ?? null);
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
          {editableFieldPath === 'flavorTags' ? (
            <span style={{ color: 'var(--app-text-secondary)', fontSize: '12px' }}>
              最多 {String(beanFlavorTagMaxCount)} 个标签
            </span>
          ) : null}
        </label>
      </section>
    </FieldEditorDrawer>
  );
}
