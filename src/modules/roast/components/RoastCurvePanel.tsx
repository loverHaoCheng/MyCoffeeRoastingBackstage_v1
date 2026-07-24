import DownloadOutlined from '@ant-design/icons/DownloadOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';
import App from 'antd/es/app';

import { useImportHiBeanRoastCurve, useRoastCurve, useUpdateRoastBatch } from '@/modules/roast/hooks';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import { toRoastBatchCurveSummaryInput } from '@/modules/roast/utils/roastCurveSummary';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import { RoastCurveAttachmentPanel } from './RoastCurveAttachmentPanel';

interface RoastCurvePanelProps {
  batch: RoastBatchRecord;
}

export function RoastCurvePanel({ batch }: RoastCurvePanelProps) {
  const { message, modal } = App.useApp();
  const curveQuery = useRoastCurve(batch.id);
  const importCurveMutation = useImportHiBeanRoastCurve();
  const updateBatchMutation = useUpdateRoastBatch();
  const curve = curveQuery.data ?? null;
  const isBusy = importCurveMutation.isPending || updateBatchMutation.isPending;

  const importFile = async (file: File) => {
    const jsonText = await file.text();
    const result = await importCurveMutation.mutateAsync({
      fileName: file.name,
      jsonText,
      roastBatchId: batch.id,
    });
    const summaryInput = toRoastBatchCurveSummaryInput(result.record.metrics);

    await updateBatchMutation.mutateAsync({
      batchId: batch.id,
      input: summaryInput,
    });

    void message.success(curve ? '曲线已覆盖并同步摘要' : '曲线已导入并同步摘要');
  };

  const handleFile = (file: File) => {
    const runImport = async () => {
      try {
        await importFile(file);
      } catch (error: unknown) {
        void message.error(getUserFacingErrorMessage(error, '曲线 JSON 导入失败，请检查文件内容或 PocketBase 配置。'));
      }
    };

    if (curve) {
      modal.confirm({
        centered: true,
        content: '该烘焙记录已存在曲线，重新导入会覆盖当前曲线。',
        okText: '覆盖导入',
        title: '覆盖曲线 JSON',
        onOk: runImport,
      });
      return;
    }

    void runImport();
  };

  return (
    <RoastCurveAttachmentPanel
      actionIcon={curve ? <ReloadOutlined /> : <DownloadOutlined />}
      actionLabel={curve ? '覆盖导入' : '导入 JSON'}
      curve={curve}
      emptyText="导入 HiBean 或 Artisan JSON 后会在这里展示温度、RoR 与关键事件。"
      isBusy={isBusy}
      isLoading={curveQuery.isFetching}
      sourceText={curve ? `来源：${curve.source === 'artisan' ? 'Artisan' : 'HiBean'} · ${curve.originalFileName ?? '未记录文件名'}` : '暂无曲线'}
      onFileSelected={handleFile}
    />
  );
}
