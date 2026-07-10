import { PlusOutlined } from '@ant-design/icons';
import { App, Empty, Grid, Spin } from 'antd';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useBeans } from '@/modules/bean/hooks';
import {
  RoastBatchCard,
  RoastBatchFieldEditorDrawer,
  RoastBatchCreator,
  RoastBatchDrawer,
} from '@/modules/roast/components';
import type { RoastBatchEditableFieldPath } from '@/modules/roast/components/RoastBatchFieldEditorDrawer';
import {
  useDeleteRoastBatch,
  useRoastBatches,
  useUpdateRoastBatch,
} from '@/modules/roast/hooks';
import { roastBatchQueryKeys } from '@/modules/roast/hooks/useRoastBatches';
import { roastBatchService } from '@/modules/roast/services/roastBatch.service';
import { usePocketBaseConnectionSettings } from '@/modules/settings/hooks';
import { isPocketBaseProjectConnectionConfigured } from '@/modules/settings/types';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { ResponsiveMasonry } from '@/shared/components/ResponsiveMasonry';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { ViewportFloatingActionButton } from '@/shared/components/ViewportFloatingActionButton';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';
import { UnifiedSearchBar } from '@/shared/components/UnifiedSearchBar';
import type { RoastBatchCreateInput, RoastBatchRecord, RoastBatchUpdateInput } from '@/modules/roast/types/roastBatch';

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
  const { pocketBaseConnections } = usePocketBaseConnectionSettings();
  const [creationDrawerOpen, setCreationDrawerOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedBatchFieldPath, setSelectedBatchFieldPath] = useState<RoastBatchEditableFieldPath | undefined>();
  const [detailMode, setDetailMode] = useState<DetailMode | null>(null);
  const { data: batches = [], isFetching } = useRoastBatches();
  const { data: beans = [] } = useBeans();
  const deleteMutation = useDeleteRoastBatch();
  const updateMutation = useUpdateRoastBatch();
  const isWide = screens.md ?? false;
  const hasGreenBeanConnection = isPocketBaseProjectConnectionConfigured(pocketBaseConnections.greenBean);

  const filteredBatches = batches.filter((b) => matchesKeyword(b, keyword));
  const selectedBatch = batches.find((b) => b.id === selectedBatchId) ?? null;

  const handleView = (batchId: string) => {
    setSelectedBatchId(batchId);
    setSelectedBatchFieldPath(undefined);
    setDetailMode('view');
  };

  const handleEdit = (batchId: string, fieldPath?: RoastBatchEditableFieldPath) => {
    setSelectedBatchId(batchId);
    setSelectedBatchFieldPath(fieldPath);
    setDetailMode('edit');
  };

  const handleEditAll = (batchId: string) => {
    setSelectedBatchId(batchId);
    setSelectedBatchFieldPath(undefined);
    setDetailMode('edit');
  };

  const handleDelete = (batch: RoastBatchRecord) => {
    const displayName = batch.roastedBeanName ?? batch.greenBeanName;

    modal.confirm({
      centered: true,
      content: `确定要删除「${displayName}」的烘焙记录吗？此操作不可撤销。`,
      okButtonProps: { danger: true },
      okText: '删除',
      title: '确认删除',
      onOk() {
        void deleteMutation
          .mutateAsync(batch.id)
          .then(() => {
            setSelectedBatchId(null);
            setSelectedBatchFieldPath(undefined);
            setDetailMode(null);
          })
          .catch((error: unknown) => {
            void message.error(
              getUserFacingErrorMessage(error, '删除失败，未能同步到 PocketBase，请检查网络或服务状态。'),
            );
          });
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

    const createTask = (async () => {
      try {
        const response = await roastBatchService.createBatch(input);
        const nextBatches = roastBatchService.finalizeOptimisticBatch(optimisticBatch.id, response.data);

        queryClient.setQueryData<RoastBatchRecord[]>(roastBatchQueryKeys.list(), nextBatches);
      } catch (error: unknown) {
        const nextBatches = roastBatchService.rollbackOptimisticBatch(optimisticBatch.id);
        queryClient.setQueryData<RoastBatchRecord[]>(roastBatchQueryKeys.list(), nextBatches);
        void message.error(getUserFacingErrorMessage(error, '烘焙记录同步失败，已回滚本次新建，请检查后重试。'));
      }
    })();

    void createTask;
  };

  const handleUpdate = (batchId: string, input: RoastBatchUpdateInput) => {
    submissionBackupService.save('update', { batchId, input }, 'roastBatch');

    const updateTask = (async () => {
      try {
        await updateMutation.mutateAsync({ batchId, input });
      } catch (error: unknown) {
        void message.error(getUserFacingErrorMessage(error, '烘焙记录同步失败，本地备份已保留，请检查后重试。'));
      }
    })();

    void updateTask;
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

  const closeDetail = () => {
    setSelectedBatchId(null);
    setSelectedBatchFieldPath(undefined);
    setDetailMode(null);
  };

  return (
    <main className={styles.page}>
      {/* 搜索栏 */}
      <UnifiedSearchBar
        inputAriaLabel="搜索烘焙历史"
        onChange={(event) => {
          setKeyword(event.target.value);
        }}
        placeholder="搜索生豆、烘焙程度、计划..."
        sectionAriaLabel="烘焙历史搜索"
        value={keyword}
      />

      {/* 列表 */}
      <section className={styles.list} aria-label="烘焙历史列表">
        {isFetching && batches.length === 0 ? (
          <div className={styles.loading}>
            <Spin />
          </div>
        ) : null}

        {!isFetching && filteredBatches.length === 0 ? (
          <Empty className={styles.empty} description="没有匹配的烘焙记录" />
        ) : null}

        <ResponsiveMasonry ariaLabel="烘焙历史卡片列表">
          {filteredBatches.map((batch) => (
            <RoastBatchCard
              batch={batch}
              key={batch.id}
              onDelete={() => {
                handleDelete(batch);
              }}
              onEdit={handleEdit}
              onEditAll={handleEditAll}
              onView={handleView}
            />
          ))}
        </ResponsiveMasonry>
      </section>

      {/* FAB */}
      <ViewportFloatingActionButton
        ariaLabel="新增烘焙记录"
        icon={<PlusOutlined />}
        onClick={handleOpenCreateDrawer}
      />

      {/* 创建抽屉 */}
      <AppDrawer
        className={styles.creationDrawer}
        height="86dvh"
        onClose={() => {
          setCreationDrawerOpen(false);
        }}
        open={creationDrawerOpen}
        placement="bottom"
        title="新增烘焙记录"
      >
        <RoastBatchCreator
          onCancel={() => {
            setCreationDrawerOpen(false);
          }}
          onCreate={(input) => {
            handleCreate(input);
          }}
        />
      </AppDrawer>

      {/* 详情/编辑抽屉 */}
      {selectedBatch && (detailMode === 'view' || (detailMode === 'edit' && selectedBatchFieldPath == null)) ? (
        <AppDrawer
          className={styles.detailDrawer}
          data-placement={isWide ? 'right' : 'bottom'}
          height={isWide ? undefined : '86dvh'}
          onClose={closeDetail}
          open
          placement={isWide ? 'right' : 'bottom'}
          title={detailMode === 'edit' ? '编辑烘焙记录' : '烘焙记录详情'}
          width={720}
        >
          <RoastBatchDrawer
            batch={selectedBatch}
            mode={detailMode}
            onClose={closeDetail}
            onUpdate={handleUpdate}
          />
        </AppDrawer>
      ) : null}

      {selectedBatch && detailMode === 'edit' && selectedBatchFieldPath != null ? (
        <RoastBatchFieldEditorDrawer
          batch={selectedBatch}
          fieldPath={selectedBatchFieldPath}
          height={isWide ? undefined : '360px'}
          onClose={closeDetail}
          open
          placement={isWide ? 'right' : 'bottom'}
          width={720}
        />
      ) : null}
    </main>
  );
}
