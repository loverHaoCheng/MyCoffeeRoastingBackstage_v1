import { PlusOutlined } from '@ant-design/icons';
import { App, Drawer, Empty, Grid, Spin, Tabs } from 'antd';
import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { refreshAllAppData } from '@/app/services/appDataRefresh.service';
import {
  RoastPlanDetail,
  RoastPlanList,
  RoastPlanManualCreator,
  RoastPlanJsonImporter,
} from '@/modules/roast/components';
import {
  roastPlanQueryKeys,
  useDeleteRoastPlan,
  useRoastPlans,
  useUpdateRoastPlan,
} from '@/modules/roast/hooks';
import { roastPlanService } from '@/modules/roast/services/roastPlan.service';
import { useSupabaseConnectionSettings } from '@/modules/settings/hooks';
import { ViewportFloatingActionButton } from '@/shared/components/ViewportFloatingActionButton';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';
import { UnifiedSearchBar } from '@/shared/components/UnifiedSearchBar';
import type { RoastPlan } from '@/types/domain';
import type { RoastPlanJsonInput } from '@/modules/roast/types';

import styles from './RoastPage.module.css';

type DetailMode = 'view' | 'edit';

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
  return [plan.name, plan.beanName, plan.targetRoastLevel, plan.roastPurpose]
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

export function RoastPage() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const { supabaseConnections } = useSupabaseConnectionSettings();
  const [keyword, setKeyword] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<RoastPlan['id'] | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode | null>(null);
  const [creationDrawerOpen, setCreationDrawerOpen] = useState(false);
  const [creationTab, setCreationTab] = useState<'manual' | 'json'>('manual');

  const { data: plans = [], isFetching, refetch } = useRoastPlans();
  const updateMutation = useUpdateRoastPlan();
  const deleteMutation = useDeleteRoastPlan();

  const isWide = screens.md ?? false;
  const hasGreenBeanConnection =
    supabaseConnections.greenBean.projectUrl.trim().length > 0 &&
    supabaseConnections.greenBean.publishableKey.trim().length > 0;

  const filteredPlans = useMemo(
    () => plans.filter((p) => matchesKeyword(p, keyword)),
    [plans, keyword],
  );

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  // 查看
  const handleView = (planId: RoastPlan['id']) => {
    setSelectedPlanId(planId);
    setDetailMode('view');
  };

  // 编辑
  const handleEdit = (planId: RoastPlan['id']) => {
    setSelectedPlanId(planId);
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
      async onOk() {
        try {
          await deleteMutation.mutateAsync(plan.id);
          setSelectedPlanId(null);
          setDetailMode(null);
          void message.success('烘焙计划已删除');
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : '删除失败';
          message.error(msg);
        }
      },
    });
  };

  // 更新计划
  const handleUpdate = (planId: RoastPlan['id'], input: RoastPlanJsonInput) => {
    submissionBackupService.save('update', { input, planId }, 'roastPlan');

    void (async () => {
      try {
        await updateMutation.mutateAsync({ planId, input });
        await refreshAllAppData(queryClient);
        await refetch();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : '烘焙计划同步失败，本地已备份。';
        void message.error(errorMessage);
      }
    })();
  };

  // 手动创建
  const handleCreateManual = (input: RoastPlanJsonInput) => {
    setCreationDrawerOpen(false);
    submissionBackupService.save('create', input, 'roastPlan');
    const optimisticPlan = roastPlanService.createOptimisticPlan(input);

    queryClient.setQueryData<RoastPlan[]>(roastPlanQueryKeys.list(), (current = []) => {
      return sortPlansByUpdatedAt([
        optimisticPlan,
        ...current.filter((plan) => String(plan.id) !== String(optimisticPlan.id)),
      ]);
    });

    void (async () => {
      try {
        const response = await roastPlanService.createPlan(input);
        const nextPlans = roastPlanService.finalizeOptimisticPlan(optimisticPlan.id, response.data);

        queryClient.setQueryData<RoastPlan[]>(roastPlanQueryKeys.list(), nextPlans);
        void queryClient.invalidateQueries({ queryKey: roastPlanQueryKeys.all });
      } catch (error: unknown) {
        const nextPlans = roastPlanService.rollbackOptimisticPlan(optimisticPlan.id);
        queryClient.setQueryData<RoastPlan[]>(roastPlanQueryKeys.list(), nextPlans);
        const errorMessage = error instanceof Error ? error.message : '烘焙计划同步失败，本地已备份。';
        void message.error(errorMessage);
      }
    })();
  };

  // JSON 导入创建
  const handleCreateFromJson = (jsonText: string) => {
    setCreationDrawerOpen(false);
    submissionBackupService.save('create', { jsonText }, 'roastPlan');
    const optimisticPlan = roastPlanService.createOptimisticPlanFromJson(jsonText);

    queryClient.setQueryData<RoastPlan[]>(roastPlanQueryKeys.list(), (current = []) => {
      return sortPlansByUpdatedAt([
        optimisticPlan,
        ...current.filter((plan) => String(plan.id) !== String(optimisticPlan.id)),
      ]);
    });

    void (async () => {
      try {
        const response = await roastPlanService.createPlanFromJson(jsonText);
        const nextPlans = roastPlanService.finalizeOptimisticPlan(optimisticPlan.id, response.data);

        queryClient.setQueryData<RoastPlan[]>(roastPlanQueryKeys.list(), nextPlans);
        void queryClient.invalidateQueries({ queryKey: roastPlanQueryKeys.all });
      } catch (error: unknown) {
        const nextPlans = roastPlanService.rollbackOptimisticPlan(optimisticPlan.id);
        queryClient.setQueryData<RoastPlan[]>(roastPlanQueryKeys.list(), nextPlans);
        const errorMessage = error instanceof Error ? error.message : '烘焙计划同步失败，本地已备份。';
        void message.error(errorMessage);
      }
    })();
  };

  // 关闭详情
  const closeDetail = () => {
    setSelectedPlanId(null);
    setDetailMode(null);
  };

  const handleOpenCreateDrawer = () => {
    if (!hasGreenBeanConnection) {
      void message.warning('请先前往设置页创建并连接生豆数据库，完成后才能新增烘焙计划。');
      return;
    }

    setCreationDrawerOpen(true);
  };

  return (
    <main className={styles.page}>
      {/* 搜索栏 */}
      <UnifiedSearchBar
        inputAriaLabel="搜索烘焙计划"
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="搜索计划名称、生豆、烘焙程度..."
        sectionAriaLabel="烘焙计划搜索"
        value={keyword}
      />

      {/* 计划列表 */}
      <section className={styles.list} aria-label="烘焙计划卡片区域">
        {isFetching && plans.length === 0 ? (
          <div className={styles.loading}><Spin /></div>
        ) : null}

        {!isFetching && filteredPlans.length === 0 ? (
          <Empty className={styles.empty} description="没有匹配的烘焙计划" />
        ) : null}

        <RoastPlanList plans={filteredPlans} onDelete={handleDelete} onEdit={handleEdit} onView={handleView} />
      </section>

      {/* FAB */}
      <ViewportFloatingActionButton
        ariaLabel="新增烘焙计划"
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
        title="新增烘焙计划"
      >
        <Tabs
          activeKey={creationTab}
          onChange={(key) => setCreationTab(key as 'manual' | 'json')}
          items={[
            {
              key: 'manual',
              label: '手动创建',
              children: (
                <RoastPlanManualCreator
                  onCancel={() => setCreationDrawerOpen(false)}
                  onCreate={handleCreateManual}
                />
              ),
            },
            {
              key: 'json',
              label: 'JSON 导入',
              children: (
                <RoastPlanJsonImporter
                  onCancel={() => setCreationDrawerOpen(false)}
                  onImport={handleCreateFromJson}
                />
              ),
            },
          ]}
        />
      </Drawer>

      {/* 详情/编辑抽屉 */}
      <Drawer
        className={styles.detailDrawer}
        data-placement={isWide ? 'right' : 'bottom'}
        height={isWide ? undefined : '86dvh'}
        onClose={closeDetail}
        open={selectedPlan !== null && detailMode !== null}
        placement={isWide ? 'right' : 'bottom'}
        title={getDetailDrawerTitle(detailMode)}
        width={720}
      >
        {selectedPlan && detailMode ? (
          <RoastPlanDetail
            mode={detailMode}
            onClose={closeDetail}
            onDelete={(planId) => {
              const plan = plans.find((p) => p.id === planId);
              if (plan) handleDelete(plan);
              closeDetail();
            }}
            onUpdate={handleUpdate}
            plan={selectedPlan}
          />
        ) : null}
      </Drawer>
    </main>
  );
}
