import { aiRoastBaseUrl, aiRoastModel, aiRoastProvider, isSupportedAiRoastProvider } from '../config.js';
import { parseJsonResponse } from '../http.js';
import { extractJsonFromModelText, getModelContentText } from './qiniu-client.js';
import type { RoastAnalysisRequest, RoastAnalysisResult } from './roast-analysis-types.js';
import { normalizeRoastAnalysisResult } from './roast-analysis-types.js';

const buildRoastApiUrl = (path: string): string => new URL(path.replace(/^\//, ''), `${aiRoastBaseUrl}/`).toString();

const getResolvedRoastModel = (): string => {
  return (process.env.AI_ROAST_MODEL ?? '').trim() || aiRoastModel;
};

const createSystemPrompt = (): string => {
  return [
    '你是一名严谨的咖啡烘焙曲线分析助手。',
    '你的任务是结合用户原烘焙计划来理解和复盘实际曲线表现：计划是烘焙意图、目标节点和操作背景，不要把输出写成“计划与实际差异检查”。',
    '请分析“在这个计划和这台机器背景下，这条实际曲线呈现出哪些明显瑕疵、这些瑕疵可能导致什么烘焙结果、杯测时应重点关注什么、下一次曲线应如何调整”。',
    'AI 曲线复盘不以已有杯测结果为前提；如果输入没有杯测反馈，只能做烘焙结果预测评估和杯测关注点提示，不要写成已经确认的杯测结论。',
    '仅依据输入的曲线指标和上下文分析；数据不足时用烘焙师能理解的话说明需要核对哪类记录，不要编造事件或数值。',
    '输入可能包含 batch（投豆量、出豆量、失水率、评价）、plan（原烘焙计划和节点设置）、curve（RoR 统计、火力/风门/转速/环境温统计、曲线采样点）和 signals。若这些字段存在，不得声称缺少对应信息。',
    '若机器配置或计划节点显示设备只支持部分控制量，例如只有火力可调，则建议只围绕已有控制量展开，不要建议无法调整的风门、风温或转速。',
    '建议必须可执行，但不得给出超出设备安全范围的绝对保证，也不得把无来源的经验范围写成确定事实。',
    '所有面向用户的内容必须使用中文烘焙语言，不得出现字段名、变量名、英文分类或编程词汇，例如 data_integrity、ror_consistency、roast.totalTimeSeconds、curve.samples、signals、timeSeconds、beanTemperature、rateOfRise、end、drop。',
    '如果发现曲线记录边界、下豆点或升温率统计可能异常，请表述为“建议核对下豆点、采样截断和升温率记录”，不要输出技术字段名。',
    '只输出 JSON 对象，固定字段为 summary、issues、primaryAdjustment、nextRoastAdjustments、confidence。',
    'summary 必须包含：曲线总体判断、明显瑕疵、可能导致的杯中表现预测、杯测时需要重点确认的风味点。',
    'issues 是最多 6 项且 category 不重复的数组，每项固定字段 category、evidence、severity，severity 只能为 high、medium、low；category 必须使用中文短语，例如 发展期、干燥期、升温率、能量供应、出炉温度、杯测关注、曲线记录。',
    'primaryAdjustment 是唯一主策略，固定字段 area、direction、action、rationale。area 只能为 development、energy、ror、insufficient_data；direction 只能为 decrease、increase、maintain、observe。',
    'nextRoastAdjustments 最多 6 项，必须全部支持 primaryAdjustment，不能出现与主策略相反或互相排斥的调整；建议应围绕下一次曲线如何调整，包括入豆能量、阶段节奏、一爆后热量、发展时间或下豆点。',
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
      max_tokens: 1800,
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
    throw new Error(`烘焙 AI 请求失败（${String(upstream.status)}）。`);
  }

  const content = getModelContentText(payload);

  if (!content) {
    throw new Error('烘焙 AI 返回内容为空。');
  }

  return content;
};

const parseRoastAnalysisResult = (content: string): RoastAnalysisResult => {
  const result = normalizeRoastAnalysisResult(extractJsonFromModelText(content));

  if (!result) {
    throw new Error('烘焙 AI 返回内容不符合预期结构。');
  }

  return result;
};

const repairRoastAnalysisJson = async (content: string): Promise<RoastAnalysisResult> => {
  const repairedContent = await requestModelContent([
    {
      content:
        '你是 JSON 格式修复器。将用户提供的烘焙分析内容修复为一个合法 JSON 对象。不得增加事实、不得改变建议方向。只输出 JSON，不要 Markdown。字段必须为 summary、issues、primaryAdjustment、nextRoastAdjustments、confidence。primaryAdjustment 必须包含 area、direction、action、rationale。所有面向用户的文字必须改成中文烘焙语言，不得出现字段名、变量名、英文分类或编程词汇。',
      role: 'system',
    },
    { content: content.slice(0, 12_000), role: 'user' },
  ]);

  return parseRoastAnalysisResult(repairedContent);
};

export const requestRoastAnalysis = async (input: RoastAnalysisRequest): Promise<RoastAnalysisResult> => {
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
    return parseRoastAnalysisResult(content);
  } catch {
    return repairRoastAnalysisJson(content);
  }
};
