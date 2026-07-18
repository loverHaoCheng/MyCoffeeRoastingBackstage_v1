import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSettingsStore } from '@/modules/settings/store';
import {
  createDefaultAppDisplaySettings,
  createDefaultCostTemplateSettings,
  createDefaultPocketBaseConnectionSettings,
} from '@/modules/settings/types';
import { ProductionPage } from '@/modules/production';
import { RoastBatchCreator } from '@/modules/roast/components';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import type { RoastCurveRecord } from '@/modules/roast/types/roastCurve';
import { renderWithQuery } from '@/tests/renderWithProviders';

const {
  roastBatchesMock,
  roastCurveDataMock,
  trainingUploadMutationStateMock,
  trainingUploadMutateAsyncMock,
  trainingUploadStatusQueryStateMock,
} = vi.hoisted(() => {
  const defaultBatch: RoastBatchRecord = {
    id: 'batch-1',
    roastDate: '2026-07-03T10:00:00.000Z',
    greenBeanId: 'bean-1',
    greenBeanName: '测试生豆',
    roastedBeanName: '测试熟豆',
    roastPlanId: 'plan-1',
    roastPlanName: '测试计划',
    inputWeightGrams: 200,
    outputWeightGrams: 170,
    roastLevel: '手冲浅烘',
    developmentRatio: 18,
    evaluation: {
      allowTraining: false,
    },
    firstCrackTime: 420,
    totalRoastTime: 540,
    notes: '测试备注',
    salesMode: 'sale',
    status: 'completed',
    createdAt: '2026-07-03T10:00:00.000Z',
    updatedAt: '2026-07-03T10:00:00.000Z',
  };

  const defaultCurve: RoastCurveRecord = {
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

  return {
    roastBatchesMock: {
      current: [defaultBatch],
      defaultBatch,
    },
    roastCurveDataMock: {
      current: null as null | RoastCurveRecord,
      defaultCurve,
    },
    trainingUploadMutationStateMock: {
      current: {
        error: null as Error | null,
        isPending: false,
      },
    },
    trainingUploadMutateAsyncMock: vi.fn().mockResolvedValue({
      sampleId: 'sample-1',
      uploadId: 'upload-1',
    }),
    trainingUploadStatusQueryStateMock: {
      current: {
        data: undefined as
          | undefined
          | {
              alreadyUploaded: boolean;
              disabledReason?: string;
              enabled: boolean;
              environment: string;
              roastBatchId: string;
              uploadId?: string;
            },
        error: null as Error | null,
        isError: false,
        isFetching: false,
      },
    },
  };
});

vi.mock('@/modules/bean/hooks', () => ({
  useBeans: () => ({
    data: [
      {
        id: 'bean-1',
        name: '测试生豆',
        origin: '埃塞俄比亚 · 古吉',
        process: '水洗',
        grade: 'G1',
        stockKg: 12,
        costPerKg: 100,
        createdAt: '2026-07-03T00:00:00.000Z',
        updatedAt: '2026-07-03T00:00:00.000Z',
      },
    ],
    isFetching: false,
  }),
}));

vi.mock('@/modules/roast/hooks', () => ({
  roastBatchQueryKeys: { all: ['roast-batches'], list: () => ['roast-batches', 'list'] },
  useDeleteRoastBatch: () => ({
    mutateAsync: vi.fn(),
  }),
  useImportHiBeanRoastCurve: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  useRoastCurve: () => ({
    data: roastCurveDataMock.current,
    isFetching: false,
  }),
  useRoastBatches: () => ({
    data: roastBatchesMock.current,
    isFetching: false,
  }),
  useRoastPlans: () => ({
    data: [
      {
        id: 'plan-1',
        beanId: 'bean-1',
        beanName: '测试生豆',
        batchWeightGrams: 200,
        name: '测试计划',
        plannedBatchKg: 0.2,
        roasterModel: 'tank200d',
        roastPurpose: '手冲',
        status: 'draft',
        steps: [
          {
            id: 1,
            timeLabel: '0:00',
            eventName: '入豆',
            operation: '入豆',
            drumTemperature: '200°C',
            airTemperature: '180°C',
            firePower: '80%',
            drumSpeed: '45rpm',
          },
        ],
        targetRoastLevel: '手冲浅烘',
        createdAt: '2026-07-03T00:00:00.000Z',
        updatedAt: '2026-07-03T00:00:00.000Z',
      },
    ],
    isFetching: false,
  }),
  useUpdateRoastBatch: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock('@/modules/roast/hooks/useRoastTrainingUpload', () => ({
  useRoastTrainingUpload: () => ({
    ...trainingUploadMutationStateMock.current,
    mutateAsync: trainingUploadMutateAsyncMock,
  }),
  useRoastTrainingUploadStatus: () => trainingUploadStatusQueryStateMock.current,
}));

describe('ProductionPage (烘焙历史)', () => {
  beforeEach(() => {
    roastBatchesMock.current = [roastBatchesMock.defaultBatch];
    roastCurveDataMock.current = null;
    trainingUploadMutationStateMock.current = {
      error: null,
      isPending: false,
    };
    trainingUploadMutateAsyncMock.mockClear();
    trainingUploadStatusQueryStateMock.current = {
      data: undefined,
      error: null,
      isError: false,
      isFetching: false,
    };
    useSettingsStore.setState({
      appDisplaySettings: createDefaultAppDisplaySettings(),
      costTemplateSettings: createDefaultCostTemplateSettings(),
      pocketBaseConnections: createDefaultPocketBaseConnectionSettings(),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders the roast history page with search and FAB', () => {
    renderWithQuery(<ProductionPage />);

    expect(screen.getByLabelText('搜索烘焙历史')).toBeInTheDocument();
  });

  it('opens the full roast batch form from the card level edit button', () => {
    renderWithQuery(<ProductionPage />);

    fireEvent.click(screen.getByRole('button', { name: '全部编辑 测试熟豆' }));

    const trainingHeading = screen.getByRole('heading', { name: 'AI 训练准备' });
    const saveButton = screen.getByRole('button', { name: /保存烘焙记录/ });

    expect(trainingHeading).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上传用于训练（正式环境暂未开放）' })).toBeDisabled();
    expect(saveButton.compareDocumentPosition(trainingHeading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(saveButton).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '烘焙程度' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '生豆' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '去向' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '本次最终定价' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '烘焙计划' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '入豆量' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '出豆量' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '发展比' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '一爆时间' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '总烘焙时间' })).toBeInTheDocument();
  });

  it('enables roast training upload in staging when the record is ready and authorized', async () => {
    vi.stubEnv('VITE_EASYBAKE_APP_ENV', 'staging');
    roastCurveDataMock.current = roastCurveDataMock.defaultCurve;
    roastBatchesMock.current = [
      {
        ...roastBatchesMock.defaultBatch,
        evaluation: {
          allowTraining: true,
          flavorNotes: '甜感清楚，酸质干净',
          overallScore: 4,
          targetMatchScore: 5,
        },
      },
    ];
    trainingUploadStatusQueryStateMock.current = {
      data: {
        alreadyUploaded: false,
        enabled: true,
        environment: 'staging',
        roastBatchId: 'batch-1',
      },
      error: null,
      isError: false,
      isFetching: false,
    };

    renderWithQuery(<ProductionPage />);

    fireEvent.click(screen.getByRole('button', { name: '全部编辑 测试熟豆' }));
    fireEvent.click(screen.getByRole('button', { name: '上传用于训练' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认上传' }));

    await waitFor(() => {
      expect(trainingUploadMutateAsyncMock).toHaveBeenCalledWith('batch-1');
    });
  });

  it('keeps roast training upload disabled after the record has already uploaded', () => {
    vi.stubEnv('VITE_EASYBAKE_APP_ENV', 'staging');
    roastCurveDataMock.current = roastCurveDataMock.defaultCurve;
    roastBatchesMock.current = [
      {
        ...roastBatchesMock.defaultBatch,
        evaluation: {
          allowTraining: true,
          flavorNotes: '甜感清楚，酸质干净',
          overallScore: 4,
          targetMatchScore: 5,
        },
      },
    ];
    trainingUploadStatusQueryStateMock.current = {
      data: {
        alreadyUploaded: true,
        disabledReason: '这条烘焙记录已经上传过训练数据。',
        enabled: false,
        environment: 'staging',
        roastBatchId: 'batch-1',
        uploadId: 'upload-1',
      },
      error: null,
      isError: false,
      isFetching: false,
    };

    renderWithQuery(<ProductionPage />);

    fireEvent.click(screen.getByRole('button', { name: '全部编辑 测试熟豆' }));

    expect(screen.getByRole('button', { name: '已上传用于训练' })).toBeDisabled();
    expect(screen.getByText('这条记录已经上传过训练数据，不能重复上传。')).toBeInTheDocument();
  });

  it('gives every roast batch creator control an accessible name', () => {
    renderWithQuery(<RoastBatchCreator onCreate={vi.fn()} />);

    expect(screen.getByPlaceholderText('选择烘焙日期与时间')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '烘焙程度' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '生豆' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '熟豆名称' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '去向' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '本次最终定价' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '烘焙计划' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '入豆量' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '出豆量' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '发展比' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '一爆时间' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '总烘焙时间' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '备注' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导入 HiBean JSON' })).toBeInTheDocument();
    expect(screen.queryByText('图片记录（预留接口）')).not.toBeInTheDocument();
  });
});
