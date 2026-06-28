import { SearchOutlined, SyncOutlined } from '@ant-design/icons';
import { Button, Empty, Input, Segmented, Spin } from 'antd';
import { useMemo, useState } from 'react';

import { BeanInventoryCard } from '@/modules/bean/components';
import { useBeans } from '@/modules/bean/hooks';
import type { Bean } from '@/types/domain';

import styles from './BeanPage.module.css';

type BeanFilter = 'all' | 'low' | 'washed' | 'natural';

const filterOptions: { label: string; value: BeanFilter }[] = [
  { label: '全部', value: 'all' },
  { label: '低库存', value: 'low' },
  { label: '水洗', value: 'washed' },
  { label: '日晒', value: 'natural' },
];

const formatKg = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 1,
});

const matchesFilter = (bean: Bean, filter: BeanFilter): boolean => {
  if (filter === 'low') {
    return bean.stockKg <= 20;
  }

  if (filter === 'washed') {
    return bean.process.includes('水洗');
  }

  if (filter === 'natural') {
    return bean.process.includes('日晒');
  }

  return true;
};

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
  const [filter, setFilter] = useState<BeanFilter>('all');
  const [keyword, setKeyword] = useState('');
  const { data: beans = [], isFetching, refetch } = useBeans();

  const filteredBeans = useMemo(() => {
    return beans.filter((bean) => matchesFilter(bean, filter) && matchesKeyword(bean, keyword));
  }, [beans, filter, keyword]);

  const summary = useMemo(() => {
    const totalStockKg = beans.reduce((total, bean) => total + bean.stockKg, 0);
    const lowStockCount = beans.filter((bean) => bean.stockKg <= 20).length;
    const averageCost =
      beans.length > 0 ? beans.reduce((total, bean) => total + bean.costPerKg, 0) / beans.length : 0;

    return {
      averageCost,
      lowStockCount,
      totalStockKg,
    };
  }, [beans]);

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div>
          <h1>生豆库存</h1>
          <p>按产地、处理法和库存状态管理生豆批次。</p>
        </div>
        <Button
          aria-label="同步生豆数据"
          className={styles.syncButton}
          icon={<SyncOutlined spin={isFetching} />}
          onClick={() => {
            void refetch();
          }}
          shape="circle"
        />
      </section>

      <section className={styles.summaryGrid} aria-label="生豆库存概览">
        <article>
          <span>总库存</span>
          <strong>{formatKg.format(summary.totalStockKg)} kg</strong>
        </article>
        <article>
          <span>在库批次</span>
          <strong>{String(beans.length)}</strong>
        </article>
        <article>
          <span>低库存</span>
          <strong>{String(summary.lowStockCount)}</strong>
        </article>
        <article>
          <span>均价</span>
          <strong>¥{summary.averageCost.toFixed(0)} / kg</strong>
        </article>
      </section>

      <section className={styles.toolbar} aria-label="生豆库存筛选">
        <Input
          allowClear
          aria-label="搜索生豆"
          onChange={(event) => {
            setKeyword(event.target.value);
          }}
          placeholder="搜索生豆、产地、处理法"
          prefix={<SearchOutlined />}
          value={keyword}
        />
        <Segmented<BeanFilter> block onChange={setFilter} options={filterOptions} value={filter} />
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
          <BeanInventoryCard bean={bean} key={bean.id} />
        ))}
      </section>
    </main>
  );
}
