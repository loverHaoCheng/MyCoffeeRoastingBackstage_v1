import type { ReactNode } from 'react';

import type { RoastCurveRecord } from '@/modules/roast/types/roastCurve';

import styles from './RoastCurveDataSummary.module.css';

interface RoastCurveDataSummaryProps {
  curve: RoastCurveRecord;
}

interface DataItem {
  label: string;
  value: ReactNode;
}

const formatTime = (seconds: number | undefined): string => {
  if (seconds == null || !Number.isFinite(seconds)) {
    return '-';
  }

  const sign = seconds < 0 ? '-' : '';
  const absoluteSeconds = Math.abs(seconds);
  const minutes = Math.floor(absoluteSeconds / 60);
  const remainingSeconds = Math.round(absoluteSeconds % 60);

  return `${sign}${String(minutes)}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const formatNumber = (value: number | undefined, suffix = ''): string => {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }

  return `${value.toFixed(1)}${suffix}`;
};

const formatInteger = (value: number | undefined, suffix = ''): string => {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }

  return `${Math.round(value).toString()}${suffix}`;
};

const formatFractionPercent = (value: number | undefined): string => {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }

  return `${(value * 100).toFixed(1)}%`;
};

const formatDateTime = (value: string | undefined): string => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const renderItems = (items: DataItem[]) => (
  <dl className={styles.dataList}>
    {items.map((item) => (
      <div key={item.label} className={styles.dataRow}>
        <dt>{item.label}</dt>
        <dd>{item.value}</dd>
      </div>
    ))}
  </dl>
);

export function RoastCurveDataSummary({ curve }: RoastCurveDataSummaryProps) {
  const unit = curve.temperatureUnit;
  const metrics = curve.metrics;
  const summaryItems: DataItem[] = [
    { label: '总时长', value: formatTime(metrics.roastDuration) },
    { label: '入豆', value: `${formatTime(metrics.chargeTime)} / ${formatNumber(metrics.chargeTemperature, unit)}` },
    { label: '回温', value: `${formatTime(metrics.turningPointTime)} / ${formatNumber(metrics.turningPointTemperature, unit)}` },
    { label: '转黄', value: `${formatTime(metrics.dryEndTime)} / ${formatNumber(metrics.dryEndTemperature, unit)}` },
    { label: '一爆', value: `${formatTime(metrics.firstCrackTime)} / ${formatNumber(metrics.firstCrackTemperature, unit)}` },
    { label: '发展', value: `${formatTime(metrics.developmentTime)} / ${formatNumber(metrics.developmentRatio, '%')}` },
    { label: '下豆', value: `${formatTime(metrics.dropTime)} / ${formatNumber(metrics.dropTemperature, unit)}` },
    { label: '采样间隔', value: `${curve.sampleInterval.toString()}s` },
  ];
  const recordItems: DataItem[] = [
    { label: '来源', value: curve.source },
    { label: '版本', value: curve.sourceVersion },
    { label: '文件', value: curve.originalFileName ?? '-' },
    { label: '温度单位', value: curve.temperatureUnit },
    { label: '导入时间', value: formatDateTime(curve.importedAt) },
    { label: '更新时间', value: formatDateTime(curve.updatedAt) },
    { label: '曲线记录', value: curve.id },
    { label: '烘焙记录', value: curve.roastBatchId },
  ];
  const deviceItems: DataItem[] = [
    { label: '设备名', value: curve.deviceInfo?.name ?? '-' },
    { label: '厂商', value: curve.deviceInfo?.manufacturer ?? '-' },
    { label: '型号', value: curve.deviceInfo?.model ?? '-' },
  ];
  const beanItems: DataItem[] = [
    { label: '生豆', value: curve.beanSnapshot?.name ?? '-' },
    { label: '产地', value: curve.beanSnapshot?.origin ?? '-' },
    { label: '区域', value: curve.beanSnapshot?.regionCode ?? '-' },
    { label: '处理法', value: curve.beanSnapshot?.processingMethod == null ? '-' : curve.beanSnapshot.processingMethod.toString() },
    { label: '生豆重量', value: formatInteger(curve.beanSnapshot?.greenBeanWeightGrams, 'g') },
  ];

  return (
    <div className={styles.summary} aria-label="曲线数据摘要">
      <section className={styles.summaryBlock}>
        <h5>关键数据</h5>
        <div className={styles.metricGrid}>
          {summaryItems.map((item) => (
            <span key={item.label}>
              <b>{item.label}</b>
              {item.value}
            </span>
          ))}
        </div>
      </section>

      <section className={styles.summaryBlock}>
        <h5>事件</h5>
        <div className={styles.eventList}>
          {curve.eventList.map((event) => (
            <span key={`${event.code.toString()}-${event.timeSeconds.toString()}`}>
              <b>{event.label}</b>
              {formatTime(event.timeSeconds)} / {formatNumber(event.temperature, event.temperatureUnit)}
            </span>
          ))}
        </div>
      </section>

      <section className={styles.summaryBlock}>
        <h5>阶段</h5>
        <div className={styles.eventList}>
          {curve.phaseList.map((phase) => (
            <span key={`${phase.phase.toString()}-${phase.label}`}>
              <b>{phase.label}</b>
              {formatTime(phase.durationSeconds)} / {formatFractionPercent(phase.percentage)}
            </span>
          ))}
        </div>
      </section>

      <section className={styles.summaryBlock}>
        <h5>记录信息</h5>
        {renderItems(recordItems)}
      </section>

      <section className={styles.detailGrid}>
        <div className={styles.summaryBlock}>
          <h5>设备</h5>
          {renderItems(deviceItems)}
        </div>
        <div className={styles.summaryBlock}>
          <h5>生豆快照</h5>
          {renderItems(beanItems)}
        </div>
      </section>
    </div>
  );
}
