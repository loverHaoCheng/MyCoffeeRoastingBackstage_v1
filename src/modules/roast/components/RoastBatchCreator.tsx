import CoffeeOutlined from "@ant-design/icons/CoffeeOutlined";
import DownloadOutlined from '@ant-design/icons/DownloadOutlined';
import { App } from 'antd';
import { useMemo, useState } from 'react';

import { useBeans } from '@/modules/bean/hooks';
import { useImportHiBeanRoastCurve, useRoastPlans, useUpdateRoastBatch } from '@/modules/roast/hooks';
import type { RoastBatchCreateInput } from '@/modules/roast/types/roastBatch';
import type { RoastCurveRecord } from '@/modules/roast/types/roastCurve';
import { parseHibeanRoastCurveJson } from '@/modules/roast/services/roastCurve.service';
import { toRoastBatchCurveSummaryInput } from '@/modules/roast/utils/roastCurveSummary';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import {
  RoastBatchForm,
  type RoastBatchFormState,
  type RoastBatchFormSubmitValue,
} from './RoastBatchForm';
import { createDefaultRoastBatchFormState } from './RoastBatchForm.state';
import { RoastCurveAttachmentPanel } from './RoastCurveAttachmentPanel';

type RoastBatchCreateResult = { id: string } | undefined;

interface RoastBatchCreatorProps {
  onCancel?: () => void;
  onCreate: (input: RoastBatchCreateInput) => Promise<RoastBatchCreateResult> | RoastBatchCreateResult;
}

interface PendingCurveImport {
  fileName: string;
  jsonText: string;
  preview: RoastCurveRecord;
}

const previewRoastBatchId = 'preview';

export function RoastBatchCreator({ onCancel, onCreate }: RoastBatchCreatorProps) {
  const { message } = App.useApp();
  const { data: beans = [] } = useBeans();
  const { data: plans = [] } = useRoastPlans();
  const importCurveMutation = useImportHiBeanRoastCurve();
  const updateBatchMutation = useUpdateRoastBatch();
  const roastableBeans = useMemo(
    () => beans.filter((bean) => (bean.remainingWeightGrams ?? bean.stockKg * 1000) > 0),
    [beans],
  );
  const hasBeanOptions = roastableBeans.length > 0;

  const [form, setForm] = useState<RoastBatchFormState>(() => createDefaultRoastBatchFormState());
  const [pendingCurve, setPendingCurve] = useState<PendingCurveImport | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCurveFile = (file: File) => {
    const readFile = async () => {
      try {
        const jsonText = await file.text();
        const parsed = parseHibeanRoastCurveJson(jsonText, previewRoastBatchId, file.name);
        const preview: RoastCurveRecord = {
          ...parsed,
          id: '保存后生成',
        };
        const summaryInput = toRoastBatchCurveSummaryInput(preview.metrics);

        setPendingCurve({
          fileName: file.name,
          jsonText,
          preview,
        });
        setForm((current) => ({
          ...current,
          developmentRatio: summaryInput.developmentRatio ?? current.developmentRatio,
          firstCrackTime: summaryInput.firstCrackTime ?? current.firstCrackTime,
          totalRoastTime: summaryInput.totalRoastTime ?? current.totalRoastTime,
        }));
        void message.success('HiBean JSON 已读取，保存烘焙记录后会自动绑定曲线。');
      } catch (error: unknown) {
        void message.error(getUserFacingErrorMessage(error, 'HiBean JSON 读取失败，请检查文件内容。'));
      }
    };

    void readFile();
  };

  const handleSubmit = (submitValue: RoastBatchFormSubmitValue) => {
    const createInput: RoastBatchCreateInput = {
      ...submitValue,
      imageUrls: [],
    };
    const submitTask = async () => {
      setIsSubmitting(true);

      try {
        const createdBatch = await onCreate(createInput);

        if (pendingCurve && createdBatch?.id) {
          const importResult = await importCurveMutation.mutateAsync({
            fileName: pendingCurve.fileName,
            jsonText: pendingCurve.jsonText,
            roastBatchId: createdBatch.id,
          });
          const summaryInput = toRoastBatchCurveSummaryInput(importResult.record.metrics);

          await updateBatchMutation.mutateAsync({
            batchId: createdBatch.id,
            input: summaryInput,
          });
        }

        onCancel?.();
      } catch (error: unknown) {
        void message.error(getUserFacingErrorMessage(error, '烘焙记录保存失败，请检查后重试。'));
      } finally {
        setIsSubmitting(false);
      }
    };

    void submitTask();
  };

  return (
    <RoastBatchForm
      beans={roastableBeans}
      curveSection={
        <RoastCurveAttachmentPanel
          actionIcon={<DownloadOutlined />}
          actionLabel={pendingCurve ? '重新选择 HiBean JSON' : '导入 HiBean JSON'}
          curve={pendingCurve?.preview ?? null}
          disabled={isSubmitting}
          emptyText="可先选择 HiBean 导出的 JSON，保存后会自动绑定到本次烘焙记录。"
          isBusy={importCurveMutation.isPending || updateBatchMutation.isPending}
          removeLabel="移除曲线 JSON"
          sourceText={pendingCurve ? `已选择：${pendingCurve.fileName}` : '暂无曲线'}
          onFileSelected={handleCurveFile}
          onRemoveCurve={
            pendingCurve
              ? () => {
                  setPendingCurve(null);
                }
              : undefined
          }
        />
      }
      isSubmitting={isSubmitting}
      onCancel={onCancel}
      onChange={setForm}
      onSubmit={handleSubmit}
      plans={plans}
      submitDisabled={!hasBeanOptions}
      submitIcon={<CoffeeOutlined />}
      submitLabel="保存烘焙记录"
      value={form}
    />
  );
}
