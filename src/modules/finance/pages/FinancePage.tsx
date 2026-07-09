import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Drawer, Grid, Spin } from 'antd';
import { useMemo, useState } from 'react';

import {
  useDeleteFinanceExpenseRecord,
  useSaveFinanceExpenseRecord,
  useFinanceOverview,
} from '@/modules/finance/hooks';
import { ViewportFloatingActionButton } from '@/shared/components/ViewportFloatingActionButton';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import type {
  FinanceExpenseFormInput,
  FinanceOverviewDrilldownKey,
  FinanceRangePreset,
} from '@/modules/finance/types';
import { AppDrawer } from '@/shared/components/AppDrawer';

import { buildFinanceOverviewDrilldown } from '../services';
import {
  CostTemplateManagerPanel,
  FinanceExpenseForm,
  FinanceFilterBar,
  FinanceOverviewDetailDrawer,
  FinanceOverviewPanel,
} from '../components';
import { getFinanceExpenseCategoryLabel } from '../utils/expensePresentation';

import styles from './FinancePage.module.css';

export function FinancePage() {
  const { message, modal } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isWide = screens.md ?? false;
  const [preset, setPreset] = useState<FinanceRangePreset>('all');
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [isExpenseDrawerOpen, setIsExpenseDrawerOpen] = useState(false);
  const [activeDrilldownKey, setActiveDrilldownKey] = useState<FinanceOverviewDrilldownKey | null>(null);
  const [templateCreateRequestKey, setTemplateCreateRequestKey] = useState(0);
  const { beans, calculations, expenseRecords, isFetching, overview, range, roastBatches } = useFinanceOverview(preset, null);
  const saveExpenseRecordMutation = useSaveFinanceExpenseRecord();
  const deleteExpenseRecordMutation = useDeleteFinanceExpenseRecord();
  const actionSheetStyles = isWide
    ? undefined
    : {
        content: {
          borderRadius: '28px 28px 0 0',
          overflow: 'hidden',
        },
        wrapper: {
          borderRadius: '28px 28px 0 0',
          overflow: 'hidden',
        },
      };

  const customCategorySuggestions = useMemo(() => {
    return Array.from(
      new Set(
        expenseRecords
          .filter((record) => record.category === 'custom')
          .map((record) => record.customCategoryLabel?.trim() ?? '')
          .filter((label) => label.length > 0),
      ),
    );
  }, [expenseRecords]);

  const activeDrilldownPayload = useMemo(() => {
    if (!activeDrilldownKey) {
      return null;
    }

    return buildFinanceOverviewDrilldown({
      beans,
      calculations,
      expenseRecords,
      key: activeDrilldownKey,
      roastBatches,
      range,
    });
  }, [activeDrilldownKey, beans, calculations, expenseRecords, range, roastBatches]);

  const handleOpenCreateFlow = () => {
    setIsActionSheetOpen(true);
  };

  const handleOpenTemplateCreate = () => {
    setIsActionSheetOpen(false);
    setTemplateCreateRequestKey((current) => current + 1);
  };

  const handleOpenExpenseDrawer = () => {
    setIsActionSheetOpen(false);
    setIsExpenseDrawerOpen(true);
  };

  const handleSaveExpenseRecord = async (input: FinanceExpenseFormInput) => {
    await saveExpenseRecordMutation.mutateAsync(input);
    setIsExpenseDrawerOpen(false);
    void message.success(`已保存${getFinanceExpenseCategoryLabel(input.category, input.customCategoryLabel)}支出`);
  };

  const handleDeleteDrilldownRecord = (recordId: string) => {
    const targetRecord = expenseRecords.find((record) => record.id === recordId);

    if (!targetRecord) {
      void message.error('未找到可删除的支出记录，请刷新后重试。');
      return;
    }

    modal.confirm({
      centered: true,
      content: `确定要删除「${targetRecord.title}」这条支出记录吗？此操作不可撤销。`,
      okButtonProps: { danger: true },
      okText: '删除',
      title: '确认删除',
      onOk() {
        return deleteExpenseRecordMutation
          .mutateAsync(recordId)
          .then(() => {
            void message.success(`已删除「${targetRecord.title}」支出记录`);
          })
          .catch((error: unknown) => {
            void message.error(getUserFacingErrorMessage(error, '删除失败，请检查 PocketBase 连接后重试。'));
          });
      },
    });
  };

  return (
    <main className={styles.page}>
      <FinanceFilterBar
        onPresetChange={setPreset}
        preset={preset}
      />

      {isFetching && calculations.length === 0 && expenseRecords.length === 0 ? (
        <div>
          <Spin />
        </div>
      ) : null}

      <FinanceOverviewPanel
        onDrilldown={setActiveDrilldownKey}
        overview={overview}
      />

      <section aria-label="利润计算说明" className={styles.formulaPanel}>
        <p className={styles.formulaText}>
          <span className={styles.formulaLabel}>毛利润：</span>
          已经卖出的收入，减去生豆采购、包装支出和邮费支出后，剩下的就是毛利润。
        </p>
        <p className={styles.formulaText}>
          <span className={styles.formulaLabel}>经营利润：</span>
          已经卖出的收入，减去当前时间范围内全部实际支出后，剩下的就是经营利润。
        </p>
      </section>

      <CostTemplateManagerPanel createRequestKey={templateCreateRequestKey} />

      <ViewportFloatingActionButton
        ariaLabel="新增财务动作"
        icon={<PlusOutlined />}
        onClick={handleOpenCreateFlow}
      />

      <Drawer
        closable={false}
        className={styles.actionSheet}
        height={isWide ? undefined : 176}
        onClose={() => {
          setIsActionSheetOpen(false);
        }}
        open={isActionSheetOpen}
        placement={isWide ? 'right' : 'bottom'}
        styles={actionSheetStyles}
        title="选择创建项"
        width={isWide ? 360 : undefined}
      >
        <div className={styles.actionSheetBody}>
          <div className={styles.actionSheetGroup}>
            <Button block className={styles.actionSheetButton} onClick={handleOpenTemplateCreate}>
              建立成本模板
            </Button>
            <Button block className={styles.actionSheetButton} onClick={handleOpenExpenseDrawer} type="primary">
              新增支出
            </Button>
          </div>
          <div aria-hidden="true" className={styles.actionSheetSpacer} />
          <div className={styles.actionSheetCancelGroup}>
            <Button
              block
              className={styles.actionSheetButton}
              onClick={() => {
                setIsActionSheetOpen(false);
              }}
            >
              取消
            </Button>
          </div>
        </div>
      </Drawer>

      <AppDrawer
        className={styles.expenseDrawer}
        height={isWide ? undefined : '78dvh'}
        onClose={() => {
          setIsExpenseDrawerOpen(false);
        }}
        open={isExpenseDrawerOpen}
        placement={isWide ? 'right' : 'bottom'}
        title="新增支出"
        width={isWide ? 460 : undefined}
      >
        <FinanceExpenseForm
          customCategorySuggestions={customCategorySuggestions}
          embedded
          isSaving={saveExpenseRecordMutation.isPending}
          onSubmit={handleSaveExpenseRecord}
          showHeader={false}
        />
      </AppDrawer>

      <FinanceOverviewDetailDrawer
        isWide={isWide}
        isDeleting={deleteExpenseRecordMutation.isPending}
        onClose={() => {
          setActiveDrilldownKey(null);
        }}
        onDeleteRecord={handleDeleteDrilldownRecord}
        onUnsupportedDelete={(nextMessage) => {
          void message.info(nextMessage);
        }}
        open={activeDrilldownKey !== null}
        payload={activeDrilldownPayload}
      />
    </main>
  );
}
