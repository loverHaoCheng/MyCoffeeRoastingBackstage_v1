import { aiRoastBaseUrl, aiRoastModel, aiRoastProvider, isSupportedAiRoastProvider } from '../config.js';
import { parseJsonResponse } from '../http.js';
import { extractJsonFromModelText, getModelContentText } from './qiniu-client.js';
import type {
  RoastPlanDraft,
  RoastTrainingRecommendationResult,
} from './roast-training-recommendation-types.js';
import { normalizeRoastTrainingRecommendationResult } from './roast-training-recommendation-types.js';

interface RoastTrainingRecommendationRequest {
  basePlanDraft: RoastPlanDraft;
  quality: unknown;
  snapshot: Record<string, unknown>;
}

const buildRoastApiUrl = (path: string): string => new URL(path.replace(/^\//, ''), `${aiRoastBaseUrl}/`).toString();

const getResolvedRoastModel = (): string => {
  return (process.env.AI_ROAST_MODEL ?? '').trim() || aiRoastModel;
};

const createSystemPrompt = (): string => {
  return [
    '你是一名严谨的咖啡烘焙整体复盘与下次计划建议助手。',
    '你会同时读取烘焙记录、曲线、评价表单、生豆、当前烘焙计划和烘焙机参数。',
    '你的任务是通过原计划、实际曲线和用户评价/杯测结果做全面分析：解释导致本次结果的可能原因，指出曲线所呈现的关键特征，并给出优化后的烘焙计划。',
    '如果评价表单包含风味、缺陷、目标匹配或下次调整反馈，必须把它视为实际杯测结果或用户感官反馈，并与曲线特征一起分析。',
    '只依据输入信息做整体复盘；数据不足时用烘焙师能理解的话写在 overallReview 或 adjustments 中，不要编造未提供的杯测结果或曲线事件。',
    '输出必须是 JSON 对象，不要 Markdown，不要解释前后缀。',
    '固定字段为 overallReview、adjustments、modifiedPlanJson、confidence。',
    'overallReview 必须包含：本次结果的整体判断、最可能的成因、曲线对应呈现出的特征、杯测结果与曲线之间的关系、下一炉的核心优化方向。',
    'adjustments 最多 6 项，每项固定字段 area、observation、rationale、suggestion、expectedResult、priority，priority 只能为 high、medium、low。',
    'adjustments 中 observation 写当前计划/曲线/杯测共同呈现的观察，rationale 写导致该结果的可能原因，suggestion 写具体修改，expectedResult 写预计改善的杯中结果。',
    'modifiedPlanJson 必须是完整烘焙计划 JSON，字段为 name、beanId、beanName、roasterMachineId、roasterModel、batchWeightGrams、roastLevel、purpose、steps。',
    'modifiedPlanJson 必须保留输入 basePlanDraft 的 beanId、beanName、roasterMachineId、roasterModel，除非输入为空。',
    'steps 每项固定字段 time、event、operation、temperature、airTemperature、firePower、drumSpeed、note。不要删除关键节点；如需调整，用操作、火力、风温、备注表达。',
    '优化后的计划必须能对应前面的成因判断，说明如何改变能量供应、阶段节奏、发展时间或下豆点来改善杯测结果。',
    '所有面向用户的文字必须是中文烘焙语言，不得出现字段名、变量名、英文分类或编程词汇。',
    'confidence 是 0 到 100 的整数。',
  ].join('');
};

const requestModelContent = async (
  messages: {
    content: string;
    role: 'system' | 'user';
  }[],
): Promise<string> => {
  const apiKey = (process.env.AI_ROAST_API_KEY ?? '').trim();

  const upstream = await fetch(buildRoastApiUrl('/chat/completions'), {
    body: JSON.stringify({
      max_tokens: 2600,
      messages,
      model: getResolvedRoastModel(),
      temperature: 0.1,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const payload = await parseJsonResponse(upstream);

  if (!upstream.ok) {
    throw new Error(`烘焙 AI 推荐请求失败（${String(upstream.status)}）。`);
  }

  const content = getModelContentText(payload);

  if (!content) {
    throw new Error('烘焙 AI 推荐返回内容为空。');
  }

  return content;
};

const parseRecommendationResult = (
  content: string,
  fallbackPlanDraft: RoastPlanDraft,
): RoastTrainingRecommendationResult => {
  const result = normalizeRoastTrainingRecommendationResult(extractJsonFromModelText(content), fallbackPlanDraft);

  if (!result) {
    throw new Error('烘焙 AI 推荐返回内容不符合预期结构。');
  }

  return result;
};

const repairRecommendationJson = async (
  content: string,
  fallbackPlanDraft: RoastPlanDraft,
): Promise<RoastTrainingRecommendationResult> => {
  const repairedContent = await requestModelContent([
    {
      content:
        '你是 JSON 格式修复器。将用户提供的烘焙复盘与计划建议修复为合法 JSON 对象。不得新增事实、不得改变建议方向。只输出 JSON。字段必须为 overallReview、adjustments、modifiedPlanJson、confidence；adjustments 每项字段为 area、observation、rationale、suggestion、expectedResult、priority。所有面向用户的文字必须是中文烘焙语言，不得出现字段名、变量名、英文分类或编程词汇。',
      role: 'system',
    },
    { content: content.slice(0, 14_000), role: 'user' },
  ]);

  return parseRecommendationResult(repairedContent, fallbackPlanDraft);
};

export const requestRoastTrainingRecommendation = async (
  input: RoastTrainingRecommendationRequest,
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

  const content = await requestModelContent([
    { content: createSystemPrompt(), role: 'system' },
    { content: JSON.stringify(input), role: 'user' },
  ]);

  try {
    return parseRecommendationResult(content, input.basePlanDraft);
  } catch {
    return repairRecommendationJson(content, input.basePlanDraft);
  }
};
