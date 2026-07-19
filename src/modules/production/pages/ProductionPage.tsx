import PlusOutlined from "@ant-design/icons/PlusOutlined";
import App from 'antd/es/app';
import Empty from "antd/es/empty";
import Grid from "antd/es/grid";
import Spin from "antd/es/spin";
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useBeans } from '@/modules/bean/hooks';
import { buildCostTemplateById, calculateRoastSaleCapacity, resolveBeanCostTemplate } from '@/modules/finance/services/financeProfitCalculation.service';
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
import { useCostTemplateSettings } from '@/modules/settings/hooks';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { ResponsiveMasonry } from '@/shared/components/ResponsiveMasonry';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { ViewportFloatingActionButton } from '@/shared/components/ViewportFloatingActionButton';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';
import { UnifiedSearchBar } from '@/shared/components/UnifiedSearchBar';
import { FilterSortToggle, MultiFilterSortBar, type MultiFilterDefinition } from '@/shared/components/MultiFilterSortBar';
import type { RoastBatchCreateInput, RoastBatchRecord, RoastBatchUpdateInput } from '@/modules/roast/types/roastBatch';

import styles from './ProductionPage.module.css';

type DetailMode = 'view' | 'edit';
type RoastBatchSortKey = 'inputAsc' | 'inputDesc' | 'outputAsc' | 'outputDesc' | 'roastDateAsc' | 'roastDateDesc';
type RoastBatchFilterKey = 'bean' | 'level' | 'saleProgress' | 'salesMode';
type RoastBatchSaleProgress = 'full' | 'notFull';

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

const getFilterOptions = (values: string[]) => Array.from(new Set(values.filter(Boolean)))
  .sort((left, right) => left.localeCompare(right, 'zh-CN'))
  .map((value) => ({ label: value, value }));

const sortBatches = (batches: RoastBatchRecord[], sortKey: RoastBatchSortKey): RoastBatchRecord[] => {
  return [...batches].sort((left, right) => {
    switch (sortKey) {
      case 'roastDateAsc': return new Date(left.roastDate).getTime() - new Date(right.roastDate).getTime();
      case 'inputAsc': return left.inputWeightGrams - right.inputWeightGrams;
      case 'inputDesc': return right.inputWeightGrams - left.inputWeightGrams;
      case 'outputAsc': return left.outputWeightGrams - right.outputWeightGrams;
      case 'outputDesc': return right.outputWeightGrams - left.outputWeightGrams;
      default: return new Date(right.roastDate).getTime() - new Date(left.roastDate).getTime();
    }
  });
};

const getSaleProgress = (
  batch: RoastBatchRecord,
  maximumSoldUnitCount: number | undefined,
): RoastBatchSaleProgress | null => {
  if (batch.salesMode !== 'sale' || maximumSoldUnitCount == null) {
    return null;
  }

  return (batch.soldUnitCount ?? 1) >= maximumSoldUnitCount ? 'full' : 'notFull';
};

export function ProductionPage() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const [creationDrawerOpen, setCreationDrawerOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [filterValues, setFilterValues] = useState<Record<RoastBatchFilterKey, string[]>>({
    bean: [], level: [], saleProgress: [], salesMode: [],
  });
  const [sortKey, setSortKey] = useState<RoastBatchSortKey>('roastDateDesc');
  const [isFilterPanelExpanded, setIsFilterPanelExpanded] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedBatchFieldPath, setSelectedBatchFieldPath] = useState<RoastBatchEditableFieldPath | undefined>();
  const [detailMode, setDetailMode] = useState<DetailMode | null>(null);
  const { data: batches = [], isFetching } = useRoastBatches();
  const { data: beans = [] } = useBeans();
  const { costTemplateSettings } = useCostTemplateSettings();
  const deleteMutation = useDeleteRoastBatch();
  const updateMutation = useUpdateRoastBatch();
  const isWide = screens.md ?? false;

  const saleProgressByBatchId = useMemo(() => {
    const beansById = new Map(beans.map((bean) => [String(bean.id), bean]));
    const templatesById = buildCostTemplateById(costTemplateSettings.templates);

    return new Map(batches.map((batch) => {
      const bean = beansById.get(batch.greenBeanId);
      const template = bean ? resolveBeanCostTemplate(bean, templatesById) : null;
      const maximumSoldUnitCount = template
        ? calculateRoastSaleCapacity(batch.inputWeightGrams, template).maximumSoldUnitCount
        : undefined;

      return [batch.id, getSaleProgress(batch, maximumSoldUnitCount)];
    }));
  }, [batches, beans, costTemplateSettings.templates]);

  const filterDefinitions = useMemo<MultiFilterDefinition[]>(() => [
    { key: 'bean', label: '生豆', options: getFilterOptions(batches.map((batch) => batch.greenBeanName)) },
    { key: 'level', label: '烘焙度', options: getFilterOptions(batches.map((batch) => batch.roastLevel)) },
    { key: 'salesMode', label: '去向', options: [{ label: '销售', value: 'sale' }, { label: '自留', value: 'selfUse' }] },
    { key: 'saleProgress', label: '售出量', options: [{ label: '未售满', value: 'notFull' }, { label: '已售满', value: 'full' }] },
  ], [batches]);
  const filteredBatches = useMemo(() => {
    const matchingBatches = batches.filter((batch) => {
      const saleProgress = saleProgressByBatchId.get(batch.id);

      return matchesKeyword(batch, keyword) &&
        (filterValues.bean.length === 0 || filterValues.bean.includes(batch.greenBeanName)) &&
        (filterValues.level.length === 0 || filterValues.level.includes(batch.roastLevel)) &&
        (filterValues.salesMode.length === 0 || filterValues.salesMode.includes(batch.salesMode)) &&
        (filterValues.saleProgress.length === 0 || (saleProgress != null && filterValues.saleProgress.includes(saleProgress)));
    });

    return sortBatches(matchingBatches, sortKey);
  }, [batches, filterValues, keyword, saleProgressByBatchId, sortKey]);
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
      content: `确定要删除「${displayName}」的烘焙记录吗？关联的烘焙曲线也会永久删除，且无法复原。`,
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

  const handleCreate = async (input: RoastBatchCreateInput): Promise<RoastBatchRecord> => {
    submissionBackupService.save('create', input, 'roastBatch');
    const optimisticBatch = roastBatchService.createOptimisticBatch(input);

    queryClient.setQueryData<RoastBatchRecord[]>(roastBatchQueryKeys.list(), (current = []) => {
      return sortBatchesByRoastDate([
        optimisticBatch,
        ...current.filter((batch) => batch.id !== optimisticBatch.id),
      ]);
    });

    try {
      const response = await roastBatchService.createBatch(input);
      const nextBatches = roastBatchService.finalizeOptimisticBatch(optimisticBatch.id, response.data);

      queryClient.setQueryData<RoastBatchRecord[]>(roastBatchQueryKeys.list(), nextBatches);

      return response.data;
    } catch (error: unknown) {
      const nextBatches = roastBatchService.rollbackOptimisticBatch(optimisticBatch.id);
      queryClient.setQueryData<RoastBatchRecord[]>(roastBatchQueryKeys.list(), nextBatches);
      throw error;
    }
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
        trailingAction={
          <FilterSortToggle
            activeFilterCount={Object.values(filterValues).reduce((total, values) => total + values.length, 0)}
            expanded={isFilterPanelExpanded}
            onExpandedChange={setIsFilterPanelExpanded}
          />
        }
        value={keyword}
      />

      <MultiFilterSortBar
        expanded={isFilterPanelExpanded}
        filters={filterDefinitions}
        onChange={(key, values) => {
          setFilterValues((current) => ({ ...current, [key]: values }));
        }}
        onClear={() => {
          setFilterValues({ bean: [], level: [], saleProgress: [], salesMode: [] });
        }}
        onSortChange={(value) => {
          setSortKey(value as RoastBatchSortKey);
        }}
        sortOptions={[
          { label: '最新烘焙', value: 'roastDateDesc' }, { label: '最早烘焙', value: 'roastDateAsc' },
          { label: '入豆量由多到少', value: 'inputDesc' }, { label: '入豆量由少到多', value: 'inputAsc' },
          { label: '出豆量由多到少', value: 'outputDesc' }, { label: '出豆量由少到多', value: 'outputAsc' },
        ]}
        sortValue={sortKey}
        values={filterValues}
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
            return handleCreate(input);
          }}
        />
      </AppDrawer>

      {/* 详情/编辑抽屉 */}
      <AppDrawer
        className={styles.detailDrawer}
        data-placement={isWide ? 'right' : 'bottom'}
        height={isWide ? undefined : '86dvh'}
        onClose={closeDetail}
        open={selectedBatch != null && (detailMode === 'view' || (detailMode === 'edit' && selectedBatchFieldPath == null))}
        placement={isWide ? 'right' : 'bottom'}
        title={detailMode === 'edit' ? '编辑烘焙记录' : '烘焙记录详情'}
        width={720}
      >
        {selectedBatch && (detailMode === 'view' || (detailMode === 'edit' && selectedBatchFieldPath == null)) ? (
          <RoastBatchDrawer
            batch={selectedBatch}
            mode={detailMode}
            onClose={closeDetail}
            onUpdate={handleUpdate}
          />
        ) : null}
      </AppDrawer>

      <RoastBatchFieldEditorDrawer
        batch={selectedBatch}
        fieldPath={selectedBatchFieldPath}
        height={isWide ? undefined : '360px'}
        onClose={closeDetail}
        open={selectedBatch != null && detailMode === 'edit' && selectedBatchFieldPath != null}
        placement={isWide ? 'right' : 'bottom'}
        width={720}
      />
    </main>
  );
}
