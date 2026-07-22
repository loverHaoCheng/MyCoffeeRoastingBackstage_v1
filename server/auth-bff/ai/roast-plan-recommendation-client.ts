import { aiRoastBaseUrl, aiRoastModel, aiRoastProvider, isSupportedAiRoastProvider } from '../config.js';
import { parseJsonResponse } from '../http.js';
import { extractJsonFromModelText, getModelContentText } from './qiniu-client.js';
import type {
  RoastPlanDraft,
  RoastTrainingRecommendationResult,
} from './roast-training-recommendation-types.js';
import { normalizeRoastTrainingRecommendationResult } from './roast-training-recommendation-types.js';

export interface RoastPlanRecommendationModelRequest {
  basePlanDraft: RoastPlanDraft;
  bean: Record<string, unknown> | null;
  machine: Record<string, unknown>;
  machineControls: {
    adjustable: string[];
    readonly: string[];
  };
  machineMemory?: {
    privateMachineProfile?: Record<string, unknown>;
    publicModelProfile?: Record<string, unknown>;
    recentRecommendations: Record<string, unknown>[];
    recentReviews: Record<string, unknown>[];
  };
  target: {
    flavorExpectation: string;
    purpose?: string;
    roastLevel: string;
  };
}

const buildRoastApiUrl = (path: string): string => new URL(path.replace(/^\//, ''), `${aiRoastBaseUrl}/`).toString();

const getResolvedRoastModel = (): string => {
  return (process.env.AI_ROAST_MODEL ?? '').trim() || aiRoastModel;
};

const createSystemPrompt = (): string => {
  return [
    '你是一名咖啡烘焙计划生成助手，擅长在开炉前生成可执行的起始烘焙计划。',
    '你的任务是结合以往对这台机器或同型号机器参数的评估、生豆特征、用户目标烘焙度和期望风味，推荐最合适的下一炉计划。',
    'machineMemory 若存在，代表这台机器的个人画像、同型号公共画像、近期曲线复盘与整体复盘摘要；必须优先用于判断机器热惯性、火力响应、常见瑕疵和安全调整幅度。',
    '你必须只依据用户输入生成计划；若缺少历史机器评估或曲线数据，不要编造过往表现，应明确说明这是保守、可验证的起始方案。',
    '输出必须是 JSON 对象，不要 Markdown，不要解释前后缀。',
    '固定字段为 overallReview、adjustments、modifiedPlanJson、confidence。',
    'overallReview 用中文说明推荐计划的核心思路、使用了哪些机器/生豆依据、适用前提和首炉需要人工观察的关键风险。',
    'adjustments 最多 6 项，每项固定字段 area、observation、rationale、suggestion、expectedResult、priority，priority 只能为 high、medium、low。',
    'adjustments 用来说明本计划为什么这样设定：observation 写生豆或机器画像呈现出的依据，rationale 写推理原因，suggestion 写计划策略，expectedResult 写预计杯中结果。',
    'modifiedPlanJson 必须是完整烘焙计划 JSON，字段为 name、beanId、beanName、roasterMachineId、roasterModel、batchWeightGrams、roastLevel、purpose、steps。',
    'modifiedPlanJson 必须保留输入 basePlanDraft 的 beanId、beanName、roasterMachineId、roasterModel、batchWeightGrams、roastLevel、purpose。',
    'steps 每项固定字段 time、event、operation、temperature、airTemperature、firePower、drumSpeed、note。',
    'steps 必须包含入豆、回温点、转黄、梅纳反应、一爆开始、发展结束/下豆等关键节点；入豆炉温与每个节点预计炉温必须写入 temperature。',
    '只对 machineControls.adjustable 中列出的机器控制项给出可执行设定。若 airTemperature 或 drumSpeed 不可调，对应字段填写“不可调”，不要在 operation 或 note 中建议调整。',
    '若机器只有 firePower 可调，则每个节点只需要在 firePower 给出火力设定，airTemperature 和 drumSpeed 固定为“不可调”。',
    'firePower、airTemperature、drumSpeed 的数值必须带单位或百分比；temperature 必须写预计炉温，例如 205°C。',
    '所有面向用户的文字必须是中文烘焙语言，不得出现字段名、变量名、英文分类或编程词汇。',
    'confidence 是 0 到 100 的整数。没有历史曲线时置信度应保守，通常不超过 75。',
  ].join('');
};

const requestModelContent = async (
  messages: {
    content: string;
    role: 'system' | 'user';
  }[],
  options: {
    jsonObjectResponse?: boolean;
  } = {},
): Promise<string> => {
  const apiKey = (process.env.AI_ROAST_API_KEY ?? '').trim();
  const requestBody: Record<string, unknown> = {
    max_tokens: 2600,
    messages,
    model: getResolvedRoastModel(),
    temperature: 0.15,
  };

  if (options.jsonObjectResponse === true) {
    requestBody.response_format = { type: 'json_object' };
  }

  const upstream = await fetch(buildRoastApiUrl('/chat/completions'), {
    body: JSON.stringify(requestBody),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const payload = await parseJsonResponse(upstream);

  if (!upstream.ok) {
    throw new Error(`烘焙 AI 计划推荐请求失败（${String(upstream.status)}）。`);
  }

  const content = getModelContentText(payload);

  if (!content) {
    throw new Error('烘焙 AI 计划推荐返回内容为空。');
  }

  return content;
};

const requestModelContentWithJsonModeFallback = async (
  messages: {
    content: string;
    role: 'system' | 'user';
  }[],
): Promise<string> => {
  try {
    return await requestModelContent(messages, { jsonObjectResponse: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (!/response_format|json_object|400/.test(message)) {
      throw error;
    }

    return requestModelContent(messages);
  }
};

const parseRecommendationResult = (
  content: string,
  fallbackPlanDraft: RoastPlanDraft,
): RoastTrainingRecommendationResult => {
  const result = normalizeRoastTrainingRecommendationResult(extractJsonFromModelText(content), fallbackPlanDraft);

  if (!result) {
    throw new Error('烘焙 AI 计划推荐返回内容不符合预期结构。');
  }

  return result;
};

const repairRecommendationJson = async (
  content: string,
  fallbackPlanDraft: RoastPlanDraft,
): Promise<RoastTrainingRecommendationResult> => {
  const repairedContent = await requestModelContentWithJsonModeFallback([
    {
      content:
        '你是 JSON 格式修复器。将用户提供的烘焙计划推荐修复为合法 JSON 对象。不得新增事实、不得改变计划方向。只输出 JSON。字段必须为 overallReview、adjustments、modifiedPlanJson、confidence。所有面向用户的文字必须是中文烘焙语言，不得出现字段名、变量名、英文分类或编程词汇。',
      role: 'system',
    },
    { content: JSON.stringify({ modelText: content.slice(0, 14_000) }), role: 'user' },
  ]);

  return parseRecommendationResult(repairedContent, fallbackPlanDraft);
};

export const requestRoastPlanRecommendation = async (
  input: RoastPlanRecommendationModelRequest,
): Promise<RoastTrainingRecommendationResult> => {
  const apiKey = (process.env.AI_ROAST_API_KEY ?? '').trim();

  if (!apiKey) {
    throw new Error('服务器未配置烘焙 AI API Key。');
  }

  if (!getResolvedRoastModel()) {
    throw new Error('服务器未配置烘焙 AI 模型。');
  }

  if (!isSupportedAiRoastProvider()) {
    throw new Error(`暂不支持的烘焙 AI 服务商：${aiRoastProvider}。`);
  }

  const content = await requestModelContentWithJsonModeFallback([
    { content: createSystemPrompt(), role: 'system' },
    { content: JSON.stringify(input), role: 'user' },
  ]);

  try {
    return parseRecommendationResult(content, input.basePlanDraft);
  } catch {
    return repairRecommendationJson(content, input.basePlanDraft);
  }
};
