import { describe, expect, it } from 'vitest';

import { extractJsonFromModelText } from './qiniu-client.js';

describe('extractJsonFromModelText', () => {
  it('extracts a later valid JSON object when earlier braces are not valid JSON', () => {
    const payload = extractJsonFromModelText(
      '计划说明：这里不是 JSON {name: "invalid"}。\n最终结果：{"overallReview":"ok","confidence":70}',
    );

    expect(payload).toEqual({
      confidence: 70,
      overallReview: 'ok',
    });
  });

  it('extracts JSON from fenced blocks before surrounding prose', () => {
    const payload = extractJsonFromModelText(
      '下面是结果：\n```json\n{"summary":"ok","issues":[]}\n```\n请确认。',
    );

    expect(payload).toEqual({
      issues: [],
      summary: 'ok',
    });
  });
});
