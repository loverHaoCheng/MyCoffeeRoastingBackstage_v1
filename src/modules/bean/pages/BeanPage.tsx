import DownOutlined from "@ant-design/icons/DownOutlined";
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import CheckOutlined from '@ant-design/icons/CheckOutlined';
import App from 'antd/es/app';
import Button from "antd/es/button";
import Empty from "antd/es/empty";
import Grid from "antd/es/grid";
import Radio from 'antd/es/radio';
import Spin from "antd/es/spin";
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  BeanCreationFlow,
  BeanDetailDrawer,
  BeanFieldEditorDrawer,
  BeanInventoryCard,
} from '@/modules/bean/components';
import { createDefaultBeanFormValues } from '@/modules/bean/constants';
import { beanQueryKeys, useBeans, useDeleteBean } from '@/modules/bean/hooks/useBeans';
import { beanService, type RoastPlanDisposition } from '@/modules/bean/services';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { ResponsiveMasonry } from '@/shared/components/ResponsiveMasonry';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';
import { UnifiedSearchBar } from '@/shared/components/UnifiedSearchBar';
import { FilterSortToggle, MultiFilterSortBar, type MultiFilterDefinition } from '@/shared/components/MultiFilterSortBar';
import type { Bean } from '@/types/domain';
import type { GreenBeanCreateInput } from '@/modules/bean/types';

import { matchesKeyword, getFilterOptions, getBeanRemainingWeightGrams } from './BeanPage/beanUtils';
import { sortBeans, type BeanSortKey } from './BeanPage/beanSorting';
import { useBeanCreation } from './BeanPage/useBeanCreation';
import { useBeanDeletion } from './BeanPage/useBeanDeletion';
import { useBeanDetailDrawer } from './BeanPage/useBeanDetailDrawer';
import styles from './BeanPage.module.css';

type BeanFilterKey = 'origin' | 'process';

const formatKg = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 1,
});

export function BeanPage() {
  const { message, modal } = App.useApp();
  const screens = Grid.useBreakpoint();
  const [keyword, setKeyword] = useState('');
  const [filterValues, setFilterValues] = useState<Record<BeanFilterKey, string[]>>({
    origin: [], process: [],
  });
  const [sortKey, setSortKey] = useState<BeanSortKey>('createdDesc');
  const [isFilterPanelExpanded, setIsFilterPanelExpanded] = useState(false);
  const [isZeroStockCollapsed, setIsZeroStockCollapsed] = useState(true);
  const { data: beans = [], isLoading } = useBeans();

  const { handleDeleteBean } = useBeanDeletion(message, modal, (bean, onDispositionChange) => (
    <div>
      <p>
        删除 {bean.name} 后，关联的采购批次、烘焙历史及其曲线都会永久删除，且无法复原。
      </p>
      <p>请选择关联烘焙计划的处理方式：</p>
      <Radio.Group
        aria-label="关联烘焙计划的处理方式"
        onChange={(event) => {
          onDispositionChange(event.target.value as RoastPlanDisposition);
        }}
      >
        <Radio value="makeGeneric">全部改为通用计划：保留计划并解除与当前生豆的关联</Radio>
        <Radio value="delete">全部删除：永久删除这些烘焙计划，且无法复原</Radio>
      </Radio.Group>
    </div>
  ));
  const { handleCreateBean } = useBeanCreation(message);
  const {
    selectedBean,
    selectedBeanId,
    selectedBeanFieldPath,
    detailMode,
    restockInitialValues,
    restockRequestKey,
    handleViewBean,
    handleEditBean,
    handleEditBeanAll,
    handleRestockBean,
    closeDetailDrawer,
  } = useBeanDetailDrawer(beans);

  const filterDefinitions = useMemo<MultiFilterDefinition[]>(() => [
    { key: 'process', label: '处理法', options: getFilterOptions(beans.map((bean) => bean.process)) },
    { key: 'origin', label: '产地', options: getFilterOptions(beans.map((bean) => bean.origin)) },
  ], [beans]);
  const filteredBeans = useMemo(() => {
    const matchingBeans = beans.filter((bean) => {
      return matchesKeyword(bean, keyword) &&
        (filterValues.process.length === 0 || filterValues.process.includes(bean.process)) &&
        (filterValues.origin.length === 0 || filterValues.origin.includes(bean.origin));
    });

    return sortBeans(matchingBeans, sortKey);
  }, [beans, filterValues, keyword, sortKey]);
  const activeBeans = useMemo(() => {
    return filteredBeans.filter((bean) => getBeanRemainingWeightGrams(bean) > 0);
  }, [filteredBeans]);
  const zeroStockBeans = useMemo(() => {
    return filteredBeans.filter((bean) => getBeanRemainingWeightGrams(bean) === 0);
  }, [filteredBeans]);
  const shouldShowEmptyState = activeBeans.length === 0 && zeroStockBeans.length === 0;
  const hasActiveFilters = keyword.trim().length > 0 || Object.values(filterValues).some((values) => values.length > 0);

  const summary = useMemo(() => {
    const totalRemainingStockKg = beans.reduce((total, bean) => total + bean.stockKg, 0);
    const weightedCostTotal = beans.reduce((total, bean) => total + bean.costPerKg * bean.stockKg, 0);
    const averageCost = totalRemainingStockKg > 0 ? weightedCostTotal / totalRemainingStockKg : 0;

    return {
      averageCost,
      totalRemainingStockKg,
    };
  }, [beans]);

  const isWide = screens.md ?? false;

  return (
    <main className={styles.page}>
      <h1 className="sr-only">生豆库存</h1>
      <UnifiedSearchBar
        className={styles.searchBar}
        inputAriaLabel="搜索生豆"
        onChange={(event) => {
          setKeyword(event.target.value);
        }}
        placeholder="搜索生豆、产地、处理法、风味"
        sectionAriaLabel="生豆库存筛选"
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
          setFilterValues({ origin: [], process: [] });
        }}
        onSortChange={(value) => {
          setSortKey(value as BeanSortKey);
        }}
        sortOptions={[
          { label: '最新创建', value: 'createdDesc' }, { label: '最早创建', value: 'createdAsc' },
          { label: '库存由多到少', value: 'stockDesc' }, { label: '库存由少到多', value: 'stockAsc' },
          { label: '成本由高到低', value: 'costDesc' }, { label: '成本由低到高', value: 'costAsc' },
        ]}
        sortValue={sortKey}
        values={filterValues}
      />

      <section className={styles.summaryGrid} aria-label="生豆库存概览">
        <article>
          <span>总剩余库存</span>
          <strong>{formatKg.format(summary.totalRemainingStockKg)} kg</strong>
        </article>
        <article>
          <span>均价</span>
          <strong>¥{summary.averageCost.toFixed(2)} / kg</strong>
        </article>
      </section>

      <section className={styles.list} aria-label="生豆库存列表">
        {isLoading && beans.length === 0 ? (
          <div className={styles.loading}>
            <Spin />
          </div>
        ) : null}

        {!isLoading && shouldShowEmptyState ? (
          <Empty className={styles.empty} description="没有匹配的生豆批次">
            {hasActiveFilters ? <><span>当前筛选条件没有结果</span><Button onClick={() => { setKeyword(''); setFilterValues({ origin: [], process: [] }); }}>清除筛选</Button></> : null}
          </Empty>
        ) : null}

        <ResponsiveMasonry ariaLabel="有库存生豆列表">
          {activeBeans.map((bean) => (
            <BeanInventoryCard
              bean={bean}
              key={bean.id}
              onDelete={() => {
                handleDeleteBean(bean);
              }}
              onEdit={handleEditBean}
              onEditAll={handleEditBeanAll}
              onRestock={handleRestockBean}
              onView={handleViewBean}
            />
          ))}
        </ResponsiveMasonry>

        {zeroStockBeans.length > 0 ? (
          <section
            className={styles.zeroStockSection}
            aria-label="零库存生豆折叠区"
            data-collapsed={isZeroStockCollapsed}
          >
            <Button
              className={styles.zeroStockToggleButton}
              aria-expanded={!isZeroStockCollapsed}
              aria-label="零库存生豆"
              onClick={() => {
                setIsZeroStockCollapsed((current) => !current);
              }}
              type="text"
            >
              <span className={styles.zeroStockToggleLabel}>零库存生豆</span>
              <span aria-hidden="true" className={styles.zeroStockToggleIcon}>
                <DownOutlined />
              </span>
            </Button>

            <div className={styles.zeroStockBody}>
              <div className={styles.zeroStockDivider} />

              <div
                className={styles.zeroStockPanel}
                aria-hidden={isZeroStockCollapsed}
                aria-label="零库存生豆列表"
              >
                <ResponsiveMasonry>
                  {zeroStockBeans.map((bean) => (
                    <BeanInventoryCard
                      bean={bean}
                      key={bean.id}
                      onDelete={() => {
                        handleDeleteBean(bean);
                      }}
                      onEdit={handleEditBean}
                      onEditAll={handleEditBeanAll}
                      onRestock={handleRestockBean}
                      onView={handleViewBean}
                    />
                  ))}
                </ResponsiveMasonry>
              </div>
            </div>
          </section>
        ) : null}
      </section>

      <BeanCreationFlow
        manualInitialValues={restockInitialValues}
        onCreate={handleCreateBean}
        openManualRequestKey={restockRequestKey}
      />

      <AppDrawer
        className={styles.detailDrawer}
        data-placement={isWide ? 'right' : 'bottom'}
        height={isWide ? undefined : '86dvh'}
        onClose={() => {
          closeDetailDrawer();
        }}
        open={
          selectedBean !== null &&
          (detailMode === 'view' || (detailMode === 'edit' && selectedBeanFieldPath == null))
        }
        placement={isWide ? 'right' : 'bottom'}
        title={detailMode === 'edit' ? '编辑生豆' : '查看生豆详情'}
        headerActions={detailMode === 'edit' ? (
          <>
            <Button aria-label="取消" className={styles.headerCancelButton} icon={<CloseOutlined />} onClick={closeDetailDrawer} shape="circle" />
            <Button aria-label="保存生豆" className={styles.headerSubmitButton} icon={<CheckOutlined />} onClick={() => { document.querySelector<HTMLFormElement>('[data-app-drawer="true"][data-state="open"] form')?.requestSubmit(); }} shape="circle" />
          </>
        ) : null}
        width={720}
      >
        {selectedBean && (detailMode === 'view' || (detailMode === 'edit' && selectedBeanFieldPath == null)) ? (
          <BeanDetailDrawer
            bean={selectedBean}
            focusFieldPath={selectedBeanFieldPath}
            mode={detailMode}
            onClose={closeDetailDrawer}
          />
        ) : null}
      </AppDrawer>

      <BeanFieldEditorDrawer
        bean={selectedBean}
        fieldPath={selectedBeanFieldPath}
        height={isWide ? undefined : '360px'}
        onClose={closeDetailDrawer}
        open={selectedBean != null && detailMode === 'edit' && selectedBeanFieldPath != null}
        placement={isWide ? 'right' : 'bottom'}
        width={720}
      />
    </main>
  );
}
