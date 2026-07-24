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
import type { RoastTrainingUploadStatus } from '@/modules/roast/types/roastTraining';
import { renderWithQuery } from '@/tests/renderWithProviders';

const {
  createRoastPlanMutateAsyncMock,
  roastAnalysisAnalyzeMock,
  roastAnalysisGetStatusMock,
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
    createRoastPlanMutateAsyncMock: vi.fn().mockResolvedValue({
      id: 'created-plan-1',
    }),
    roastAnalysisAnalyzeMock: vi.fn().mockResolvedValue({
      confidence: 80,
      issues: [],
      nextRoastAdjustments: ['下一炉一爆后保持升温率平缓下降。'],
      primaryAdjustment: {
        action: '一爆后减少降火幅度。',
        area: 'development',
        direction: 'increase',
        rationale: '本次一爆后能量衔接偏弱。',
      },
      summary: '本次曲线一爆后能量衔接偏弱，杯测时重点关注甜感和尾段干净度。',
    }),
    roastAnalysisGetStatusMock: vi.fn().mockResolvedValue(null),
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
        data: undefined as RoastTrainingUploadStatus | undefined,
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
  useCreateRoastPlan: () => ({
    isPending: false,
    mutateAsync: createRoastPlanMutateAsyncMock,
  }),
  useDeleteRoastBatch: () => ({
    mutateAsync: vi.fn(),
  }),
  useImportHiBeanRoastCurve: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  useInvalidateRoastAiUsage: () => vi.fn(),
  useRoastAiUsage: () => ({
    data: {
      enabled: true,
      monthlyLimit: 10,
      remainingUses: 10,
      usedThisMonth: 0,
    },
    error: null,
    isLoading: false,
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
        roasterMachineId: 'machine-1',
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
  useRoastingMachines: () => ({
    data: [
      {
        configuration: {},
        displayName: 'Tank200D',
        id: 'machine-1',
        modelKey: 'tank200d',
        status: 'active',
      },
    ],
    isFetching: false,
  }),
}));

vi.mock('@/modules/roast/hooks/useRoastTrainingUpload', () => ({
  useRoastTrainingUpload: () => ({
    ...trainingUploadMutationStateMock.current,
    mutateAsync: trainingUploadMutateAsyncMock,
  }),
  useRoastTrainingUploadStatus: () => trainingUploadStatusQueryStateMock.current,
  useConfirmRoastTrainingRecommendation: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
}));

vi.mock('@/modules/roast/services/roastAnalysis.service', () => ({
  roastAnalysisService: {
    analyze: roastAnalysisAnalyzeMock,
    getStatus: roastAnalysisGetStatusMock,
  },
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
    roastAnalysisAnalyzeMock.mockClear();
    roastAnalysisGetStatusMock.mockClear();
    createRoastPlanMutateAsyncMock.mockClear();
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
    expect(screen.getByRole('button', { name: /生成 AI 曲线复盘/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: '生成整体复盘与计划建议' })).toBeDisabled();
    expect(saveButton.compareDocumentPosition(trainingHeading)).toBe(Node.DOCUMENT_POSITION_PRECEDING);
    expect(saveButton).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: '允许将本次匿名烘焙数据用于同型号模型训练' }),
    ).toBeInTheDocument();
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

  it('enables roast training upload in production when the record is ready and authorized', async () => {
    vi.stubEnv('VITE_EASYBAKE_APP_ENV', 'production');
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
        environment: 'production',
        roastBatchId: 'batch-1',
      },
      error: null,
      isError: false,
      isFetching: false,
    };

    renderWithQuery(<ProductionPage />);

    fireEvent.click(screen.getByRole('button', { name: '全部编辑 测试熟豆' }));
    fireEvent.click(screen.getByRole('button', { name: '生成整体复盘与计划建议' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认生成' }));

    await waitFor(() => {
      expect(trainingUploadMutateAsyncMock).toHaveBeenCalledWith('batch-1');
    });
  });

  it('generates roast analysis from the batch id when duration only exists in the imported curve', async () => {
    vi.stubEnv('VITE_EASYBAKE_APP_ENV', 'production');
    roastCurveDataMock.current = roastCurveDataMock.defaultCurve;
    roastBatchesMock.current = [
      {
        ...roastBatchesMock.defaultBatch,
        totalRoastTime: undefined,
      },
    ];

    renderWithQuery(<ProductionPage />);

    fireEvent.click(screen.getByRole('button', { name: '查看 测试熟豆' }));
    const analyzeButton = await screen.findByRole('button', { name: /生成 AI 曲线复盘/ });

    await waitFor(() => {
      expect(analyzeButton).toBeEnabled();
    });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(roastAnalysisAnalyzeMock).toHaveBeenCalledWith('batch-1');
    });
  });

  it('keeps roast training upload disabled after the record has already uploaded', () => {
    vi.stubEnv('VITE_EASYBAKE_APP_ENV', 'production');
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
        environment: 'production',
        roastBatchId: 'batch-1',
        uploadId: 'upload-1',
      },
      error: null,
      isError: false,
      isFetching: false,
    };

    renderWithQuery(<ProductionPage />);

    fireEvent.click(screen.getByRole('button', { name: '全部编辑 测试熟豆' }));

    expect(screen.queryByRole('button', { name: '生成整体复盘与计划建议' })).not.toBeInTheDocument();
    expect(screen.getByText('这条记录已经生成过整体复盘与计划建议，不能重复生成。')).toBeInTheDocument();
  });

  it('shows the saved roast recommendation result instead of readiness cards', () => {
    vi.stubEnv('VITE_EASYBAKE_APP_ENV', 'production');
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
        enabled: false,
        environment: 'staging',
        recommendation: {
          adjustments: [
            {
              area: '发展期',
              expectedResult: '预计酸甜更集中，烟感降低。',
              observation: '发展期略长，尾段烟感偏重。',
              priority: 'medium',
              rationale: '降低尾段热量累积可减少焙烤感。',
              suggestion: '一爆后提前 10 秒降火，并保持风门稳定。',
            },
          ],
          confidence: 82,
          modifiedPlanJson: {
            batchWeightGrams: 200,
            beanId: 'bean-1',
            beanName: '测试生豆',
            name: 'AI 优化计划',
            purpose: '手冲',
            roastLevel: '手冲浅烘',
            roasterMachineId: 'machine-1',
            roasterModel: 'Tank200D',
            steps: [
              {
                airTemperature: '180°C',
                drumSpeed: '45rpm',
                event: '入豆',
                firePower: '80%',
                operation: '入豆',
                temperature: '200°C',
                time: '0:00',
              },
            ],
          },
          overallReview: '整体复盘显示一爆后热量略重，需要压低尾段焦糖化。',
          recommendationId: 'recommendation-1',
          status: 'draft',
        },
        roastBatchId: 'batch-1',
        uploadId: 'upload-1',
      },
      error: null,
      isError: false,
      isFetching: false,
    };

    renderWithQuery(<ProductionPage />);

    fireEvent.click(screen.getByRole('button', { name: '全部编辑 测试熟豆' }));

    expect(screen.getByRole('heading', { name: 'AI 整体复盘与计划建议' })).toBeInTheDocument();
    expect(screen.getByText('整体复盘显示一爆后热量略重，需要压低尾段焦糖化。')).toBeInTheDocument();
    expect(screen.getByText('调整原因')).toBeInTheDocument();
    expect(screen.getByText('预计酸甜更集中，烟感降低。')).toBeInTheDocument();
    expect(screen.getByText('AI 优化计划')).toBeInTheDocument();
    expect(screen.queryByText('训练授权')).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: '导入曲线 JSON' })).toBeInTheDocument();
    expect(screen.queryByText('图片记录（预留接口）')).not.toBeInTheDocument();
  });
});
