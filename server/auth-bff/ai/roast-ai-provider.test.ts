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

const roastPlanDraft = {
  batchWeightGrams: 200,
  beanId: 'bean-1',
  beanName: '测试生豆',
  name: '测试计划',
  purpose: '手冲',
  roastLevel: '浅烘',
  roasterMachineId: 'machine-1',
  roasterModel: 'Tank200D',
  steps: [{
    airTemperature: '不可调',
    drumSpeed: '不可调',
    event: '入豆',
    firePower: '80%',
    operation: '入豆',
    temperature: '200°C',
    time: '0:00',
  }],
};

const conversationPlanDraft = {
  ...roastPlanDraft,
  steps: [
    roastPlanDraft.steps[0],
    { ...roastPlanDraft.steps[0], event: '转黄', time: '4:30' },
    { ...roastPlanDraft.steps[0], event: '一爆开始', time: '8:30' },
    { ...roastPlanDraft.steps[0], event: '下豆', time: '9:40' },
  ],
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

  it('uses the Anthropic messages protocol for WeiLai relay providers', async () => {
    vi.stubEnv('AI_ROAST_API_KEY', 'test-anthropic-key');
    vi.stubEnv('AI_ROAST_BASE_URL', 'https://weilai.chat/v1');
    vi.stubEnv('AI_ROAST_MODEL', 'gpt-5.6-terra');
    vi.stubEnv('AI_ROAST_PROVIDER', 'anthropic');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{
        text: JSON.stringify({
          confidence: 80,
          issues: [],
          nextRoastAdjustments: ['保持当前发展节奏并继续观察。'],
          primaryAdjustment: {
            action: '保持当前策略。',
            area: 'development',
            direction: 'maintain',
            rationale: '当前曲线整体稳定。',
          },
          summary: '当前曲线整体稳定。',
        }),
        type: 'text',
      }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { requestRoastAnalysis } = await import('./roast-analysis-client.js');

    await expect(requestRoastAnalysis(roastAnalysisInput)).resolves.toMatchObject({ confidence: 80 });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://weilai.chat/v1/messages');
    const requestInit = fetchMock.mock.calls[0]?.[1] as unknown as RequestInit | undefined;
    const requestHeaders = requestInit?.headers as Record<string, string> | undefined;
    expect(requestInit?.method).toBe('POST');
    expect(requestHeaders?.['anthropic-version']).toBe('2023-06-01');
    expect(requestHeaders?.['x-api-key']).toBe('test-anthropic-key');
    const requestBody = JSON.parse(requestInit?.body as string) as Record<string, unknown>;
    expect(requestBody.max_tokens).toBe(1800);
    expect(requestBody.model).toBe('gpt-5.6-terra');
    expect(requestBody.system).toEqual(expect.stringContaining('咖啡烘焙曲线分析助手'));
  });

  it('requires a complete draft and explanation in bean plan conversations', async () => {
    vi.stubEnv('AI_ROAST_API_KEY', 'test-openai-compatible-key');
    vi.stubEnv('AI_ROAST_BASE_URL', 'https://relay.example.com/v1');
    vi.stubEnv('AI_ROAST_MODEL', 'gpt-4.1-mini');
    vi.stubEnv('AI_ROAST_PROVIDER', 'openai-compatible');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            answer: '规划依据：保留花果香与甜感。\n\n执行思路：采用保守的中浅烘热量。\n\n预计结果：酸甜平衡、香气清晰。',
            planDraft: conversationPlanDraft,
          }),
        },
      }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { requestRoastConversationReply } = await import('./roast-conversation-client.js');

    await expect(requestRoastConversationReply({
      bean: { id: 'bean-1', name: '测试生豆' },
      mode: 'bean_plan_recommendation',
      question: '生成中浅烘计划',
    })).resolves.toMatchObject({ planDraft: conversationPlanDraft });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const requestBody = JSON.parse(requestInit?.body as string) as { messages: { content: string; role: string }[] };

    expect(requestBody.messages[0]?.content).toContain('必须返回非空 planDraft');
    expect(requestBody.messages[1]?.content).toContain('bean_plan_recommendation');
  });

  it('rejects text-only responses in bean plan conversations', async () => {
    vi.stubEnv('AI_ROAST_API_KEY', 'test-openai-compatible-key');
    vi.stubEnv('AI_ROAST_BASE_URL', 'https://relay.example.com/v1');
    vi.stubEnv('AI_ROAST_MODEL', 'gpt-4.1-mini');
    vi.stubEnv('AI_ROAST_PROVIDER', 'openai-compatible');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            answer: '建议采用中浅烘。',
            planDraft: null,
          }),
        },
      }],
    }), { status: 200 })));
    const { requestRoastConversationReply } = await import('./roast-conversation-client.js');

    await expect(requestRoastConversationReply({
      mode: 'bean_plan_recommendation',
      question: '生成中浅烘计划',
    })).rejects.toThrow('未生成完整的计划说明与计划草稿');
  });

  it('logs sanitized diagnostics when a roast AI request fails', async () => {
    vi.stubEnv('AI_ROAST_API_KEY', 'test-anthropic-key');
    vi.stubEnv('AI_ROAST_BASE_URL', 'https://weilai.chat/v1');
    vi.stubEnv('AI_ROAST_MODEL', 'gpt-5.6-terra');
    vi.stubEnv('AI_ROAST_PROVIDER', 'anthropic');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'model is temporarily unavailable' },
    }), { status: 503 })));
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { requestRoastAnalysis } = await import('./roast-analysis-client.js');

    await expect(requestRoastAnalysis(roastAnalysisInput)).rejects.toThrow('烘焙 AI 请求失败（503）');

    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('roast_analysis_ai_request_failed'));
    const diagnostic = stderrWrite.mock.calls[0]?.[0] ?? '';

    expect(diagnostic).toContain('gpt-5.6-terra');
    expect(diagnostic).toContain('model is temporarily unavailable');
    expect(diagnostic).not.toContain('test-anthropic-key');
  });
});
