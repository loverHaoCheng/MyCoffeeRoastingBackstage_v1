// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RoastAnalysisRequest } from './roast-analysis-types.js';

const roastAnalysisInput: RoastAnalysisRequest = {
  curveRecordId: 'curve-1',
  machine: {
    model: 'Tank200D',
    notes: '500g direct fire',
  },
  machineId: 'machine-1',
  roast: {
    developmentRatio: 20,
    dropTemperatureC: 202,
    firstCrackTimeSeconds: 420,
    target: '手冲浅烘',
    totalTimeSeconds: 540,
  },
  roastBatchId: 'batch-1',
  signals: {
    averageRor: 8.2,
  },
};

describe('roast AI provider compatibility', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('accepts OpenAI-compatible relay providers for roast analysis', async () => {
    vi.stubEnv('AI_ROAST_API_KEY', 'test-openai-compatible-key');
    vi.stubEnv('AI_ROAST_BASE_URL', 'https://relay.example.com/v1');
    vi.stubEnv('AI_ROAST_MODEL', 'gpt-4.1-mini');
    vi.stubEnv('AI_ROAST_PROVIDER', 'openai-compatible');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              confidence: 72,
              issues: [{ category: 'development', evidence: '发展率略高。', severity: 'medium' }],
              nextRoastAdjustments: ['一爆后缩短 10 秒观察风味清晰度。'],
              primaryAdjustment: {
                action: '缩短发展时间。',
                area: 'development',
                direction: 'decrease',
                rationale: '目标为浅烘，发展率可稍微收紧。',
              },
              summary: '本次曲线可作为基准，但发展阶段略偏长。',
            }),
          },
        },
      ],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { requestRoastAnalysis } = await import('./roast-analysis-client.js');

    await expect(requestRoastAnalysis(roastAnalysisInput)).resolves.toMatchObject({
      confidence: 72,
      primaryAdjustment: {
        area: 'development',
        direction: 'decrease',
      },
    });
    expect(fetchMock).toHaveBeenCalledWith('https://relay.example.com/v1/chat/completions', expect.objectContaining({
      method: 'POST',
    }));
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;

    expect(typeof requestInit?.body).toBe('string');
    expect(JSON.parse(requestInit?.body as string)).toMatchObject({
      model: 'gpt-4.1-mini',
    });
  });
});
