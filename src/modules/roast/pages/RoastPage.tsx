import PlusOutlined from "@ant-design/icons/PlusOutlined";
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import CheckOutlined from '@ant-design/icons/CheckOutlined';
import App from 'antd/es/app';
import Button from 'antd/es/button';
import Empty from "antd/es/empty";
import Grid from "antd/es/grid";
import Spin from "antd/es/spin";
import { useState, useMemo } from 'react';

import {
  RoastPlanDetail,
  RoastPlanFieldEditorDrawer,
  RoastPlanList,
  RoastPlanManualCreator,
  RoastPlanJsonImporter,
} from '@/modules/roast/components';
import {
  useRoastBatches,
  useRoastPlans,
  useRoastingMachines,
} from '@/modules/roast/hooks';
import { getEffectiveRoastPlanStatus } from '@/modules/roast/constants/roastPlanStatus';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { ViewportFloatingActionButton } from '@/shared/components/ViewportFloatingActionButton';
import { UnifiedSearchBar } from '@/shared/components/UnifiedSearchBar';
import { FilterSortToggle, MultiFilterSortBar, type MultiFilterDefinition } from '@/shared/components/MultiFilterSortBar';

import { matchesKeyword } from './RoastPage/planUtils';
import { sortPlans, type RoastPlanSortKey } from './RoastPage/planSorting';
import { getFilterOptions, type RoastPlanFilterKey } from './RoastPage/planFiltering';
import { usePlanDeletion } from './RoastPage/usePlanDeletion';
import { usePlanCreation } from './RoastPage/usePlanCreation';
import { usePlanUpdate } from './RoastPage/usePlanUpdate';
import { useCreationDrawer } from './RoastPage/useCreationDrawer';
import { useDetailDrawer } from './RoastPage/useDetailDrawer';
import styles from './RoastPage.module.css';

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

const getDetailDrawerTitle = (mode: 'view' | 'edit' | null): string => {
  if (mode === 'view') {
    return '烘焙计划详情';
  }

  if (mode === 'edit') {
    return '编辑烘焙计划';
  }

  return '';
};

export function RoastPage() {
  const { message, modal } = App.useApp();
  const screens = Grid.useBreakpoint();
  const [keyword, setKeyword] = useState('');
  const [filterValues, setFilterValues] = useState<Record<RoastPlanFilterKey, string[]>>({ bean: [], level: [], purpose: [] });
  const [sortKey, setSortKey] = useState<RoastPlanSortKey>('updatedDesc');
  const [isFilterPanelExpanded, setIsFilterPanelExpanded] = useState(false);
  const [isCreateActionSheetOpen, setIsCreateActionSheetOpen] = useState(false);

  const { data: plans = [], isFetching } = useRoastPlans();
  const { data: roastingMachines = [] } = useRoastingMachines();
  const createActionSheetHeight = 176;

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

  const {
    selectedPlanId,
    selectedPlanFieldPath,
    detailMode,
    handleView,
    handleEdit,
    handleEditAll,
    closeDetail,
  } = useDetailDrawer();

  const { handleDelete } = usePlanDeletion(message, modal, closeDetail);
  const { handleUpdate } = usePlanUpdate(message);

  const {
    creationDrawerOpen,
    creationMode,
    creationInitialValues,
    creationResetSignal,
    resetCreationDraft,
    handleFillFormFromJson,
    handleOpenCreationMode,
    closeCreationDrawer,
  } = useCreationDrawer(message, plans, roastingMachines);

  const { handleCreateManual } = usePlanCreation(message, () => {
    closeCreationDrawer();
    resetCreationDraft();
  });

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

  const handleOpenCreateDrawer = () => {
    resetCreationDraft();
    setIsCreateActionSheetOpen(true);
  };

  return (
    <main className={styles.page}>
      <h1 className="sr-only">烘焙计划</h1>
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


      {isFilterPanelExpanded ? (
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
      ) : null}

      {/* 计划列表 */}
      <section className={styles.list} aria-label="烘焙计划卡片区域">
        {isFetching && plans.length === 0 ? (
          <div className={styles.loading}>
            <Spin />
          </div>
        ) : null}

        {!isFetching && filteredPlans.length === 0 ? (
          <Empty className={styles.empty} description={keyword.trim() || Object.values(filterValues).some((values) => values.length > 0) ? '当前条件没有匹配的烘焙计划' : '没有匹配的烘焙计划'}>
            {keyword.trim() || Object.values(filterValues).some((values) => values.length > 0) ? <Button onClick={() => { setKeyword(''); setFilterValues({ bean: [], level: [], purpose: [] }); }}>清除筛选</Button> : null}
          </Empty>
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

      <AppDrawer
        closable={false}
        className={styles.actionSheet}
        destroyOnHidden
        height={createActionSheetHeight}
        onClose={() => {
          setIsCreateActionSheetOpen(false);
        }}
        open={isCreateActionSheetOpen}
        placement="bottom"
        showSwipeHandle={false}
        styles={actionSheetStyles}
        title="选择创建方式"
      >
        <div className={styles.actionSheetBody}>
          <div className={styles.actionSheetGroup}>
            <Button block className={styles.actionSheetButton} onClick={() => { handleOpenCreationMode('manual'); }}>
              手动创建
            </Button>
            <Button block className={styles.actionSheetButton} onClick={() => { handleOpenCreationMode('json'); }}>
              JSON 导入
            </Button>
          </div>
          <div aria-hidden="true" className={styles.actionSheetSpacer} />
          <div className={styles.actionSheetCancelGroup}>
            <Button
              aria-label="取消"
              block
              className={styles.actionSheetButton}
              onClick={() => {
                setIsCreateActionSheetOpen(false);
              }}
            >
              取消
            </Button>
          </div>
        </div>
      </AppDrawer>

      {/* 创建抽屉 */}
      <AppDrawer
        className={styles.creationDrawer}
        height="86dvh"
        onClose={closeCreationDrawer}
        open={creationDrawerOpen}
        placement="bottom"
        title={
          creationMode === 'manual'
            ? '新增烘焙计划'
            : 'JSON 导入'
        }
        headerActions={
          <>
            <Button aria-label="取消" className={styles.headerCancelButton} icon={<CloseOutlined />} onClick={closeCreationDrawer} shape="circle" />
            <Button aria-label={creationMode === 'manual' ? '创建烘焙计划' : '回填到表单'} className={styles.headerSubmitButton} icon={<CheckOutlined />} onClick={() => { document.querySelector<HTMLFormElement>('[data-app-drawer="true"][data-state="open"] form')?.requestSubmit(); }} shape="circle" />
          </>
        }
      >
        {creationMode === 'manual' ? (
          <RoastPlanManualCreator
            initialValues={creationInitialValues}
            onCancel={closeCreationDrawer}
            onCreate={handleCreateManual}
          />
        ) : null}
        {creationMode === 'json' ? (
          <RoastPlanJsonImporter
            onCancel={closeCreationDrawer}
            onImport={handleFillFormFromJson}
            resetSignal={creationResetSignal}
          />
        ) : null}
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
        headerActions={detailMode === 'edit' ? (
          <>
            <Button aria-label="取消" className={styles.headerCancelButton} icon={<CloseOutlined />} onClick={closeDetail} shape="circle" />
            <Button aria-label="保存计划" className={styles.headerSubmitButton} icon={<CheckOutlined />} onClick={() => { document.querySelector<HTMLFormElement>('[data-app-drawer="true"][data-state="open"] form')?.requestSubmit(); }} shape="circle" />
          </>
        ) : null}
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
