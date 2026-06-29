import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Drawer, Empty, Grid, Spin, Tabs } from 'antd';
import { useState, useMemo } from 'react';

import {
  RoastPlanDetail,
  RoastPlanList,
  RoastPlanManualCreator,
  RoastPlanJsonImporter,
} from '@/modules/roast/components';
import {
  useCreateRoastPlan,
  useCreateRoastPlanFromJson,
  useDeleteRoastPlan,
  useRoastPlans,
  useUpdateRoastPlan,
} from '@/modules/roast/hooks';
import { UnifiedSearchBar } from '@/shared/components/UnifiedSearchBar';
import type { RoastPlan } from '@/types/domain';
import type { RoastPlanJsonInput } from '@/modules/roast/types';

import styles from './RoastPage.module.css';

type DetailMode = 'view' | 'edit';

const matchesKeyword = (plan: RoastPlan, keyword: string): boolean => {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return true;
  return [plan.name, plan.beanName, plan.targetRoastLevel, plan.roastPurpose]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(normalized);
};

export function RoastPage() {
  const { message, modal } = App.useApp();
  const screens = Grid.useBreakpoint();
  const [keyword, setKeyword] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<RoastPlan['id'] | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode | null>(null);
  const [creationDrawerOpen, setCreationDrawerOpen] = useState(false);
  const [creationTab, setCreationTab] = useState<'manual' | 'json'>('manual');

  const { data: plans = [], isFetching, refetch } = useRoastPlans();
  const createMutation = useCreateRoastPlan();
  const createJsonMutation = useCreateRoastPlanFromJson();
  const updateMutation = useUpdateRoastPlan();
  const deleteMutation = useDeleteRoastPlan();

  const isWide = screens.md ?? false;

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
  const handleUpdate = async (planId: RoastPlan['id'], input: RoastPlanJsonInput) => {
    await updateMutation.mutateAsync({ planId, input });
    void message.success('烘焙计划已保存');
  };

  // 手动创建
  const handleCreateManual = async (input: RoastPlanJsonInput) => {
    await createMutation.mutateAsync(input);
    setCreationDrawerOpen(false);
    void message.success('烘焙计划已创建');
  };

  // JSON 导入创建
  const handleCreateFromJson = async (jsonText: string) => {
    await createJsonMutation.mutateAsync(jsonText);
    setCreationDrawerOpen(false);
    void message.success('烘焙计划已创建');
  };

  // 关闭详情
  const closeDetail = () => {
    setSelectedPlanId(null);
    setDetailMode(null);
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
      <Button
        aria-label="新增烘焙计划"
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
        title="新增烘焙计划"
      >
        <Tabs
          activeKey={creationTab}
          onChange={(key) => setCreationTab(key as 'manual' | 'json')}
          items={[
            {
              key: 'manual',
              label: '手动创建',
              children: <RoastPlanManualCreator onCreate={handleCreateManual} />,
            },
            {
              key: 'json',
              label: 'JSON 导入',
              children: <RoastPlanJsonImporter onImport={handleCreateFromJson} />,
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
        title={detailMode === 'view' ? '烘焙计划详情' : '编辑烘焙计划'}
        width={720}
      >
        {selectedPlan && detailMode ? (
          <RoastPlanDetail
            mode={detailMode}
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
