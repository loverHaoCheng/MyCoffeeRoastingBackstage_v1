import { DownOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Drawer, Empty, Grid, Spin, Tabs } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { refreshAllAppData } from '@/app/services/appDataRefresh.service';
import { BeanAiRecognitionPlaceholder, BeanDetailDrawer, BeanInventoryCard, BeanManualCreator } from '@/modules/bean/components';
import { beanQueryKeys, useBeans } from '@/modules/bean/hooks';
import { beanService } from '@/modules/bean/services';
import { useCostTemplateSettings, useSupabaseConnectionSettings } from '@/modules/settings/hooks';
import { ViewportFloatingActionButton } from '@/shared/components/ViewportFloatingActionButton';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';
import { UnifiedSearchBar } from '@/shared/components/UnifiedSearchBar';
import { logger } from '@/shared/logger/logger';
import type { Bean } from '@/types/domain';
import type { GreenBeanCreateInput } from '@/modules/bean/types';

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

  return [bean.name, bean.origin, bean.process, bean.grade]
    .join(' ')
    .toLowerCase()
    .includes(normalizedKeyword);
};

const sortBeansByUpdatedAt = (beans: Bean[]): Bean[] => {
  return [...beans].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
};

export function BeanPage() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const { costTemplateSettings } = useCostTemplateSettings();
  const { supabaseConnections } = useSupabaseConnectionSettings();
  const [creationDrawerOpen, setCreationDrawerOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [isZeroStockCollapsed, setIsZeroStockCollapsed] = useState(true);
  const [selectedBeanId, setSelectedBeanId] = useState<null | Bean['id']>(null);
  const [detailMode, setDetailMode] = useState<BeanDetailMode | null>(null);
  const { data: beans = [], isFetching, refetch } = useBeans();

  const filteredBeans = useMemo(() => {
    return beans.filter((bean) => matchesKeyword(bean, keyword));
  }, [beans, keyword]);
  const activeBeans = useMemo(() => {
    return filteredBeans.filter((bean) => bean.stockKg > 0);
  }, [filteredBeans]);
  const zeroStockBeans = useMemo(() => {
    return filteredBeans.filter((bean) => bean.stockKg === 0);
  }, [filteredBeans]);
  const shouldShowEmptyState = activeBeans.length === 0 && zeroStockBeans.length === 0;

  const summary = useMemo(() => {
    const totalRemainingStockKg = beans.reduce((total, bean) => total + bean.stockKg, 0);
    const averageCost =
      beans.length > 0 ? beans.reduce((total, bean) => total + bean.costPerKg, 0) / beans.length : 0;

    return {
      averageCost,
      totalRemainingStockKg,
    };
  }, [beans]);

  const selectedBean = useMemo(() => {
    return beans.find((b) => b.id === selectedBeanId) ?? null;
  }, [beans, selectedBeanId]);

  const isWide = screens.md ?? false;
  const hasGreenBeanConnection =
    supabaseConnections.greenBean.projectUrl.trim().length > 0 &&
    supabaseConnections.greenBean.publishableKey.trim().length > 0;

  // 网络恢复时自动同步待处理操作
  useEffect(() => {
    const handleOnline = async () => {
      try {
        const result = await beanService.syncPendingOperations();
        if (result.success > 0) {
          void message.success(`已同步 ${result.success} 条待处理操作`);
          await refetch();
        }
        if (result.failed > 0) {
          void message.warning(`${result.failed} 条操作同步失败，将在下次联网时重试`);
        }
      } catch (error) {
        logger.error('bean page pending sync failed', { error });
      }
    };

    window.addEventListener('online', handleOnline);

    // 组件加载时如果有网络，也尝试同步一次
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [refetch]);

  const handleViewBean = (beanId: Bean['id']) => {
    setSelectedBeanId(beanId);
    setDetailMode('view');
  };

  const handleEditBean = (beanId: Bean['id']) => {
    setSelectedBeanId(beanId);
    setDetailMode('edit');
  };

  const handleDeleteBean = (bean: Bean) => {
    modal.confirm({
      centered: true,
      content: `确定要删除「${bean.name}」吗？此操作不可撤销，关联的采购批次、烘焙记录等数据将一并删除。`,
      okButtonProps: { danger: true },
      okText: '删除',
      title: '确认删除',
      async onOk() {
        try {
          await beanService.deleteBean(bean.id);
          await queryClient.invalidateQueries({ queryKey: beanQueryKeys.list() });
          void message.success('生豆已删除');
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : '删除失败';
          message.error(msg);
        }
      },
    });
  };

  const handleCreateBean = (input: GreenBeanCreateInput) => {
    setCreationDrawerOpen(false);
    submissionBackupService.save('create', input, 'bean');
    const optimisticBean = beanService.createOptimisticBean(input);

    queryClient.setQueryData<Bean[]>(beanQueryKeys.list(), (current = []) => {
      return sortBeansByUpdatedAt([optimisticBean, ...current.filter((bean) => String(bean.id) !== String(optimisticBean.id))]);
    });

    void (async () => {
      try {
        const response = await beanService.createRemoteBean(input);
        const nextBeans = beanService.finalizeOptimisticBean(String(optimisticBean.id), response.data);

        queryClient.setQueryData<Bean[]>(beanQueryKeys.list(), nextBeans);
        void refreshAllAppData(queryClient).catch(() => undefined);
      } catch (error) {
        const nextBeans = beanService.rollbackOptimisticBean(String(optimisticBean.id));
        queryClient.setQueryData<Bean[]>(beanQueryKeys.list(), nextBeans);
        const errorMessage = error instanceof Error ? error.message : '生豆同步失败，本地已备份。';
        void message.error(errorMessage);
      }
    })();
  };

  const handleOpenCreateDrawer = () => {
    if (!hasGreenBeanConnection) {
      void message.warning('请先前往设置页创建并连接生豆数据库，完成后才能新增数据。');
      return;
    }

    if (costTemplateSettings.templates.length === 0) {
      void message.warning('请先前往设置页创建至少一个成本模板，再新增生豆。');
      return;
    }

    setCreationDrawerOpen(true);
  };

  return (
    <main className={styles.page}>
      <UnifiedSearchBar
        className={styles.searchBar}
        inputAriaLabel="搜索生豆"
        onChange={(event) => {
          setKeyword(event.target.value);
        }}
        placeholder="搜索生豆、产地、处理法"
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
        {isFetching && beans.length === 0 ? (
          <div className={styles.loading}>
            <Spin />
          </div>
        ) : null}

        {!isFetching && shouldShowEmptyState ? (
          <Empty className={styles.empty} description="没有匹配的生豆批次" />
        ) : null}

        {activeBeans.map((bean) => (
          <BeanInventoryCard
            bean={bean}
            key={bean.id}
            onDelete={() => handleDeleteBean(bean)}
            onEdit={handleEditBean}
            onView={handleViewBean}
          />
        ))}

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
                <div className={styles.list}>
                  {zeroStockBeans.map((bean) => (
                    <BeanInventoryCard
                      bean={bean}
                      key={bean.id}
                      onDelete={() => handleDeleteBean(bean)}
                      onEdit={handleEditBean}
                      onView={handleViewBean}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </section>

      <ViewportFloatingActionButton
        ariaLabel="新增生豆"
        icon={<PlusOutlined />}
        onClick={handleOpenCreateDrawer}
      />

      <Drawer
        className={styles.creationDrawer}
        height="84dvh"
        onClose={() => {
          setCreationDrawerOpen(false);
        }}
        open={creationDrawerOpen}
        placement="bottom"
        title="新增生豆"
      >
        <Tabs
          defaultActiveKey="manual"
          items={[
            {
              key: 'manual',
              label: '界面创建',
              children: (
                <BeanManualCreator
                  onCancel={() => setCreationDrawerOpen(false)}
                  onCreate={(input) => void handleCreateBean(input)}
                />
              ),
            },
            {
              key: 'ai',
              label: 'AI 图片识别',
              children: <BeanAiRecognitionPlaceholder />,
            },
          ]}
        />
      </Drawer>

      <Drawer
        className={styles.detailDrawer}
        data-placement={isWide ? 'right' : 'bottom'}
        height={isWide ? undefined : '86dvh'}
        onClose={() => {
          setSelectedBeanId(null);
          setDetailMode(null);
        }}
        open={selectedBean !== null && detailMode !== null}
        placement={isWide ? 'right' : 'bottom'}
        title={detailMode === 'view' ? '查看生豆详情' : '编辑生豆'}
        width={720}
      >
        {selectedBean && detailMode ? (
          <BeanDetailDrawer
            bean={selectedBean}
            mode={detailMode}
            onClose={() => {
              setSelectedBeanId(null);
              setDetailMode(null);
            }}
            onUpdate={() => {
              void refetch();
            }}
          />
        ) : null}
      </Drawer>
    </main>
  );
}
