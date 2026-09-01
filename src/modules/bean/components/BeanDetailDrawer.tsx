import App from 'antd/es/app';
import Button from "antd/es/button";
import Result from "antd/es/result";
import Spin from "antd/es/spin";

import { useBeanEditableDetail } from '@/modules/bean/hooks/useBeanEditableDetail';
import { useUpdateBean } from '@/modules/bean/hooks/useBeans';
import { useCostTemplateSettings } from '@/modules/settings/hooks';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { ReadonlyFieldSectionList } from '@/shared/components/ReadonlyFieldSectionList';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';
import type { Bean } from '@/types/domain';
import type { FieldPath } from 'react-hook-form';

import type { GreenBeanFormInput } from '../types/localGreenBean';

import { BeanForm } from './BeanForm';
import { buildBeanDetailSections } from './bean-detail/beanDetailView.utils';
import styles from './BeanDetailDrawer.module.css';

type DetailMode = 'view' | 'edit';

interface BeanDetailDrawerProps {
  bean: Bean;
  focusFieldPath?: FieldPath<GreenBeanFormInput>;
  mode: DetailMode;
  onClose: () => void;
}

export function BeanDetailDrawer({ bean, focusFieldPath, mode, onClose }: BeanDetailDrawerProps) {
  const { message } = App.useApp();
  const { costTemplateSettings } = useCostTemplateSettings();
  const editableDetailQuery = useBeanEditableDetail(bean.id);
  const updateBeanMutation = useUpdateBean();
  const costTemplateLabel = bean.costTemplateId
    ? costTemplateSettings.templates.find((template) => template.id === bean.costTemplateId)?.name ??
      bean.costTemplateId
    : '待补充';

  if (mode === 'view') {
    return (
      <section className="grid gap-3">
        <ReadonlyFieldSectionList
          sections={buildBeanDetailSections({
            bean,
            costTemplateLabel: costTemplateLabel === '待补充' ? null : costTemplateLabel,
            detail: editableDetailQuery.data,
          })}
        />
      </section>
    );
  }

  if (editableDetailQuery.isLoading) {
    return (
      <section className={styles.loadingState}>
        <Spin />
      </section>
    );
  }

  if (!editableDetailQuery.data) {
    return (
      <section className={styles.feedbackState}>
        <Result
          extra={
            <Button
              onClick={() => {
                void editableDetailQuery.refetch();
              }}
            >
              重试
            </Button>
          }
          status="warning"
          subTitle={editableDetailQuery.error instanceof Error ? editableDetailQuery.error.message : '暂时无法读取生豆详情'}
          title="编辑数据加载失败"
        />
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <BeanForm
        enableCostTemplateSelection
        initialValues={editableDetailQuery.data}
        focusFieldPath={focusFieldPath}
        onCancel={onClose}
        onSubmit={(input) => {
          onClose();
          const backupId = submissionBackupService.save('update', { beanId: bean.id, input }, 'bean');

          const updateTask = (async () => {
            try {
              await updateBeanMutation.mutateAsync({ beanId: bean.id, input });
              submissionBackupService.clear(backupId);
            } catch (error) {
              void message.error(getUserFacingErrorMessage(error, '生豆同步失败，本次修改未保存，请保留编辑内容并重试。'));
            }
          })();

          void updateTask;
        }}
        submitLabel="保存生豆"
      />
    </section>
  );
}
