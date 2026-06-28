import type { Bean } from '@/types/domain';

import styles from './BeanInventoryCard.module.css';

type StockTone = 'stable' | 'watch' | 'low';

interface BeanInventoryCardProps {
  bean: Bean;
}

const formatKg = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 1,
});

const formatCurrency = new Intl.NumberFormat('zh-CN', {
  currency: 'CNY',
  maximumFractionDigits: 0,
  style: 'currency',
});

const getStockTone = (stockKg: number): StockTone => {
  if (stockKg <= 20) {
    return 'low';
  }

  if (stockKg <= 40) {
    return 'watch';
  }

  return 'stable';
};

const getStockText = (tone: StockTone): string => {
  if (tone === 'low') {
    return '低库存';
  }

  if (tone === 'watch') {
    return '关注';
  }

  return '充足';
};

export function BeanInventoryCard({ bean }: BeanInventoryCardProps) {
  const tone = getStockTone(bean.stockKg);

  return (
    <article className={styles.card} data-tone={tone}>
      <div className={styles.header}>
        <strong>{bean.name}</strong>
        <span>{getStockText(tone)}</span>
      </div>

      <p>{[bean.origin, bean.process, bean.grade].filter(Boolean).join(' · ')}</p>

      <dl className={styles.metaGrid}>
        <div>
          <dt>库存</dt>
          <dd>{formatKg.format(bean.stockKg)} kg</dd>
        </div>
        <div>
          <dt>成本</dt>
          <dd>{formatCurrency.format(bean.costPerKg)} / kg</dd>
        </div>
        <div>
          <dt>供应商</dt>
          <dd>#{String(bean.supplierId)}</dd>
        </div>
        <div>
          <dt>更新</dt>
          <dd>{new Date(bean.updatedAt).toLocaleDateString('zh-CN')}</dd>
        </div>
      </dl>
    </article>
  );
}
