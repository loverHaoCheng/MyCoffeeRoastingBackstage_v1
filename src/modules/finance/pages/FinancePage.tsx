import PlusOutlined from "@ant-design/icons/PlusOutlined";
import App from 'antd/es/app';
import Button from "antd/es/button";
import Grid from "antd/es/grid";
import Spin from "antd/es/spin";
import { useMemo, useState } from 'react';

import {
  useDeleteFinanceExpenseRecord,
  useDeleteFinanceIncomeRecord,
  useSaveFinanceExpenseRecord,
  useSaveFinanceIncomeRecord,
  useFinanceOverview,
} from '@/modules/finance/hooks';
import { ViewportFloatingActionButton } from '@/shared/components/ViewportFloatingActionButton';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import type {
  FinanceExpenseFormInput,
  FinanceIncomeFormInput,
  FinanceOverviewDrilldownKey,
  FinanceRangePreset,
} from '@/modules/finance/types';
import { AppDrawer } from '@/shared/components/AppDrawer';

import { buildFinanceOverviewDrilldown } from '../services';
import {
  CostTemplateManagerPanel,
  FinanceExpenseForm,
  FinanceFilterBar,
  FinanceIncomeForm,
  FinanceOverviewDetailDrawer,
  FinanceOverviewPanel,
} from '../components';
import { getFinanceExpenseCategoryLabel } from '../utils/expensePresentation';
import { getFinanceIncomeChannelLabel } from '../utils/incomePresentation';

import styles from './FinancePage.module.css';

export function FinancePage() {
  const { message, modal } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isWide = screens.md ?? false;
  const [preset, setPreset] = useState<FinanceRangePreset>('all');
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [isExpenseDrawerOpen, setIsExpenseDrawerOpen] = useState(false);
  const [isIncomeDrawerOpen, setIsIncomeDrawerOpen] = useState(false);
  const [activeDrilldownKey, setActiveDrilldownKey] = useState<FinanceOverviewDrilldownKey | null>(null);
  const [templateCreateRequestKey, setTemplateCreateRequestKey] = useState(0);
  const { beans, calculations, expenseRecords, incomeRecords, isFetching, overview, range, roastBatches, templates } = useFinanceOverview(
    preset,
    null,
  );
  const saveExpenseRecordMutation = useSaveFinanceExpenseRecord();
  const saveIncomeRecordMutation = useSaveFinanceIncomeRecord();
  const deleteExpenseRecordMutation = useDeleteFinanceExpenseRecord();
  const deleteIncomeRecordMutation = useDeleteFinanceIncomeRecord();
  const actionSheetStyles = {
    body: {
      paddingBottom: 0,
    },
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
      incomeRecords,
      key: activeDrilldownKey,
      roastBatches,
      range,
      templates,
    });
  }, [activeDrilldownKey, beans, calculations, expenseRecords, incomeRecords, range, roastBatches, templates]);

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

  const handleOpenIncomeDrawer = () => {
    setIsActionSheetOpen(false);
    setIsIncomeDrawerOpen(true);
  };

  const handleSaveExpenseRecord = async (input: FinanceExpenseFormInput) => {
    try {
      await saveExpenseRecordMutation.mutateAsync(input);
      setIsExpenseDrawerOpen(false);
      void message.success(`已保存${getFinanceExpenseCategoryLabel(input.category, input.customCategoryLabel)}支出`);
    } catch (error: unknown) {
      void message.error(getUserFacingErrorMessage(error, '支出记录保存失败，请检查 PocketBase 连接后重试。'));
      throw error;
    }
  };

  const handleSaveIncomeRecord = async (input: FinanceIncomeFormInput) => {
    try {
      await saveIncomeRecordMutation.mutateAsync(input);
      setIsIncomeDrawerOpen(false);
      void message.success(`已保存${getFinanceIncomeChannelLabel(input.channel)}收入`);
    } catch (error: unknown) {
      void message.error(getUserFacingErrorMessage(error, '收入记录保存失败，请检查 PocketBase 连接后重试。'));
      throw error;
    }
  };

  const handleDeleteDrilldownRecord = (recordId: string) => {
    const targetItem = activeDrilldownPayload?.records.find((record) => record.id === recordId);
    const targetExpenseRecord = expenseRecords.find((record) => record.id === recordId);
    const targetIncomeRecord = incomeRecords.find((record) => record.id === recordId);

    if (targetItem?.sourceType === 'manualIncome') {
      if (!targetIncomeRecord) {
        void message.error('未找到可删除的收入记录，请刷新后重试。');
        return;
      }

      modal.confirm({
        centered: true,
        content: `确定要删除「${targetIncomeRecord.title}」这条收入记录吗？此操作不可撤销。`,
        okButtonProps: { danger: true },
        okText: '删除',
        title: '确认删除',
        onOk() {
          return deleteIncomeRecordMutation
            .mutateAsync(recordId)
            .then(() => {
              void message.success(`已删除「${targetIncomeRecord.title}」收入记录`);
            })
            .catch((error: unknown) => {
              void message.error(getUserFacingErrorMessage(error, '删除失败，请检查 PocketBase 连接后重试。'));
            });
        },
      });
      return;
    }

    if (!targetExpenseRecord) {
      void message.error('未找到可删除的支出记录，请刷新后重试。');
      return;
    }

    modal.confirm({
      centered: true,
      content: `确定要删除「${targetExpenseRecord.title}」这条支出记录吗？此操作不可撤销。`,
      okButtonProps: { danger: true },
      okText: '删除',
      title: '确认删除',
      onOk() {
        return deleteExpenseRecordMutation
          .mutateAsync(recordId)
          .then(() => {
            void message.success(`已删除「${targetExpenseRecord.title}」支出记录`);
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
        <div className={styles.loading}>
          <Spin />
        </div>
      ) : null}

      <FinanceOverviewPanel
        onDrilldown={setActiveDrilldownKey}
        overview={overview}
      />

      <section aria-label="利润计算说明" className={styles.formulaPanel}>
        <p className={styles.formulaText}>
          <span className={styles.formulaLabel}>收入与利润：</span>
          收入已扣除成本模板中的包装、能耗和其他费用；利润再扣除生豆成本及关联邮费。
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

      <AppDrawer
        closable={false}
        className={styles.actionSheet}
        destroyOnHidden
        height={232}
        onClose={() => {
          setIsActionSheetOpen(false);
        }}
        open={isActionSheetOpen}
        placement="bottom"
        showSwipeHandle={false}
        styles={actionSheetStyles}
        title="选择创建项"
      >
        <div className={styles.actionSheetBody}>
          <div className={styles.actionSheetGroup}>
            <Button block className={styles.actionSheetButton} onClick={handleOpenTemplateCreate}>
              建立成本模板
            </Button>
            <Button block className={styles.actionSheetButton} onClick={handleOpenExpenseDrawer} type="primary">
              新增支出
            </Button>
            <Button block className={styles.actionSheetButton} onClick={handleOpenIncomeDrawer}>
              补录收入
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
      </AppDrawer>

      <AppDrawer
        className={styles.expenseDrawer}
        height="78dvh"
        onClose={() => {
          setIsExpenseDrawerOpen(false);
        }}
        open={isExpenseDrawerOpen}
        placement="bottom"
        title="新增支出"
      >
        <FinanceExpenseForm
          beans={beans}
          customCategorySuggestions={customCategorySuggestions}
          embedded
          expenseRecords={expenseRecords}
          isSaving={saveExpenseRecordMutation.isPending}
          onCancel={() => {
            setIsExpenseDrawerOpen(false);
          }}
          onSubmit={handleSaveExpenseRecord}
          roastBatches={roastBatches}
          showHeader={false}
          templates={templates}
        />
      </AppDrawer>

      <AppDrawer
        className={styles.expenseDrawer}
        height="78dvh"
        onClose={() => {
          setIsIncomeDrawerOpen(false);
        }}
        open={isIncomeDrawerOpen}
        placement="bottom"
        title="补录收入"
      >
        <FinanceIncomeForm
          embedded
          isSaving={saveIncomeRecordMutation.isPending}
          onCancel={() => {
            setIsIncomeDrawerOpen(false);
          }}
          onSubmit={handleSaveIncomeRecord}
          showHeader={false}
        />
      </AppDrawer>

      <FinanceOverviewDetailDrawer
        isWide={isWide}
        isDeleting={deleteExpenseRecordMutation.isPending || deleteIncomeRecordMutation.isPending}
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
