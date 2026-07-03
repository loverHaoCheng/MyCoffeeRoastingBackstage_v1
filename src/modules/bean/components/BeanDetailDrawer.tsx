import { App, Button, Result, Spin } from 'antd';
import { useQueryClient } from '@tanstack/react-query';

import { refreshAllAppData } from '@/app/services/appDataRefresh.service';
import { useBeanEditableDetail } from '@/modules/bean/hooks';
import { beanService } from '@/modules/bean/services';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';
import type { Bean } from '@/types/domain';

import { BeanForm } from './BeanForm';
import styles from './BeanDetailDrawer.module.css';

type DetailMode = 'view' | 'edit';

interface BeanDetailDrawerProps {
  bean: Bean;
  mode: DetailMode;
  onClose: () => void;
  onUpdate: () => void;
}

const formatKg = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 1,
});

const formatCurrency = new Intl.NumberFormat('zh-CN', {
  currency: 'CNY',
  maximumFractionDigits: 2,
  style: 'currency',
});

export function BeanDetailDrawer({ bean, mode, onClose, onUpdate }: BeanDetailDrawerProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const editableDetailQuery = useBeanEditableDetail(bean.id);
  const totalWeightGrams = editableDetailQuery.data?.purchasedWeightGrams ?? Math.round(bean.stockKg * 1000);
  const remainingWeightGrams = editableDetailQuery.data?.remainingWeightGrams ?? Math.round(bean.stockKg * 1000);

  if (mode === 'view') {
    const summaryItems = [
      { label: '名称', value: bean.name },
      { label: '产地', value: bean.origin || '待补充' },
      { label: '处理法', value: bean.process },
      { label: '总库存', value: `${formatKg.format(totalWeightGrams / 1000)} kg` },
      { label: '剩余库存', value: `${formatKg.format(remainingWeightGrams / 1000)} kg` },
      { label: '成本', value: `${formatCurrency.format(bean.costPerKg)} / kg` },
      { label: '默认烘焙量', value: bean.defaultRoastInputGrams ? `${bean.defaultRoastInputGrams} g` : '待补充' },
      {
        label: '默认单份售价',
        value: bean.defaultSaleUnitPrice != null ? formatCurrency.format(bean.defaultSaleUnitPrice) : '待补充',
      },
      {
        label: '默认单份重量',
        value: bean.defaultSaleUnitWeightGrams != null ? `${bean.defaultSaleUnitWeightGrams} g` : '待补充',
      },
      { label: '供应商', value: bean.supplierName ?? '待补充' },
      {
        label: '更新时间',
        value: new Date(bean.updatedAt).toLocaleString('zh-CN'),
      },
    ];

    return (
      <section className={styles.panel}>
        <div className={styles.summaryGrid}>
          {summaryItems.map((item) => (
            <div className={styles.summaryItem} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>

        <div className={styles.detailSection}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>豆种</span>
            <span>{bean.variety ?? '-'}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>产季</span>
            <span>{bean.harvestSeason ?? '-'}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>编号</span>
            <span>{bean.code ?? '-'}</span>
          </div>
        </div>
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
        onCancel={onClose}
        onSubmit={(input) => {
          onClose();
          submissionBackupService.save('update', { beanId: bean.id, input }, 'bean');

          void (async () => {
            try {
              await beanService.updateBean(bean.id, input);
              await refreshAllAppData(queryClient);
              onUpdate();
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : '生豆同步失败，本地已备份。';
              void message.error(errorMessage);
            }
          })();
        }}
        submitLabel="保存生豆"
      />
    </section>
  );
}
