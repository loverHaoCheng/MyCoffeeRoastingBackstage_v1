import { PlusOutlined } from '@ant-design/icons';
import { App, Drawer, Empty, Grid, Spin } from 'antd';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { refreshAllAppData } from '@/app/services/appDataRefresh.service';
import { useBeans } from '@/modules/bean/hooks';
import {
  RoastBatchCard,
  RoastBatchCreator,
  RoastBatchDrawer,
} from '@/modules/roast/components';
import {
  useDeleteRoastBatch,
  useRoastBatches,
  useUpdateRoastBatch,
} from '@/modules/roast/hooks';
import { roastBatchQueryKeys } from '@/modules/roast/hooks/useRoastBatches';
import { roastBatchService } from '@/modules/roast/services/roastBatch.service';
import { useSupabaseConnectionSettings } from '@/modules/settings/hooks';
import { ViewportFloatingActionButton } from '@/shared/components/ViewportFloatingActionButton';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';
import { UnifiedSearchBar } from '@/shared/components/UnifiedSearchBar';
import type { RoastBatchCreateInput, RoastBatchRecord } from '@/modules/roast/types/roastBatch';

import styles from './ProductionPage.module.css';

type DetailMode = 'view' | 'edit';

const matchesKeyword = (batch: RoastBatchRecord, keyword: string): boolean => {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return true;
  return [batch.roastedBeanName, batch.greenBeanName, batch.roastLevel, batch.roastPlanName, batch.notes]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(normalized);
};

const sortBatchesByRoastDate = (batches: RoastBatchRecord[]): RoastBatchRecord[] => {
  return [...batches].sort((left, right) => {
    return new Date(right.roastDate).getTime() - new Date(left.roastDate).getTime();
  });
};

export function ProductionPage() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const { supabaseConnections } = useSupabaseConnectionSettings();
  const [creationDrawerOpen, setCreationDrawerOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode | null>(null);
  const { data: batches = [], isFetching, refetch } = useRoastBatches();
  const { data: beans = [] } = useBeans();
  const updateMutation = useUpdateRoastBatch();
  const deleteMutation = useDeleteRoastBatch();
  const isWide = screens.md ?? false;
  const hasGreenBeanConnection =
    supabaseConnections.greenBean.projectUrl.trim().length > 0 &&
    supabaseConnections.greenBean.publishableKey.trim().length > 0;

  const filteredBatches = batches.filter((b) => matchesKeyword(b, keyword));
  const selectedBatch = batches.find((b) => b.id === selectedBatchId) ?? null;

  const handleView = (batchId: string) => {
    setSelectedBatchId(batchId);
    setDetailMode('view');
  };

  const handleEdit = (batchId: string) => {
    setSelectedBatchId(batchId);
    setDetailMode('edit');
  };

  const handleDelete = (batch: RoastBatchRecord) => {
    const displayName = batch.roastedBeanName || batch.greenBeanName;

    modal.confirm({
      centered: true,
      content: `确定要删除「${displayName}」的烘焙记录吗？此操作不可撤销。`,
      okButtonProps: { danger: true },
      okText: '删除',
      title: '确认删除',
      async onOk() {
        try {
          await deleteMutation.mutateAsync(batch.id);
          setSelectedBatchId(null);
          setDetailMode(null);
          void message.success('烘焙记录已删除');
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : '删除失败';
          message.error(msg);
        }
      },
    });
  };

  const handleCreate = (input: RoastBatchCreateInput) => {
    setCreationDrawerOpen(false);
    submissionBackupService.save('create', input, 'roastBatch');
    const optimisticBatch = roastBatchService.createOptimisticBatch(input);

    queryClient.setQueryData<RoastBatchRecord[]>(roastBatchQueryKeys.list(), (current = []) => {
      return sortBatchesByRoastDate([
        optimisticBatch,
        ...current.filter((batch) => batch.id !== optimisticBatch.id),
      ]);
    });

    void (async () => {
      try {
        const response = await roastBatchService.createBatch(input);
        const nextBatches = roastBatchService.finalizeOptimisticBatch(optimisticBatch.id, response.data);

        queryClient.setQueryData<RoastBatchRecord[]>(roastBatchQueryKeys.list(), nextBatches);
        void refreshAllAppData(queryClient).catch(() => undefined);
      } catch (error: unknown) {
        const nextBatches = roastBatchService.rollbackOptimisticBatch(optimisticBatch.id);
        queryClient.setQueryData<RoastBatchRecord[]>(roastBatchQueryKeys.list(), nextBatches);
        const errorMessage = error instanceof Error ? error.message : '烘焙记录同步失败，本地已备份。';
        void message.error(errorMessage);
      }
    })();
  };

  const handleOpenCreateDrawer = () => {
    if (!hasGreenBeanConnection) {
      void message.warning('请先前往设置页创建并连接生豆数据库，完成后才能新增烘焙记录。');
      return;
    }

    if (beans.length === 0) {
      void message.warning('当前还没有可选的生豆，请先创建至少一条生豆数据。');
      return;
    }

    setCreationDrawerOpen(true);
  };

  return (
    <main className={styles.page}>
      {/* 搜索栏 */}
      <UnifiedSearchBar
        inputAriaLabel="搜索烘焙历史"
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="搜索生豆、烘焙程度、计划..."
        sectionAriaLabel="烘焙历史搜索"
        value={keyword}
      />

      {/* 列表 */}
      <section className={styles.list} aria-label="烘焙历史列表">
        {isFetching && batches.length === 0 ? (
          <div className={styles.loading}><Spin /></div>
        ) : null}

        {!isFetching && filteredBatches.length === 0 ? (
          <Empty className={styles.empty} description="没有匹配的烘焙记录" />
        ) : null}

        {filteredBatches.map((batch) => (
          <RoastBatchCard
            batch={batch}
            key={batch.id}
            onDelete={() => handleDelete(batch)}
            onEdit={handleEdit}
            onView={handleView}
          />
        ))}
      </section>

      {/* FAB */}
      <ViewportFloatingActionButton
        ariaLabel="新增烘焙记录"
        icon={<PlusOutlined />}
        onClick={handleOpenCreateDrawer}
      />

      {/* 创建抽屉 */}
      <Drawer
        className={styles.creationDrawer}
        height="86dvh"
        onClose={() => setCreationDrawerOpen(false)}
        open={creationDrawerOpen}
        placement="bottom"
        title="新增烘焙记录"
      >
        <RoastBatchCreator
          onCancel={() => setCreationDrawerOpen(false)}
          onCreate={(input) => void handleCreate(input)}
        />
      </Drawer>

      {/* 详情/编辑抽屉 */}
      <Drawer
        className={styles.detailDrawer}
        data-placement={isWide ? 'right' : 'bottom'}
        height={isWide ? undefined : '86dvh'}
        onClose={() => {
          setSelectedBatchId(null);
          setDetailMode(null);
        }}
        open={selectedBatch !== null && detailMode !== null}
        placement={isWide ? 'right' : 'bottom'}
        title={detailMode === 'view' ? '烘焙记录详情' : '编辑烘焙记录'}
        width={720}
      >
        {selectedBatch && detailMode ? (
          <RoastBatchDrawer
            batch={selectedBatch}
            mode={detailMode}
            onClose={() => {
              setSelectedBatchId(null);
              setDetailMode(null);
            }}
            onDelete={handleDelete}
            onModeChange={setDetailMode}
            onUpdate={async (batchId, input) => {
              submissionBackupService.save('update', { batchId, input }, 'roastBatch');

              void (async () => {
                try {
                  await updateMutation.mutateAsync({ batchId, input });
                  await refreshAllAppData(queryClient);
                  await refetch();
                } catch (error: unknown) {
                  const errorMessage = error instanceof Error ? error.message : '烘焙记录同步失败，本地已备份。';
                  void message.error(errorMessage);
                }
              })();
            }}
          />
        ) : null}
      </Drawer>
    </main>
  );
}
