import App from 'antd/es/app';
import Button from 'antd/es/button';

import { useRoastCurve } from '@/modules/roast/hooks';
import { useRoastTrainingUpload, useRoastTrainingUploadStatus } from '@/modules/roast/hooks/useRoastTrainingUpload';
import { isRoastTrainingUploadClientEnabled } from '@/modules/roast/services/roastTrainingUpload.service';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import { getRoastTrainingReadiness } from '@/modules/roast/utils/roastTrainingReadiness';

import styles from './RoastBatchDrawer.module.css';

interface RoastTrainingUploadSectionProps {
  batch: RoastBatchRecord;
}

export function RoastTrainingUploadSection({ batch }: RoastTrainingUploadSectionProps) {
  const { message, modal } = App.useApp();
  const roastCurveQuery = useRoastCurve(batch.id);
  const trainingUploadStatusQuery = useRoastTrainingUploadStatus(batch.id);
  const trainingUploadMutation = useRoastTrainingUpload();
  const isTrainingUploadClientEnabled = isRoastTrainingUploadClientEnabled();
  const trainingReadiness = getRoastTrainingReadiness(batch, Boolean(roastCurveQuery.data));
  const hasTrainingConsent = batch.evaluation.allowTraining;
  const serverUploadStatus = trainingUploadStatusQuery.data;
  const trainingUploadError =
    trainingUploadStatusQuery.error instanceof Error ? trainingUploadStatusQuery.error.message : '';
  const trainingUploadSubmitError =
    trainingUploadMutation.error instanceof Error ? trainingUploadMutation.error.message : '';
  const isAlreadyUploaded = serverUploadStatus?.alreadyUploaded === true;
  const canFallbackToServerValidation =
    isTrainingUploadClientEnabled &&
    trainingUploadStatusQuery.isError &&
    trainingReadiness.isUploadReady &&
    hasTrainingConsent;
  const isTrainingUploadEnabled =
    isTrainingUploadClientEnabled &&
    trainingReadiness.isUploadReady &&
    hasTrainingConsent &&
    (serverUploadStatus?.enabled === true || canFallbackToServerValidation);
  const trainingUploadButtonLabel = isAlreadyUploaded
    ? '已上传用于训练'
    : isTrainingUploadClientEnabled
      ? '上传用于训练'
      : '上传用于训练（正式环境暂未开放）';
  const trainingHintText = !isTrainingUploadClientEnabled
    ? '正式环境仍保持禁用；测试环境会先开放点按测试。'
    : trainingUploadSubmitError
      ? trainingUploadSubmitError
      : trainingUploadError && canFallbackToServerValidation
        ? '状态查询暂未刷新，可直接点击上传，服务端会做最终校验。'
        : trainingUploadError
          ? trainingUploadError
      : isAlreadyUploaded
        ? '这条记录已经上传过训练数据，不能重复上传。'
        : !hasTrainingConsent
          ? '需要先在评价表单中开启训练授权，上传后用于训练的数据不支持逐条撤回。'
          : serverUploadStatus?.disabledReason ?? '测试环境已开放上传；本阶段只写入训练快照和审计记录，不会发布 AI 推荐。';
  const trainingSummaryText = trainingReadiness.isUploadReady
    ? hasTrainingConsent
      ? '当前记录已满足测试环境训练上传条件。'
      : '当前记录资料已齐全，但仍需开启训练授权后才能上传。'
    : `当前仍缺少：${trainingReadiness.missingLabels.join('、')}。`;

  const handleTrainingUpload = () => {
    modal.confirm({
      cancelText: '取消',
      content: '本次会将当前烘焙记录、生豆、烘焙计划、曲线和评价表单生成训练快照。上传后用于训练的数据不支持逐条撤回，且同一条烘焙记录不能重复上传。',
      okButtonProps: {
        danger: true,
      },
      okText: '确认上传',
      title: '确认上传训练数据',
      onOk: async () => {
        try {
          await trainingUploadMutation.mutateAsync(batch.id);
          void message.success('训练数据已上传到测试环境。');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '训练数据上传失败，请稍后重试。';
          void message.error(errorMessage);
          throw error;
        }
      },
    });
  };

  return (
    <section className={styles.section}>
      <h4>AI 训练准备</h4>
      <p className={styles.trainingSummary}>{trainingSummaryText}</p>
      <div className={styles.trainingGrid}>
        {trainingReadiness.items.map((item) => (
          <article className={styles.trainingItem} data-ready={item.ready ? 'true' : 'false'} key={item.key}>
            <strong>{item.label}</strong>
            <span>{item.ready ? '已就绪' : '待补充'}</span>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
      <div className={styles.trainingActionRow}>
        <Button
          disabled={!isTrainingUploadEnabled || trainingUploadMutation.isPending}
          loading={trainingUploadStatusQuery.isFetching || trainingUploadMutation.isPending}
          onClick={handleTrainingUpload}
          type="default"
        >
          {trainingUploadButtonLabel}
        </Button>
        <span className={styles.trainingHint}>{trainingHintText}</span>
      </div>
    </section>
  );
}
