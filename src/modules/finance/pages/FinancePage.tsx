import { Alert, App } from 'antd';

import { useBeans } from '@/modules/bean/hooks';
import { CostCalculatorForm } from '@/modules/finance/components';
import { useSaveCostCalculation } from '@/modules/finance/hooks';
import { financeService } from '@/modules/finance/services';

import styles from './FinancePage.module.css';

export function FinancePage() {
  const { message } = App.useApp();
  const resolvedDataSource = financeService.getResolvedDataSource();
  const beansQuery = useBeans();
  const saveMutation = useSaveCostCalculation();

  const beans = beansQuery.data ?? [];

  const beanError =
    beansQuery.error instanceof Error ? (
      <Alert
        message="生豆数据加载失败"
        showIcon
        type="error"
        description={beansQuery.error.message}
      />
    ) : null;

  return (
    <main className={styles.page}>
      <section className={styles.alertStack}>
        {beanError}
      </section>

      <CostCalculatorForm
        beans={beans}
        canSave
        isSaving={saveMutation.isPending}
        onSubmit={async (input) => {
          try {
            const savedRecord = await saveMutation.mutateAsync(input);
            const isLocalOnlyRecord = savedRecord.id.startsWith('local-');

            void message.success(
              isLocalOnlyRecord
                ? '成本核算已保存到本地，联网后会自动同步'
                : `成本核算已同步到${resolvedDataSource === 'roastedBean' ? '熟豆库' : '生豆库'}`,
            );
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '保存失败，请稍后重试';
            void message.error(errorMessage);
          }
        }}
      />
    </main>
  );
}
