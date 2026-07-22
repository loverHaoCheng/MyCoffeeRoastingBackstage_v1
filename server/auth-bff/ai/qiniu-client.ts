import type { IncomingMessage } from 'node:http';

import { aiImageMaxBytes, qiniuQwenBaseUrl, qiniuQwenModel } from '../config.js';
import { parseJsonResponse, parseLimitedJsonBody, readRequestBuffer } from '../http.js';
import type { BeanImageRecognitionResult, RoasterModelRecognitionResult } from '../types.js';
import { isRecord, toTrimmedString } from '../utils.js';

export const buildQiniuQwenUrl = (path: string): string => {
  return new URL(path.replace(/^\//, ''), `${qiniuQwenBaseUrl}/`).toString();
};

export const parseImageRecognitionRequest = async (request: IncomingMessage): Promise<{ imageDataUrl: string }> => {
  const contentType = request.headers['content-type'] ?? '';
  const normalizedContentType = Array.isArray(contentType) ? '' : contentType.toLowerCase();
  const binaryImageMimeTypeMatch = /^image\/(?:jpeg|jpg|png|webp)(?:\s*;.*)?$/.exec(normalizedContentType);

  if (binaryImageMimeTypeMatch) {
    const binaryImage = await readRequestBuffer(request, {
      maxBytes: aiImageMaxBytes,
    });

    if (binaryImage.byteLength <= 0) {
      throw new Error('图片内容为空，请重新上传。');
    }

    return {
      imageDataUrl: `data:${normalizedContentType.split(';')[0]};base64,${binaryImage.toString('base64')}`,
    };
  }

  if (!normalizedContentType.includes('application/json')) {
    throw new Error('请使用 JSON 请求体或 jpeg、png、webp 二进制图片提交图片数据。');
  }

  const body = await parseLimitedJsonBody(request, {
    maxBytes: Math.ceil(aiImageMaxBytes * 1.5) + 2048,
  });

  if (!isRecord(body)) {
    throw new Error('AI 图片识别请求缺少有效参数。');
  }

  const imageDataUrl = toTrimmedString(body.imageDataUrl);
  const imageBase64 = toTrimmedString(body.imageBase64);
  const mimeType = toTrimmedString(body.mimeType) || 'image/jpeg';
  const normalizedDataUrl = imageDataUrl || `data:${mimeType};base64,${imageBase64}`;
  const dataUrlMatch = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([a-zA-Z0-9+/=\r\n]+)$/.exec(normalizedDataUrl);

  if (!dataUrlMatch) {
    throw new Error('请提交 jpeg、png 或 webp 格式的 base64 图片。');
  }

  const binaryImage = Buffer.from(dataUrlMatch[2].replaceAll(/\s/g, ''), 'base64');

  if (binaryImage.byteLength <= 0) {
    throw new Error('图片内容为空，请重新上传。');
  }

  if (binaryImage.byteLength > aiImageMaxBytes) {
    throw new Error('图片数据过大，请压缩到 6MB 以内后重试。');
  }

  return {
    imageDataUrl: `data:${dataUrlMatch[1]};base64,${binaryImage.toString('base64')}`,
  };
};

export const getOptionalStringField = (record: Record<string, unknown>, fieldName: string): string => {
  return typeof record[fieldName] === 'string' ? record[fieldName].trim() : '';
};

export const getOptionalNumberField = (record: Record<string, unknown>, fieldName: string): null | number => {
  const value = record[fieldName];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value;
};

export const normalizeFlavorTagList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
    .slice(0, 12);
};

export const normalizeHarvestSeasonShortYear = (value: string): string => {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const fullYearMatch = /(?:19|20)\d{2}/.exec(trimmed);

  if (fullYearMatch) {
    return fullYearMatch[0].slice(-2);
  }

  const twoDigitMatch = /\d{2}/.exec(trimmed);

  return twoDigitMatch ? twoDigitMatch[0] : trimmed;
};

export const normalizeRecognitionPayload = (payload: unknown): BeanImageRecognitionResult | null => {
  if (!isRecord(payload)) {
    return null;
  }

  return {
    altitudeMetersMax: getOptionalNumberField(payload, 'altitudeMetersMax'),
    altitudeMetersMin: getOptionalNumberField(payload, 'altitudeMetersMin'),
    code: getOptionalStringField(payload, 'code'),
    densityGPerL: getOptionalNumberField(payload, 'densityGPerL'),
    displayName: getOptionalStringField(payload, 'displayName'),
    flavorTags: normalizeFlavorTagList(payload.flavorTags),
    grade: getOptionalStringField(payload, 'grade'),
    harvestSeason: normalizeHarvestSeasonShortYear(getOptionalStringField(payload, 'harvestSeason')),
    millName: getOptionalStringField(payload, 'millName'),
    moisturePercent: getOptionalNumberField(payload, 'moisturePercent'),
    notes: getOptionalStringField(payload, 'notes'),
    originArea: getOptionalStringField(payload, 'originArea'),
    originCountry: getOptionalStringField(payload, 'originCountry'),
    originRegion: getOptionalStringField(payload, 'originRegion'),
    processMethod: getOptionalStringField(payload, 'processMethod'),
    supplierName: getOptionalStringField(payload, 'supplierName'),
    variety: getOptionalStringField(payload, 'variety'),
  };
};

export const parseJsonCandidate = (candidate: string): unknown => {
  const normalizedCandidate = candidate
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/,\s*([}\]])/g, '$1');

  return JSON.parse(normalizedCandidate) as unknown;
};

export const extractBalancedJsonObject = (text: string): string => {
  const startIndex = text.indexOf('{');

  if (startIndex < 0) {
    return '';
  }

  let depth = 0;
  let isEscaped = false;
  let isInString = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (char === '\\') {
      isEscaped = true;
      continue;
    }

    if (char === '"') {
      isInString = !isInString;
      continue;
    }

    if (isInString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
    }

    if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return '';
};

export const extractBalancedJsonObjects = (text: string): string[] => {
  const objects: string[] = [];

  for (let startIndex = text.indexOf('{'); startIndex >= 0; startIndex = text.indexOf('{', startIndex + 1)) {
    const candidate = extractBalancedJsonObject(text.slice(startIndex));

    if (candidate) {
      objects.push(candidate);
      startIndex += candidate.length - 1;
    }
  }

  return objects;
};

export const extractJsonFromModelText = (text: string): unknown => {
  const trimmedText = text.trim();
  const fencedJsonMatches = Array.from(trimmedText.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi))
    .map((match) => match[1]);
  const candidates = Array.from(new Set([
    ...fencedJsonMatches,
    trimmedText,
    ...extractBalancedJsonObjects(trimmedText),
  ].filter((candidate) => candidate.trim().length > 0)));

  for (const candidate of candidates) {
    const balancedCandidate = candidate.trim().startsWith('{')
      ? extractBalancedJsonObject(candidate) || candidate
      : extractBalancedJsonObject(candidate);

    if (!balancedCandidate) {
      continue;
    }

    try {
      return parseJsonCandidate(balancedCandidate);
    } catch {
      // 继续尝试其他候选片段；最终统一抛出业务错误。
    }
  }

  throw new Error('AI 返回内容不是有效的 JSON。');
};

export const getContentPartText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (!isRecord(value)) {
    return '';
  }

  const text = toTrimmedString(value.text) || toTrimmedString(value.output_text);

  if (text) {
    return text;
  }

  if ('code' in value || 'displayName' in value || 'originCountry' in value) {
    return JSON.stringify(value);
  }

  return '';
};

export const getModelContentText = (payload: unknown): string => {
  if (!isRecord(payload)) {
    return '';
  }

  const directOutputText = getContentPartText(payload.output_text);

  if (directOutputText) {
    return directOutputText;
  }

  if (!Array.isArray(payload.choices)) {
    return '';
  }

  for (const choice of payload.choices) {
    if (!isRecord(choice)) {
      continue;
    }

    const choiceText = getContentPartText(choice.text);

    if (choiceText) {
      return choiceText;
    }

    if (!isRecord(choice.message)) {
      continue;
    }

    const content = choice.message.content;

    if (Array.isArray(content)) {
      const joinedContent = content
        .map((part) => getContentPartText(part))
        .filter((part) => part.length > 0)
        .join('\n')
        .trim();

      if (joinedContent) {
        return joinedContent;
      }
    }

    const contentText = getContentPartText(content);

    if (contentText) {
      return contentText;
    }

    const reasoningContent = getContentPartText(choice.message.reasoning_content);

    if (reasoningContent) {
      return reasoningContent;
    }
  }

  return '';
};

export const getModelResponseDiagnostics = (payload: unknown): string => {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return 'choices:missing';
  }

  const firstChoice = payload.choices[0] as unknown;

  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return 'message:missing';
  }

  const finishReason = toTrimmedString(firstChoice.finish_reason);
  const messageKeys = Object.keys(firstChoice.message).sort().join(',');
  const content = firstChoice.message.content;
  const contentType = Array.isArray(content) ? 'array' : typeof content;

  return [
    finishReason ? `finish_reason:${finishReason}` : '',
    messageKeys ? `message_keys:${messageKeys}` : '',
    `content_type:${contentType}`,
  ].filter((item) => item.length > 0).join('；') || 'unknown';
};

export const getQiniuErrorMessage = (payload: unknown): string => {
  if (!isRecord(payload)) {
    return '';
  }

  const directMessage = toTrimmedString(payload.message);

  if (directMessage) {
    return directMessage;
  }

  if (isRecord(payload.error)) {
    return toTrimmedString(payload.error.message) || toTrimmedString(payload.error.code);
  }

  return toTrimmedString(payload.code) || toTrimmedString(payload.error);
};

export const formatQiniuRequestError = (status: number, payload: unknown, action: string): string => {
  const upstreamMessage = getQiniuErrorMessage(payload);
  const suffix = upstreamMessage ? `上游信息：${upstreamMessage}` : '上游未返回可读错误信息。';

  if (status === 401 || status === 403) {
    return (
      `七牛云 Qwen ${action}被拒绝：${String(status)}。` +
      `请检查 QINIU_QWEN_API_KEY 是否有效且已开通当前模型，` +
      `QINIU_QWEN_MODEL=${qiniuQwenModel} 是否与七牛云控制台模型 ID 完全一致，` +
      `以及该模型是否允许当前账号调用视觉/多模态能力。${suffix}`
    );
  }

  return `七牛云 Qwen ${action}失败：${String(status)}。${suffix}`;
};

export const requestQiniuJsonRepair = async (apiKey: string, modelText: string): Promise<unknown> => {
  const upstream = await fetch(buildQiniuQwenUrl('/chat/completions'), {
    body: JSON.stringify({
      enable_thinking: false,
      max_tokens: 1024,
      messages: [
        {
          content:
            '你是严格 JSON 格式化器。把用户提供的咖啡生豆识别文本转换成一个 JSON 对象。不要解释，不要 Markdown，不要输出 JSON 以外的任何内容。',
          role: 'system',
        },
        {
          content:
            `请只返回这些字段：code, displayName, originCountry, originRegion, originArea, processMethod, variety, grade, harvestSeason, millName, flavorTags, altitudeMetersMin, altitudeMetersMax, moisturePercent, densityGPerL, supplierName, notes。\n` +
            '字符串字段无法确认时返回空字符串；数值字段无法确认时返回 null；flavorTags 返回字符串数组；harvestSeason 只返回年份后两位，例如 2026 返回 26。\n\n' +
            `待整理文本：\n${modelText.slice(0, 6000)}`,
          role: 'user',
        },
      ],
      model: qiniuQwenModel,
      temperature: 0,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const payload = await parseJsonResponse(upstream);

  if (!upstream.ok) {
    throw new Error(formatQiniuRequestError(upstream.status, payload, 'JSON 整理'));
  }

  const contentText = getModelContentText(payload);

  if (!contentText) {
    throw new Error(`AI JSON 整理返回内容为空（${getModelResponseDiagnostics(payload)}）。`);
  }

  return extractJsonFromModelText(contentText);
};

export const requestQiniuBeanImageRecognition = async (imageDataUrl: string): Promise<BeanImageRecognitionResult> => {
  const apiKey = (process.env.QINIU_QWEN_API_KEY ?? '').trim();

  if (!apiKey) {
    throw new Error('服务器未配置七牛云 Qwen API Key。');
  }

  const upstream = await fetch(buildQiniuQwenUrl('/chat/completions'), {
    body: JSON.stringify({
      enable_thinking: false,
      max_tokens: 2048,
      messages: [
        {
          content:
            '你是咖啡生豆标签识别助手。只根据图片内容提取字段，无法确认的字段返回空字符串、空数组或 null。必须只输出一个 JSON 对象，不要输出解释，不要使用 Markdown 代码块。',
          role: 'system',
        },
        {
          content: [
            {
              text:
                '识别这张生豆标签、袋标或采购单图片，返回一个 JSON 对象，字段固定为：code, displayName, originCountry, originRegion, originArea, processMethod, variety, grade, harvestSeason, millName, flavorTags, altitudeMetersMin, altitudeMetersMax, moisturePercent, densityGPerL, supplierName, notes。数值字段只返回数字或 null；flavorTags 返回字符串数组；harvestSeason 只返回年份后两位，例如 2026 返回 26；没有识别到的字符串字段返回空字符串。',
              type: 'text',
            },
            {
              image_url: {
                url: imageDataUrl,
              },
              type: 'image_url',
            },
          ],
          role: 'user',
        },
      ],
      model: qiniuQwenModel,
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
    throw new Error(formatQiniuRequestError(upstream.status, payload, '请求'));
  }

  const contentText = getModelContentText(payload);

  if (!contentText) {
    throw new Error(`AI 返回内容为空（${getModelResponseDiagnostics(payload)}）。`);
  }

  let recognitionPayload: unknown;

  try {
    recognitionPayload = extractJsonFromModelText(contentText);
  } catch {
    recognitionPayload = await requestQiniuJsonRepair(apiKey, contentText);
  }

  const normalizedRecognition = normalizeRecognitionPayload(recognitionPayload);

  if (!normalizedRecognition) {
    throw new Error('AI 返回字段格式不符合要求。');
  }

  return normalizedRecognition;
};

export const requestQiniuRoasterModelRecognition = async (imageDataUrl: string): Promise<RoasterModelRecognitionResult> => {
  const apiKey = (process.env.QINIU_QWEN_API_KEY ?? '').trim();
  if (!apiKey) throw new Error('服务器未配置图像识别 API Key。');
  const upstream = await fetch(buildQiniuQwenUrl('/chat/completions'), {
    body: JSON.stringify({
      enable_thinking: false,
      max_tokens: 2048,
      messages: [
        { content: '你是烘焙机参数识别助手，只根据图片提取设备参数。只输出 JSON，不要 Markdown。字段固定为 brand、modelName、roastType、specifications。roastType 只能为 direct_fire、semi_hot_air、hot_air、other。specifications 保存图片中可确认的参数，键使用英文或简短中文，无法确认的值不要编造。', role: 'system' },
        { content: [{ text: '识别这张烘焙机参数表，提取品牌、型号、烘焙类型和所有可确认的机器参数。', type: 'text' }, { image_url: { url: imageDataUrl }, type: 'image_url' }], role: 'user' },
      ],
      model: qiniuQwenModel,
      temperature: 0,
    }),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const payload = await parseJsonResponse(upstream);
  if (!upstream.ok) throw new Error(`烘焙机参数识别失败（${String(upstream.status)}）。`);
  const content = getModelContentText(payload);
  const parsed = extractJsonFromModelText(content);
  if (!isRecord(parsed)) throw new Error('烘焙机参数识别返回内容无效。');
  const roastType = toTrimmedString(parsed.roastType);
  return { brand: toTrimmedString(parsed.brand), modelName: toTrimmedString(parsed.modelName), roastType: ['direct_fire', 'semi_hot_air', 'hot_air'].includes(roastType) ? roastType as RoasterModelRecognitionResult['roastType'] : 'other', specifications: isRecord(parsed.specifications) ? parsed.specifications : {} };
};
