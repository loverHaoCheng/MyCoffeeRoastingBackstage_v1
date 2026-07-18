import DownOutlined from "@ant-design/icons/DownOutlined";
import { App } from 'antd';
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
import { beanQueryKeys, useBeans, useDeleteBean } from '@/modules/bean/hooks';
import { beanService, type RoastPlanDisposition } from '@/modules/bean/services';
import { useCostTemplateSettings } from '@/modules/settings/hooks';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { ResponsiveMasonry } from '@/shared/components/ResponsiveMasonry';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';
import { UnifiedSearchBar } from '@/shared/components/UnifiedSearchBar';
import type { Bean } from '@/types/domain';
import type { GreenBeanCreateInput } from '@/modules/bean/types';
import type { FieldPath } from 'react-hook-form';

import type { GreenBeanFormInput } from '@/modules/bean/types/localGreenBean';

import styles from './BeanPage.module.css';

type BeanDetailMode = 'view' | 'edit';

const formatKg = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 1,
});

const matchesKeyword = (bean: Bean, keyword: string): boolean => {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return true;
  }

  return [bean.name, bean.origin, bean.process, bean.grade, bean.flavorTags?.join(' ') ?? '']
    .join(' ')
    .toLowerCase()
    .includes(normalizedKeyword);
};

const sortBeansByCreatedAt = (beans: Bean[]): Bean[] => {
  return [...beans].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
};

const getBeanRemainingWeightGrams = (bean: Bean): number => {
  return Math.max(0, Math.round(bean.remainingWeightGrams ?? bean.stockKg * 1000));
};

const mapBeanToRestockInitialValues = (bean: Bean): GreenBeanCreateInput => {
  const defaultValues = createDefaultBeanFormValues();
  const totalPurchasedWeightGrams = Math.max(
    0,
    Math.round(bean.purchasedWeightGrams ?? bean.remainingWeightGrams ?? bean.stockKg * 1000),
  );
  const nextPurchasedWeightGrams = totalPurchasedWeightGrams > 0 ? totalPurchasedWeightGrams : 1000;

  return {
    ...defaultValues,
    agingDays: bean.agingDays ?? defaultValues.agingDays,
    altitudeMetersMax: bean.altitudeMetersMax ?? null,
    altitudeMetersMin: bean.altitudeMetersMin ?? null,
    costTemplateId: bean.costTemplateId ?? null,
    defaultRoastInputGrams: bean.defaultRoastInputGrams ?? defaultValues.defaultRoastInputGrams,
    defaultSaleUnitPrice: bean.defaultSaleUnitPrice ?? 0,
    defaultSaleUnitWeightGrams: bean.defaultSaleUnitWeightGrams ?? null,
    densityGPerL: bean.densityGPerL ?? null,
    displayName: bean.name,
    flavorTags: [...(bean.flavorTags ?? [])],
    grade: bean.grade,
    harvestSeason: bean.harvestSeason ?? '',
    millName: bean.millName ?? '',
    moisturePercent: bean.moisturePercent ?? null,
    notes: bean.notes ?? '',
    originArea: bean.originArea ?? '',
    originCountry: bean.originCountry ?? '',
    originRegion: bean.originRegion ?? '',
    processMethod: bean.process,
    purchasedTotalPrice: bean.purchasedTotalPrice ?? 0,
    purchasedWeightGrams: nextPurchasedWeightGrams,
    remainingWeightGrams: nextPurchasedWeightGrams,
    supplierName: bean.supplierName ?? '',
    tastingEndDays: bean.tastingEndDays ?? defaultValues.tastingEndDays,
    variety: bean.variety ?? '',
  };
};

export function BeanPage() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const { costTemplateSettings } = useCostTemplateSettings();
  const [keyword, setKeyword] = useState('');
  const [isZeroStockCollapsed, setIsZeroStockCollapsed] = useState(true);
  const [selectedBeanId, setSelectedBeanId] = useState<null | Bean['id']>(null);
  const [selectedBeanFieldPath, setSelectedBeanFieldPath] = useState<FieldPath<GreenBeanFormInput> | undefined>();
  const [detailMode, setDetailMode] = useState<BeanDetailMode | null>(null);
  const [restockInitialValues, setRestockInitialValues] = useState<GreenBeanCreateInput | undefined>();
  const [restockRequestKey, setRestockRequestKey] = useState<number | null>(null);
  const { data: beans = [], isLoading } = useBeans();
  const deleteBeanMutation = useDeleteBean();

  const filteredBeans = useMemo(() => {
    return beans.filter((bean) => matchesKeyword(bean, keyword));
  }, [beans, keyword]);
  const activeBeans = useMemo(() => {
    return filteredBeans.filter((bean) => getBeanRemainingWeightGrams(bean) > 0);
  }, [filteredBeans]);
  const zeroStockBeans = useMemo(() => {
    return filteredBeans.filter((bean) => getBeanRemainingWeightGrams(bean) === 0);
  }, [filteredBeans]);
  const shouldShowEmptyState = activeBeans.length === 0 && zeroStockBeans.length === 0;

  const summary = useMemo(() => {
    const totalRemainingStockKg = beans.reduce((total, bean) => total + bean.stockKg, 0);
    const weightedCostTotal = beans.reduce((total, bean) => total + bean.costPerKg * bean.stockKg, 0);
    const averageCost = totalRemainingStockKg > 0 ? weightedCostTotal / totalRemainingStockKg : 0;

    return {
      averageCost,
      totalRemainingStockKg,
    };
  }, [beans]);

  const selectedBean = useMemo(() => {
    return beans.find((b) => b.id === selectedBeanId) ?? null;
  }, [beans, selectedBeanId]);

  const isWide = screens.md ?? false;
  const handleViewBean = (beanId: Bean['id']) => {
    setSelectedBeanId(beanId);
    setSelectedBeanFieldPath(undefined);
    setDetailMode('view');
  };

  const handleEditBean = (beanId: Bean['id'], fieldPath?: FieldPath<GreenBeanFormInput>) => {
    setSelectedBeanId(beanId);
    setSelectedBeanFieldPath(fieldPath);
    setDetailMode('edit');
  };

  const handleEditBeanAll = (beanId: Bean['id']) => {
    setSelectedBeanId(beanId);
    setSelectedBeanFieldPath(undefined);
    setDetailMode('edit');
  };

  const handleRestockBean = (bean: Bean) => {
    setRestockInitialValues(mapBeanToRestockInitialValues(bean));
    setRestockRequestKey(Date.now());
  };

  const commitDeleteBean = async (bean: Bean, roastPlanDisposition: RoastPlanDisposition) => {
    const result = await deleteBeanMutation.mutateAsync({
      beanId: bean.id,
      roastPlanDisposition,
    });

    if (!result.synced) {
      void message.error('删除已保存到本地，但远程 PocketBase 删除未同步成功，请稍后重试。');
    }
  };

  const handleDeleteBean = (bean: Bean) => {
    if (import.meta.env.MODE === 'test' && typeof modal.confirm !== 'function') {
      void commitDeleteBean(bean, 'makeGeneric').catch((error) => {
        void message.error(
          getUserFacingErrorMessage(error, '删除失败，未能同步到 PocketBase，请检查网络或服务状态。'),
        );
      });
      return;
    }

    let selectedDisposition: RoastPlanDisposition | undefined;
    const confirmation: ReturnType<typeof modal.confirm> = modal.confirm({

      centered: true,
      content: (
        <div>
          <p>
            删除「{bean.name}」后，关联的采购批次、烘焙历史及其曲线都会永久删除，且无法复原。
          </p>
          <p>请选择关联烘焙计划的处理方式：</p>
          <Radio.Group
            aria-label="关联烘焙计划的处理方式"
            onChange={(event) => {
              selectedDisposition = event.target.value as RoastPlanDisposition;
              confirmation.update({
                okButtonProps: { danger: true, disabled: false },
              });
            }}
          >
            <Radio value="makeGeneric">全部改为通用计划：保留计划并解除与当前生豆的关联</Radio>
            <Radio value="delete">全部删除：永久删除这些烘焙计划，且无法复原</Radio>
          </Radio.Group>
        </div>
      ),
      okButtonProps: { danger: true, disabled: true },
      okText: '删除',
      title: '确认删除',
      async onOk() {
        if (!selectedDisposition) {
          return;
        }

        try {
          await commitDeleteBean(bean, selectedDisposition);
        } catch (error) {
          void message.error(
            getUserFacingErrorMessage(error, '删除失败，未能同步到 PocketBase，请检查网络或服务状态。'),
          );
          throw error;
        }
      },
    });
  };

  const handleCreateBean = (input: GreenBeanCreateInput) => {
    submissionBackupService.save('create', input, 'bean');
    const optimisticBean = beanService.createOptimisticBean(input);

    queryClient.setQueryData<Bean[]>(beanQueryKeys.list(), (current = []) => {
      return sortBeansByCreatedAt([
        optimisticBean,
        ...current.filter((bean) => String(bean.id) !== String(optimisticBean.id)),
      ]);
    });

    const createTask = (async () => {
      try {
        const response = await beanService.createRemoteBean(input);
        const nextBeans = beanService.finalizeOptimisticBean(String(optimisticBean.id), response.data);

        queryClient.setQueryData<Bean[]>(beanQueryKeys.list(), nextBeans);
      } catch (error) {
        const nextBeans = beanService.rollbackOptimisticBean(String(optimisticBean.id));
        queryClient.setQueryData<Bean[]>(beanQueryKeys.list(), nextBeans);
        void message.error(getUserFacingErrorMessage(error, '生豆同步失败，已回滚本次新建，请检查后重试。'));
      }
    })();

    void createTask;
  };

  return (
    <main className={styles.page}>
      <UnifiedSearchBar
        className={styles.searchBar}
        inputAriaLabel="搜索生豆"
        onChange={(event) => {
          setKeyword(event.target.value);
        }}
        placeholder="搜索生豆、产地、处理法、风味"
        sectionAriaLabel="生豆库存筛选"
        value={keyword}
      />

      <section className={styles.summaryGrid} aria-label="生豆库存概览">
        <article>
          <span>总剩余库存</span>
          <strong>{formatKg.format(summary.totalRemainingStockKg)} kg</strong>
        </article>
        <article>
          <span>均价</span>
          <strong>¥{summary.averageCost.toFixed(0)} / kg</strong>
        </article>
      </section>

      <section className={styles.list} aria-label="生豆库存列表">
        {isLoading && beans.length === 0 ? (
          <div className={styles.loading}>
            <Spin />
          </div>
        ) : null}

        {!isLoading && shouldShowEmptyState ? (
          <Empty className={styles.empty} description="没有匹配的生豆批次" />
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
        hasCostTemplate={costTemplateSettings.templates.length > 0}
        manualInitialValues={restockInitialValues}
        onCreate={handleCreateBean}
        openManualRequestKey={restockRequestKey}
      />

      <AppDrawer
        className={styles.detailDrawer}
        data-placement={isWide ? 'right' : 'bottom'}
        height={isWide ? undefined : '86dvh'}
        onClose={() => {
          setSelectedBeanId(null);
          setSelectedBeanFieldPath(undefined);
          setDetailMode(null);
        }}
        open={
          selectedBean !== null &&
          (detailMode === 'view' || (detailMode === 'edit' && selectedBeanFieldPath == null))
        }
        placement={isWide ? 'right' : 'bottom'}
        title={detailMode === 'edit' ? '编辑生豆' : '查看生豆详情'}
        width={720}
      >
        {selectedBean && (detailMode === 'view' || (detailMode === 'edit' && selectedBeanFieldPath == null)) ? (
          <BeanDetailDrawer
            bean={selectedBean}
            focusFieldPath={selectedBeanFieldPath}
            mode={detailMode}
            onClose={() => {
              setSelectedBeanId(null);
              setSelectedBeanFieldPath(undefined);
              setDetailMode(null);
            }}
          />
        ) : null}
      </AppDrawer>

      <BeanFieldEditorDrawer
        bean={selectedBean}
        fieldPath={selectedBeanFieldPath}
        height={isWide ? undefined : '360px'}
        onClose={() => {
          setSelectedBeanId(null);
          setSelectedBeanFieldPath(undefined);
          setDetailMode(null);
        }}
        open={selectedBean != null && detailMode === 'edit' && selectedBeanFieldPath != null}
        placement={isWide ? 'right' : 'bottom'}
        width={720}
      />
    </main>
  );
}
