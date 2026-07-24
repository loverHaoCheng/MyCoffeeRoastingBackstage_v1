// @vitest-environment node

import { Readable } from 'node:stream';

import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';

import { normalizeRoastAnalysisResult, parseRoastAnalysisRequest } from './roast-analysis-types.js';

const createJsonRequest = (body: unknown): IncomingMessage => {
  const request = Readable.from([JSON.stringify(body)]) as IncomingMessage;
  request.headers = { 'content-type': 'application/json' };

  return request;
};

describe('roast analysis schema', () => {
  it('accepts bounded roast metrics and removes unsupported signal values', async () => {
    const input = await parseRoastAnalysisRequest(
      createJsonRequest({
        curveRecordId: 'curve-1',
        machine: { model: 'Tank200D', notes: '单锅 500g' },
        machineId: 'machine-1',
        roast: { target: '手冲浅烘', totalTimeSeconds: 540 },
        roastBatchId: 'batch-1',
        signals: { averageRor: 8.2, operatorNote: '一爆后 RoR 平稳', unsupported: true },
      }),
    );

    expect(input).toEqual({
      curveRecordId: 'curve-1',
      machine: { model: 'Tank200D', notes: '单锅 500g' },
      machineId: 'machine-1',
      roast: {
        developmentRatio: null,
        dropTemperatureC: null,
        firstCrackTimeSeconds: null,
        target: '手冲浅烘',
        totalTimeSeconds: 540,
      },
      roastBatchId: 'batch-1',
      signals: { averageRor: 8.2, operatorNote: '一爆后 RoR 平稳' },
    });
  });

  it('accepts batch, plan, ror and curve sample context for roast analysis', async () => {
    const input = await parseRoastAnalysisRequest(
      createJsonRequest({
        batch: {
          evaluationSummary: '整体评分 8；风味：柑橘酸',
          inputWeightGrams: 500,
          outputWeightGrams: 420,
          weightLossPercent: 16,
        },
        curve: {
          controlStats: {
            heatPower: { average: 72, end: 45, max: 90, min: 35 },
          },
          rorStats: { averagePositive: 8.2, end: 3.8, firstCrack: 6.1 },
          samples: [
            { beanTemperature: 180, heatPower: 70, rateOfRise: 8.1, timeSeconds: 300 },
            { unsupported: true },
          ],
        },
        curveRecordId: 'curve-1',
        machine: { model: 'Tank200D', notes: '单锅 500g' },
        machineId: 'machine-1',
        plan: {
          batchWeightGrams: 500,
          name: '埃塞浅烘',
          roasterModel: 'Tank200D',
          steps: [{ eventName: '入豆', firePower: '80%', operation: '保持火力', timeLabel: '00:00' }],
        },
        roast: { target: '手冲浅烘', totalTimeSeconds: 540 },
        roastBatchId: 'batch-1',
        signals: { averageRor: 8.2 },
      }),
    );

    expect(input.batch).toMatchObject({
      inputWeightGrams: 500,
      outputWeightGrams: 420,
      weightLossPercent: 16,
    });
    expect(input.curve?.rorStats).toMatchObject({ averagePositive: 8.2, end: 3.8 });
    expect(input.curve?.samples).toHaveLength(1);
    expect(input.plan?.steps[0]).toMatchObject({ eventName: '入豆', firePower: '80%' });
  });

  it('rejects requests without a valid total roast duration', async () => {
    await expect(
      parseRoastAnalysisRequest(
        createJsonRequest({
          machine: { model: 'Tank200D' },
          roast: { target: '手冲浅烘', totalTimeSeconds: 0 },
        }),
      ),
    ).rejects.toThrow('总烘焙时长必须是大于 0 的数值。');
  });

  it('normalizes valid model output and rejects output without a summary', () => {
    expect(
      normalizeRoastAnalysisResult({
        confidence: 120,
        issues: [{ category: '发展不足', evidence: '发展时间偏短', severity: 'medium' }],
        nextRoastAdjustments: ['一爆后延长 10 秒观察 RoR'],
        primaryAdjustment: {
          action: '一爆后延长 10 秒观察 RoR',
          area: 'development',
          direction: 'increase',
          rationale: '发展时间偏短。',
        },
        summary: '本次曲线总体可控，但发展阶段偏短。',
      }),
    ).toEqual({
      confidence: 100,
      issues: [{ category: '发展不足', evidence: '发展时间偏短', severity: 'medium' }],
      nextRoastAdjustments: ['一爆后延长 10 秒观察 升温率'],
      primaryAdjustment: {
        action: '一爆后延长 10 秒观察 升温率',
        area: 'development',
        direction: 'increase',
        rationale: '发展时间偏短。',
      },
      summary: '本次曲线总体可控，但发展阶段偏短。',
    });
    expect(normalizeRoastAnalysisResult({ issues: [] })).toBeNull();
  });

  it('normalizes common Chinese primary adjustment aliases to the response contract', () => {
    expect(
      normalizeRoastAnalysisResult({
        confidence: 72,
        issues: [],
        mainAdjustment: {
          area: '发展期',
          direction: '缩短',
          reason: '当前发展率偏高。',
          recommendation: '一爆后缩短 10 秒。',
        },
        nextRoastAdjustments: ['一爆后缩短 10 秒。'],
        summary: '发展阶段需收紧。',
      }),
    ).toMatchObject({
      primaryAdjustment: {
        action: '一爆后缩短 10 秒。',
        area: 'development',
        direction: 'decrease',
        rationale: '当前发展率偏高。',
      },
    });
  });

  it('accepts relay model output with recommendation-style aliases and synthesizes the primary strategy', () => {
    expect(
      normalizeRoastAnalysisResult({
        adjustments: [
          {
            observation: '一爆后升温率回落较快，甜感可能不足。',
            priority: '高',
            suggestion: '下一炉一爆后火力下调幅度减少 5%，让升温率保持缓慢下降。',
          },
        ],
        confidence: '78%',
        overallReview: '结合原计划和实际曲线，本次一爆后能量衔接偏弱，可能让杯中甜感和层次感变薄，杯测时需要重点确认酸甜平衡与尾段干净度。',
      }),
    ).toEqual({
      confidence: 78,
      issues: [],
      nextRoastAdjustments: ['下一炉一爆后火力下调幅度减少 5%，让升温率保持缓慢下降。'],
      primaryAdjustment: {
        action: '下一炉一爆后火力下调幅度减少 5%，让升温率保持缓慢下降。',
        area: 'development',
        direction: 'decrease',
        rationale: '结合原计划和实际曲线，本次一爆后能量衔接偏弱，可能让杯中甜感和层次感变薄，杯测时需要重点确认酸甜平衡与尾段干净度。',
      },
      summary: '结合原计划和实际曲线，本次一爆后能量衔接偏弱，可能让杯中甜感和层次感变薄，杯测时需要重点确认酸甜平衡与尾段干净度。',
    });
  });

  it('removes programming field names from user-facing analysis text', () => {
    expect(
      normalizeRoastAnalysisResult({
        confidence: 62,
        issues: [
          {
            category: 'data_integrity',
            evidence: 'roast.totalTimeSeconds为590s，但curve.samples中存在timeSeconds 624，beanTemperature为230.1°C。',
            severity: 'high',
          },
          {
            category: 'ror_consistency',
            evidence: 'rorStats.end为42，rorStats.drop为7.7，rateOfRise记录需要核对。',
            severity: 'high',
          },
        ],
        nextRoastAdjustments: ['先核对signals和end RoR，再判断是否调整火力。'],
        primaryAdjustment: {
          action: '核对curve.samples边界。',
          area: 'insufficient_data',
          direction: 'observe',
          rationale: 'RoR end与drop不一致。',
        },
        summary: '当前data_integrity需要检查。',
      }),
    ).toMatchObject({
      issues: [
        {
          category: '曲线记录',
          evidence: '总烘焙时长为590s，但曲线采样点中存在时间点 624，豆温为230.1°C。',
        },
        {
          category: '升温率记录',
          evidence: '末段升温率为42，下豆时升温率为7.7，升温率记录需要核对。',
        },
      ],
      nextRoastAdjustments: ['先核对曲线摘要和末段升温率，再判断是否调整火力。'],
      primaryAdjustment: {
        action: '核对曲线采样点边界。',
        rationale: '末段升温率与下豆不一致。',
      },
      summary: '当前曲线记录需要检查。',
    });
  });
});
