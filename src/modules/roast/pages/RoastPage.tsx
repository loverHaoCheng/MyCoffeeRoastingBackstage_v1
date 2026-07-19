import PlusOutlined from "@ant-design/icons/PlusOutlined";
import App from 'antd/es/app';
import Button from 'antd/es/button';
import Empty from "antd/es/empty";
import Grid from "antd/es/grid";
import Spin from "antd/es/spin";
import Tabs from "antd/es/tabs";
import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  RoastPlanDetail,
  RoastPlanFieldEditorDrawer,
  RoastPlanList,
  RoastPlanManualCreator,
  RoastPlanJsonImporter,
} from '@/modules/roast/components';
import { defaultRoastPlanFormValues } from '@/modules/roast/constants';
import type { RoastPlanEditableFieldPath } from '@/modules/roast/components/RoastPlanFieldEditorDrawer';
import {
  roastPlanQueryKeys,
  useDeleteRoastPlan,
  useRoastBatches,
  useRoastPlans,
  useUpdateRoastPlan,
} from '@/modules/roast/hooks';
import { getEffectiveRoastPlanStatus } from '@/modules/roast/constants/roastPlanStatus';
import { parseRoastPlanJsonDraft } from '@/modules/roast/services';
import { roastPlanService } from '@/modules/roast/services/roastPlan.service';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { ViewportFloatingActionButton } from '@/shared/components/ViewportFloatingActionButton';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';
import { UnifiedSearchBar } from '@/shared/components/UnifiedSearchBar';
import { FilterSortToggle, MultiFilterSortBar, type MultiFilterDefinition } from '@/shared/components/MultiFilterSortBar';
import type { RoastPlan } from '@/types/domain';
import type { RoastPlanJsonInput } from '@/modules/roast/types';

import styles from './RoastPage.module.css';

type DetailMode = 'view' | 'edit';
type RoastPlanSortKey = 'nameAsc' | 'updatedAsc' | 'updatedDesc' | 'weightAsc' | 'weightDesc';
type RoastPlanFilterKey = 'bean' | 'level' | 'purpose';

const getDetailDrawerTitle = (mode: DetailMode | null): string => {
  if (mode === 'view') {
    return '烘焙计划详情';
  }

  if (mode === 'edit') {
    return '编辑烘焙计划';
  }

  return '';
};

const matchesKeyword = (plan: RoastPlan, keyword: string): boolean => {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return true;
  return [plan.name, plan.beanName, plan.roasterModel, plan.targetRoastLevel, plan.roastPurpose]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(normalized);
};

const sortPlansByUpdatedAt = (plans: RoastPlan[]): RoastPlan[] => {
  return [...plans].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
};

const getFilterOptions = (values: string[]) => Array.from(new Set(values.filter(Boolean)))
  .sort((left, right) => left.localeCompare(right, 'zh-CN'))
  .map((value) => ({ label: value, value }));

const sortPlans = (plans: RoastPlan[], sortKey: RoastPlanSortKey): RoastPlan[] => [...plans].sort((left, right) => {
  switch (sortKey) {
    case 'nameAsc': return left.name.localeCompare(right.name, 'zh-CN');
    case 'updatedAsc': return new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
    case 'weightAsc': return left.batchWeightGrams - right.batchWeightGrams;
    case 'weightDesc': return right.batchWeightGrams - left.batchWeightGrams;
    default: return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  }
});

export function RoastPage() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const [keyword, setKeyword] = useState('');
  const [filterValues, setFilterValues] = useState<Record<RoastPlanFilterKey, string[]>>({ bean: [], level: [], purpose: [] });
  const [sortKey, setSortKey] = useState<RoastPlanSortKey>('updatedDesc');
  const [isFilterPanelExpanded, setIsFilterPanelExpanded] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<RoastPlan['id'] | null>(null);
  const [selectedPlanFieldPath, setSelectedPlanFieldPath] = useState<RoastPlanEditableFieldPath | 'steps' | undefined>();
  const [detailMode, setDetailMode] = useState<DetailMode | null>(null);
  const [creationDrawerOpen, setCreationDrawerOpen] = useState(false);
  const [creationTab, setCreationTab] = useState<'ai' | 'json' | 'manual'>('manual');
  const [creationInitialValues, setCreationInitialValues] = useState<RoastPlanJsonInput | undefined>();
  const [creationResetSignal, setCreationResetSignal] = useState(0);

  const { data: plans = [], isFetching } = useRoastPlans();
  const updateMutation = useUpdateRoastPlan();
  const deleteMutation = useDeleteRoastPlan();

  const isWide = screens.md ?? false;

  const { data: batches = [] } = useRoastBatches();
  const effectivePlans = useMemo(
    () =>
      plans.map((plan) => ({
        ...plan,
        status: getEffectiveRoastPlanStatus(plan, batches),
      })),
    [batches, plans],
  );

  const filterDefinitions = useMemo<MultiFilterDefinition[]>(() => [
    { key: 'bean', label: '生豆', options: getFilterOptions(effectivePlans.map((plan) => plan.beanName)) },
    { key: 'level', label: '烘焙目标', options: getFilterOptions(effectivePlans.map((plan) => plan.targetRoastLevel)) },
    { key: 'purpose', label: '用途', options: getFilterOptions(effectivePlans.map((plan) => plan.roastPurpose)) },
  ], [effectivePlans]);
  const filteredPlans = useMemo(() => {
    const matchingPlans = effectivePlans.filter((plan) => matchesKeyword(plan, keyword) &&
      (filterValues.bean.length === 0 || filterValues.bean.includes(plan.beanName)) &&
      (filterValues.level.length === 0 || filterValues.level.includes(plan.targetRoastLevel)) &&
      (filterValues.purpose.length === 0 || filterValues.purpose.includes(plan.roastPurpose)));
    return sortPlans(matchingPlans, sortKey);
  }, [effectivePlans, filterValues, keyword, sortKey]);

  const selectedPlan = effectivePlans.find((p) => p.id === selectedPlanId) ?? null;

  const resetCreationDraft = () => {
    setCreationTab('manual');
    setCreationInitialValues(undefined);
    setCreationResetSignal((current) => current + 1);
  };

  // 查看
  const handleView = (planId: RoastPlan['id']) => {
    setSelectedPlanId(planId);
    setSelectedPlanFieldPath(undefined);
    setDetailMode('view');
  };

  // 编辑
  const handleEdit = (planId: RoastPlan['id'], fieldPath?: RoastPlanEditableFieldPath | 'steps') => {
    setSelectedPlanId(planId);
    setSelectedPlanFieldPath(fieldPath);
    setDetailMode('edit');
  };

  const handleEditAll = (planId: RoastPlan['id']) => {
    setSelectedPlanId(planId);
    setSelectedPlanFieldPath(undefined);
    setDetailMode('edit');
  };

  // 删除
  const handleDelete = (plan: RoastPlan) => {
    modal.confirm({
      centered: true,
      content: `确定要删除「${plan.name}」吗？此操作不可撤销。`,
      okButtonProps: { danger: true },
      okText: '删除',
      title: '确认删除',
      onOk() {
        void deleteMutation
          .mutateAsync(plan.id)
          .then(() => {
            setSelectedPlanId(null);
            setSelectedPlanFieldPath(undefined);
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

  // 更新计划
  const handleUpdate = (planId: RoastPlan['id'], input: RoastPlanJsonInput) => {
    submissionBackupService.save('update', { input, planId }, 'roastPlan');

    const updateTask = (async () => {
      try {
        await updateMutation.mutateAsync({ planId, input });
      } catch (error: unknown) {
        void message.error(getUserFacingErrorMessage(error, '烘焙计划同步失败，本地备份已保留，请检查后重试。'));
      }
    })();

    void updateTask;
  };

  // 手动创建
  const handleCreateManual = (input: RoastPlanJsonInput) => {
    setCreationDrawerOpen(false);
    resetCreationDraft();
    submissionBackupService.save('create', input, 'roastPlan');
    const optimisticPlan = roastPlanService.createOptimisticPlan(input);

    queryClient.setQueryData<RoastPlan[]>(roastPlanQueryKeys.list(), (current = []) => {
      return sortPlansByUpdatedAt([
        optimisticPlan,
        ...current.filter((plan) => String(plan.id) !== String(optimisticPlan.id)),
      ]);
    });

    const createTask = (async () => {
      try {
        const response = await roastPlanService.createPlan(input);
        const nextPlans = roastPlanService.finalizeOptimisticPlan(optimisticPlan.id, response.data);

        queryClient.setQueryData<RoastPlan[]>(roastPlanQueryKeys.list(), nextPlans);
      } catch (error: unknown) {
        const nextPlans = roastPlanService.rollbackOptimisticPlan(optimisticPlan.id);
        queryClient.setQueryData<RoastPlan[]>(roastPlanQueryKeys.list(), nextPlans);
        void message.error(getUserFacingErrorMessage(error, '烘焙计划同步失败，已回滚本次新建，请检查后重试。'));
      }
    })();

    void createTask;
  };

  // JSON 导入仅回填表单，最终创建仍由手动表单提交。
  const handleFillFormFromJson = (jsonText: string) => {
    try {
      const nextInitialValues = parseRoastPlanJsonDraft(
        jsonText,
        creationInitialValues ?? defaultRoastPlanFormValues,
      );

      submissionBackupService.save('create', { input: nextInitialValues, jsonText }, 'roastPlan');
      setCreationInitialValues(nextInitialValues);
      setCreationTab('manual');
      void message.success('JSON 已回填到创建表单，可继续补充和修改。');
    } catch (error: unknown) {
      void message.error(getUserFacingErrorMessage(error, 'JSON 解析失败，请检查内容后重试。'));
    }
  };

  // 关闭详情
  const closeDetail = () => {
    setSelectedPlanId(null);
    setSelectedPlanFieldPath(undefined);
    setDetailMode(null);
  };

  const handleOpenCreateDrawer = () => {
    resetCreationDraft();
    setCreationDrawerOpen(true);
  };

  return (
    <main className={styles.page}>
      {/* 搜索栏 */}
      <UnifiedSearchBar
        inputAriaLabel="搜索烘焙计划"
        onChange={(event) => {
          setKeyword(event.target.value);
        }}
        placeholder="搜索计划名称、生豆、烘焙程度..."
        sectionAriaLabel="烘焙计划搜索"
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
          setFilterValues({ bean: [], level: [], purpose: [] });
        }}
        onSortChange={(value) => {
          setSortKey(value as RoastPlanSortKey);
        }}
        sortOptions={[
          { label: '最近更新', value: 'updatedDesc' }, { label: '最早更新', value: 'updatedAsc' },
          { label: '名称 A-Z', value: 'nameAsc' }, { label: '批次重量由大到小', value: 'weightDesc' },
          { label: '批次重量由小到大', value: 'weightAsc' },
        ]}
        sortValue={sortKey}
        values={filterValues}
      />

      {/* 计划列表 */}
      <section className={styles.list} aria-label="烘焙计划卡片区域">
        {isFetching && plans.length === 0 ? (
          <div className={styles.loading}>
            <Spin />
          </div>
        ) : null}

        {!isFetching && filteredPlans.length === 0 ? (
          <Empty className={styles.empty} description="没有匹配的烘焙计划" />
        ) : null}

        <RoastPlanList
          onDelete={handleDelete}
          onEdit={handleEdit}
          onEditAll={handleEditAll}
          onView={handleView}
          plans={filteredPlans}
        />
      </section>

      {/* FAB */}
      <ViewportFloatingActionButton
        ariaLabel="新增烘焙计划"
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
        title="新增烘焙计划"
      >
        <Tabs
          activeKey={creationTab}
          onChange={(key) => {
            if (key === 'ai') {
              void message.info('AI 推荐正在筹备中，当前版本先完成数据采集与校验。');
            }

            setCreationTab(key as 'ai' | 'json' | 'manual');
          }}
          items={[
            {
              key: 'manual',
              label: '手动创建',
              children: (
                <RoastPlanManualCreator
                  initialValues={creationInitialValues}
                  onCancel={() => {
                    setCreationDrawerOpen(false);
                  }}
                  onCreate={handleCreateManual}
                />
              ),
            },
            {
              key: 'json',
              label: 'JSON 导入',
              children: (
                <RoastPlanJsonImporter
                  onCancel={() => {
                    setCreationDrawerOpen(false);
                  }}
                  onImport={handleFillFormFromJson}
                  resetSignal={creationResetSignal}
                />
              ),
            },
            {
              key: 'ai',
              label: 'AI 推荐',
              children: (
                <section className={styles.aiPanel} aria-label="AI 推荐筹备说明">
                  <div className={styles.aiPanelHeader}>
                    <h3>AI 推荐（暂未开放）</h3>
                    <p>当前版本先公开入口和规则说明，正式推荐能力会在训练快照、质量检查和安全边界稳定后开放。</p>
                  </div>
                  <div className={styles.aiStageGrid}>
                    <article className={styles.aiStageItem}>
                      <strong>当前已开放</strong>
                      <p>烘豆机型号、风温、转速、曲线与评价表单采集。</p>
                    </article>
                    <article className={styles.aiStageItem}>
                      <strong>当前暂禁用</strong>
                      <p>AI 生成烘焙计划、训练上传、模型版本与推荐依据展示。</p>
                    </article>
                    <article className={styles.aiStageItem}>
                      <strong>开放前条件</strong>
                      <p>需要先完成训练数据快照、单次上传限制、质量检查与自动发布链路。</p>
                    </article>
                  </div>
                  <Button block disabled type="primary">
                    AI 推荐（暂未开放）
                  </Button>
                </section>
              ),
            },
          ]}
        />
      </AppDrawer>

      {/* 详情/编辑抽屉 */}
      <AppDrawer
        className={styles.detailDrawer}
        data-placement={isWide ? 'right' : 'bottom'}
        height={isWide ? undefined : '86dvh'}
        onClose={closeDetail}
        open={
          selectedPlan != null &&
          (detailMode === 'view' ||
            (detailMode === 'edit' && (selectedPlanFieldPath == null || selectedPlanFieldPath === 'steps')))
        }
        placement={isWide ? 'right' : 'bottom'}
        title={getDetailDrawerTitle(detailMode)}
        width={720}
      >
        {selectedPlan &&
        (detailMode === 'view' ||
          (detailMode === 'edit' && (selectedPlanFieldPath == null || selectedPlanFieldPath === 'steps'))) ? (
          <RoastPlanDetail
            mode={detailMode}
            onClose={closeDetail}
            onUpdate={handleUpdate}
            plan={selectedPlan}
          />
        ) : null}
      </AppDrawer>

      <RoastPlanFieldEditorDrawer
        fieldPath={selectedPlanFieldPath === 'steps' ? undefined : selectedPlanFieldPath}
        height={isWide ? undefined : '360px'}
        onClose={closeDetail}
        open={selectedPlan != null && detailMode === 'edit' && selectedPlanFieldPath != null && selectedPlanFieldPath !== 'steps'}
        plan={selectedPlan}
        placement={isWide ? 'right' : 'bottom'}
        width={720}
      />
    </main>
  );
}
