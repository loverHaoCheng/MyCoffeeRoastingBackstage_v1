import { DownOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Empty, Grid, Spin, Tabs } from 'antd';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  BeanAiRecognitionPlaceholder,
  BeanDetailDrawer,
  BeanFieldEditorDrawer,
  BeanInventoryCard,
  BeanManualCreator,
} from '@/modules/bean/components';
import { beanQueryKeys, useBeans, useDeleteBean } from '@/modules/bean/hooks';
import { beanService } from '@/modules/bean/services';
import { useCostTemplateSettings, usePocketBaseConnectionSettings } from '@/modules/settings/hooks';
import { isPocketBaseProjectConnectionConfigured } from '@/modules/settings/types';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { AppError } from '@/shared/errors/AppError';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { ViewportFloatingActionButton } from '@/shared/components/ViewportFloatingActionButton';
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

export function BeanPage() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const { costTemplateSettings } = useCostTemplateSettings();
  const { pocketBaseConnections } = usePocketBaseConnectionSettings();
  const [creationDrawerOpen, setCreationDrawerOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [isZeroStockCollapsed, setIsZeroStockCollapsed] = useState(true);
  const [selectedBeanId, setSelectedBeanId] = useState<null | Bean['id']>(null);
  const [selectedBeanFieldPath, setSelectedBeanFieldPath] = useState<FieldPath<GreenBeanFormInput> | undefined>();
  const [detailMode, setDetailMode] = useState<BeanDetailMode | null>(null);
  const { data: beans = [], isFetching } = useBeans();
  const deleteBeanMutation = useDeleteBean();

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
  const hasGreenBeanConnection = isPocketBaseProjectConnectionConfigured(pocketBaseConnections.greenBean);

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

  const handleDeleteBean = (bean: Bean) => {
    modal.confirm({
      centered: true,
      content: `确定要删除「${bean.name}」吗？此操作不可撤销，关联的采购批次、烘焙记录等数据将一并删除。`,
      okButtonProps: { danger: true },
      okText: '删除',
      title: '确认删除',
      onOk() {
        void deleteBeanMutation
          .mutateAsync(bean.id)
          .then((result) => {
            if (!result.synced) {
              void message.error('删除已保存到本地，但远程 PocketBase 删除未同步成功，请稍后重试。');
            }
          })
          .catch((error: unknown) => {
            void message.error(
              getUserFacingErrorMessage(error, '删除失败，未能同步到 PocketBase，请检查网络或服务状态。'),
            );
          });
      },
    });
  };

  const handleCreateBean = (input: GreenBeanCreateInput) => {
    setCreationDrawerOpen(false);
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
        if (
          error instanceof AppError &&
          (error.code === 'NETWORK' || (error.code === 'HTTP' && error.status === 404))
        ) {
          const nextBeans = beanService.persistOptimisticBeanAsPending(input);
          queryClient.setQueryData<Bean[]>(beanQueryKeys.list(), nextBeans);
          void message.warning('PocketBase 暂未就绪，已先保存到本地，待连接恢复后会自动同步。');
          return;
        }

        const nextBeans = beanService.rollbackOptimisticBean(String(optimisticBean.id));
        queryClient.setQueryData<Bean[]>(beanQueryKeys.list(), nextBeans);
        void message.error(getUserFacingErrorMessage(error, '生豆同步失败，已回滚本次新建，请检查后重试。'));
      }
    })();

    void createTask;
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
            onDelete={() => {
              handleDeleteBean(bean);
            }}
            onEdit={handleEditBean}
            onEditAll={handleEditBeanAll}
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
                      onDelete={() => {
                        handleDeleteBean(bean);
                      }}
                      onEdit={handleEditBean}
                      onEditAll={handleEditBeanAll}
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

      <AppDrawer
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
                  onCancel={() => {
                    setCreationDrawerOpen(false);
                  }}
                  onCreate={(input) => {
                    handleCreateBean(input);
                  }}
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
      </AppDrawer>

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

      {selectedBean && detailMode === 'edit' && selectedBeanFieldPath != null ? (
        <BeanFieldEditorDrawer
          bean={selectedBean}
          fieldPath={selectedBeanFieldPath}
          height={isWide ? undefined : '360px'}
          onClose={() => {
            setSelectedBeanId(null);
            setSelectedBeanFieldPath(undefined);
            setDetailMode(null);
          }}
          open
          placement={isWide ? 'right' : 'bottom'}
          width={720}
        />
      ) : null}
    </main>
  );
}
