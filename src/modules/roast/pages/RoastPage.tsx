import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Drawer, Empty, Grid, Tabs } from 'antd';
import { useMemo, useState } from 'react';

import {
  RoastPlanDetail,
  RoastPlanJsonImporter,
  RoastPlanList,
  RoastPlanManualCreator,
} from '@/modules/roast/components';
import { useRoastPlanStore } from '@/modules/roast/store';
import type { RoastPlanJsonInput } from '@/modules/roast/types';

import styles from './RoastPage.module.css';

const { useBreakpoint } = Grid;

type DetailMode = 'view' | 'edit';

export function RoastPage() {
  const { addPlan, addPlanFromJson, deletePlan, plans, selectPlan, updatePlan } = useRoastPlanStore();
  const { message } = App.useApp();
  const screens = useBreakpoint();
  const [creationDrawerOpen, setCreationDrawerOpen] = useState(false);
  const [detailMode, setDetailMode] = useState<DetailMode | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const isWide = screens.md ?? false;

  const selectedPlan = useMemo(() => {
    return plans.find((plan) => plan.id === selectedPlanId) ?? null;
  }, [plans, selectedPlanId]);

  const handleViewPlan = (planId: number) => {
    selectPlan(planId);
    setSelectedPlanId(planId);
    setDetailMode('view');
  };

  const handleEditPlan = (planId: number) => {
    selectPlan(planId);
    setSelectedPlanId(planId);
    setDetailMode('edit');
  };

  const handleDeletePlan = (planId: number) => {
    deletePlan(planId);
    setSelectedPlanId(null);
    setDetailMode(null);
    void message.success('烘焙计划已删除');
  };

  const handleAddPlanFromJson = (jsonText: string) => {
    addPlanFromJson(jsonText);
    setCreationDrawerOpen(false);
  };

  const handleAddPlan = (input: RoastPlanJsonInput) => {
    addPlan(input);
    setCreationDrawerOpen(false);
  };

  const handleUpdatePlan = (planId: number, input: RoastPlanJsonInput) => {
    updatePlan(planId, input);
  };

  return (
    <main className={styles.page}>
      <section className={styles.workspace}>
        {plans.length > 0 ? (
          <RoastPlanList onEdit={handleEditPlan} onView={handleViewPlan} plans={plans} />
        ) : (
          <Empty className={styles.emptyState} description="从 JSON 创建第一个烘焙计划" />
        )}
      </section>

      <Button
        aria-label="新建计划"
        className={styles.fab}
        icon={<PlusOutlined />}
        onClick={() => {
          setCreationDrawerOpen(true);
        }}
        shape="circle"
      />

      <Drawer
        className={styles.creationDrawer}
        height="82dvh"
        onClose={() => {
          setCreationDrawerOpen(false);
        }}
        open={creationDrawerOpen}
        placement="bottom"
        title="新建烘焙计划"
      >
        <Tabs
          defaultActiveKey="ai"
          items={[
            {
              key: 'ai',
              label: 'AI 导入计划',
              children: <RoastPlanJsonImporter onImport={handleAddPlanFromJson} />,
            },
            {
              key: 'manual',
              label: '界面创建',
              children: <RoastPlanManualCreator onCreate={handleAddPlan} />,
            },
          ]}
        />
      </Drawer>

      <Drawer
        className={styles.detailDrawer}
        height={isWide ? undefined : '86dvh'}
        onClose={() => {
          setSelectedPlanId(null);
          setDetailMode(null);
        }}
        open={selectedPlan !== null && detailMode !== null}
        placement={isWide ? 'right' : 'bottom'}
        title={detailMode === 'view' ? '查看烘焙计划' : '编辑烘焙计划'}
        width={720}
      >
        {selectedPlan && detailMode ? (
          <RoastPlanDetail
            mode={detailMode}
            onDelete={handleDeletePlan}
            onUpdate={handleUpdatePlan}
            plan={selectedPlan}
          />
        ) : null}
      </Drawer>
    </main>
  );
}
