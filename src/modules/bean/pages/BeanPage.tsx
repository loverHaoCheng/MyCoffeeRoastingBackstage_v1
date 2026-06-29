import { LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Drawer, Empty, Grid, Spin, Tabs } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { BeanAiRecognitionPlaceholder, BeanDetailDrawer, BeanInventoryCard, BeanManualCreator } from '@/modules/bean/components';
import { beanQueryKeys, useBeans } from '@/modules/bean/hooks';
import { beanService } from '@/modules/bean/services';
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

export function BeanPage() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const [creationDrawerOpen, setCreationDrawerOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [selectedBeanId, setSelectedBeanId] = useState<null | Bean['id']>(null);
  const [detailMode, setDetailMode] = useState<BeanDetailMode | null>(null);
  const { data: beans = [], isFetching, refetch } = useBeans();
  const touchStartYRef = useRef<number | null>(null);
  const pullTriggeredRef = useRef(false);

  const filteredBeans = useMemo(() => {
    return beans.filter((bean) => matchesKeyword(bean, keyword));
  }, [beans, keyword]);

  const summary = useMemo(() => {
    const totalStockKg = beans.reduce((total, bean) => total + bean.stockKg, 0);
    const averageCost =
      beans.length > 0 ? beans.reduce((total, bean) => total + bean.costPerKg, 0) / beans.length : 0;

    return {
      averageCost,
      totalStockKg,
    };
  }, [beans]);

  const selectedBean = useMemo(() => {
    return beans.find((b) => b.id === selectedBeanId) ?? null;
  }, [beans, selectedBeanId]);

  const isWide = screens.md ?? false;

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

  const canTriggerPullRefresh = (): boolean => {
    return window.scrollY <= 0 && !isFetching && !isPullRefreshing;
  };

  const handlePullRefresh = async () => {
    setIsPullRefreshing(true);

    try {
      await refetch();
    } finally {
      touchStartYRef.current = null;
      setIsPullRefreshing(false);
      setPullDistance(0);
      pullTriggeredRef.current = false;
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (!canTriggerPullRefresh()) {
      touchStartYRef.current = null;
      return;
    }

    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    if (touchStartYRef.current == null || pullTriggeredRef.current || window.scrollY > 0) {
      return;
    }

    const currentY = event.touches[0]?.clientY ?? touchStartYRef.current;
    const deltaY = Math.max(0, currentY - touchStartYRef.current);

    if (deltaY <= 0) {
      setPullDistance(0);
      return;
    }

    setPullDistance(Math.min(deltaY * 0.45, 84));
  };

  const handleTouchEnd = () => {
    if (pullDistance >= 52 && !pullTriggeredRef.current) {
      pullTriggeredRef.current = true;
      void handlePullRefresh();
      return;
    }

    touchStartYRef.current = null;
    setPullDistance(0);
  };

  const handleCreateBean = async (input: GreenBeanCreateInput) => {
    await beanService.createBean(input);
    setCreationDrawerOpen(false);
    await queryClient.invalidateQueries({
      queryKey: beanQueryKeys.list(),
    });
    void message.success('生豆已加入库存列表');
  };

  return (
    <main
      className={styles.page}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
    >
      <section
        aria-hidden="true"
        className={styles.pullRefreshDock}
        data-active={pullDistance > 0 || isPullRefreshing}
        data-ready={pullDistance >= 52}
      >
        <div className={styles.pullRefreshIndicator} style={{ transform: `translateY(${Math.max(pullDistance - 18, 0)}px)` }}>
          {isPullRefreshing ? <LoadingOutlined spin /> : <span className={styles.pullRefreshArrow}>↓</span>}
          <span>{isPullRefreshing ? '正在同步生豆数据' : pullDistance >= 52 ? '松开即可刷新' : '下拉刷新生豆数据'}</span>
        </div>
      </section>

      <UnifiedSearchBar
        inputAriaLabel="搜索生豆"
        onChange={(event) => {
          setKeyword(event.target.value);
        }}
        placeholder="搜索生豆、产地、处理法"
        sectionAriaLabel="生豆库存搜索"
        value={keyword}
      />

      <section className={styles.summaryGrid} aria-label="生豆库存概览">
        <article>
          <span>总库存</span>
          <strong>{formatKg.format(summary.totalStockKg)} kg</strong>
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

        {!isFetching && filteredBeans.length === 0 ? (
          <Empty className={styles.empty} description="没有匹配的生豆批次" />
        ) : null}

        {filteredBeans.map((bean) => (
          <BeanInventoryCard
            bean={bean}
            key={bean.id}
            onDelete={() => handleDeleteBean(bean)}
            onEdit={handleEditBean}
            onView={handleViewBean}
          />
        ))}
      </section>

      <Button
        aria-label="新增生豆"
        className={styles.fab}
        icon={<PlusOutlined />}
        onClick={() => {
          setCreationDrawerOpen(true);
        }}
        shape="circle"
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
              children: <BeanManualCreator onCreate={(input) => void handleCreateBean(input)} />,
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
