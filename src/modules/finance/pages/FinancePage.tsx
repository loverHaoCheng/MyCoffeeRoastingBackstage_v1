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
        canSave={resolvedDataSource != null}
        isSaving={saveMutation.isPending}
        onSubmit={async (input) => {
          try {
            await saveMutation.mutateAsync(input);
            void message.success('成本核算已保存到 Supabase');
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '保存失败，请稍后重试';
            void message.error(errorMessage);
          }
        }}
      />
    </main>
  );
}
