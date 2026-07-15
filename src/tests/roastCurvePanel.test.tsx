import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RoastCurvePanel } from '@/modules/roast/components/RoastCurvePanel';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import type { RoastCurveRecord } from '@/modules/roast/types/roastCurve';
import { renderWithQuery } from '@/tests/renderWithProviders';

const curveRecord: RoastCurveRecord = {
  beanSnapshot: {
    greenBeanWeightGrams: 200,
    name: '测试生豆',
    origin: 'ET',
    processingMethod: 1,
    regionCode: 'ET:sidamo',
  },
  curveData: [
    { beanTemperature: 235.3, rateOfRise: 0, timeSeconds: 0 },
    { beanTemperature: 168.1, rateOfRise: 18, timeSeconds: 282 },
    { beanTemperature: 206.6, rateOfRise: 8, timeSeconds: 447 },
    { beanTemperature: 217.6, rateOfRise: 5, timeSeconds: 522 },
  ],
  deviceInfo: {
    manufacturer: 'HiBean',
    model: 'module.hibean.arc',
    name: 'HiBean Arc',
  },
  eventList: [
    { code: 0, label: '预热', temperature: 233.6, temperatureUnit: 'C', timeSeconds: -29, type: 'preheat' },
    { code: 1, label: '入豆', temperature: 235.3, temperatureUnit: 'C', timeSeconds: 0, type: 'charge' },
    { code: 4, label: '一爆开始', temperature: 206.6, temperatureUnit: 'C', timeSeconds: 447, type: 'firstCrackStart' },
    { code: 8, label: '下豆', temperature: 217.6, temperatureUnit: 'C', timeSeconds: 522, type: 'drop' },
  ],
  id: 'curve-1',
  importedAt: '2026-07-12T15:38:00.000Z',
  metrics: {
    chargeTemperature: 235.3,
    chargeTime: 0,
    developmentRatio: 14.4,
    developmentTime: 75,
    dropTemperature: 217.6,
    dropTime: 522,
    firstCrackTemperature: 206.6,
    firstCrackTime: 447,
    roastDuration: 522,
  },
  originalFileName: 'hibean.json',
  phaseList: [
    { durationSeconds: 282, label: '脱水', percentage: 0.54, phase: 2 },
    { durationSeconds: 75, label: '发展', percentage: 0.144, phase: 4 },
  ],
  roastBatchId: 'batch-1',
  sampleInterval: 1,
  source: 'hibean',
  sourceVersion: '1.0.1',
  temperatureUnit: 'C',
  updatedAt: '2026-07-12T15:38:00.000Z',
};

const batchRecord: RoastBatchRecord = {
  createdAt: '2026-07-12T15:00:00.000Z',
  developmentRatio: 14.4,
  evaluation: {
    allowTraining: false,
  },
  firstCrackTime: 447,
  greenBeanId: 'bean-1',
  greenBeanName: '测试生豆',
  id: 'batch-1',
  inputWeightGrams: 200,
  notes: '',
  outputWeightGrams: 180,
  roastDate: '2026-07-12T15:00:00.000Z',
  roastLevel: '浅烘',
  roastedBeanName: '测试熟豆',
  salesMode: 'sale',
  status: 'completed',
  totalRoastTime: 522,
  updatedAt: '2026-07-12T15:00:00.000Z',
};

vi.mock('@/modules/roast/hooks', () => ({
  useImportHiBeanRoastCurve: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  useRoastCurve: () => ({
    data: curveRecord,
    isFetching: false,
  }),
  useUpdateRoastBatch: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
}));

describe('RoastCurvePanel', () => {
  it('renders RoR modes and non-curve data summary', () => {
    renderWithQuery(<RoastCurvePanel batch={batchRecord} />);

    expect(screen.queryByText('自定义')).not.toBeInTheDocument();
    expect(screen.getByText('灵敏')).toBeInTheDocument();
    expect(screen.getByText('适中')).toBeInTheDocument();
    expect(screen.getByText('舒缓')).toBeInTheDocument();
    expect(screen.getByText('关键数据')).toBeInTheDocument();
    expect(screen.getByText('记录信息')).toBeInTheDocument();
    expect(screen.getByLabelText('曲线数据摘要')).toHaveTextContent('54.0%');
    expect(screen.getByLabelText('曲线数据摘要')).toHaveTextContent('-0:29 / 233.6C');

    fireEvent.click(screen.getByText('舒缓'));

    expect(screen.getByText('舒缓').closest('.ant-segmented-item-selected')).toBeTruthy();
  });
});
