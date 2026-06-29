import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Drawer, Empty, Grid, Spin } from 'antd';
import { useState } from 'react';

import {
  RoastBatchCard,
  RoastBatchCreator,
  RoastBatchDrawer,
} from '@/modules/roast/components';
import {
  useCreateRoastBatch,
  useDeleteRoastBatch,
  useRoastBatches,
  useUpdateRoastBatch,
} from '@/modules/roast/hooks';
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

export function ProductionPage() {
  const { message, modal } = App.useApp();
  const screens = Grid.useBreakpoint();
  const [creationDrawerOpen, setCreationDrawerOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode | null>(null);
  const { data: batches = [], isFetching, refetch } = useRoastBatches();
  const createMutation = useCreateRoastBatch();
  const updateMutation = useUpdateRoastBatch();
  const deleteMutation = useDeleteRoastBatch();
  const isWide = screens.md ?? false;

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

  const handleCreate = async (input: RoastBatchCreateInput) => {
    await createMutation.mutateAsync(input);
    setCreationDrawerOpen(false);
    void message.success('烘焙记录已保存');
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
      <Button
        aria-label="新增烘焙记录"
        className={styles.fab}
        icon={<PlusOutlined />}
        onClick={() => setCreationDrawerOpen(true)}
        shape="circle"
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
        <RoastBatchCreator onCreate={(input) => void handleCreate(input)} />
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
              await updateMutation.mutateAsync({ batchId, input });
              void message.success('烘焙记录已更新');
              await refetch();
            }}
          />
        ) : null}
      </Drawer>
    </main>
  );
}
