import { describe, expect, it } from 'vitest';

import { parseHibeanRoastCurveJson } from './roastCurveImport.service';

describe('parseHibeanRoastCurveJson', () => {
  it('accepts nullable bean fields from HiBean exports', () => {
    const result = parseHibeanRoastCurveJson(JSON.stringify({
      dataList: [{ bt: 100, duration: 0, et: 0, roasterParams: [] }],
      roastContext: { bean: { name: '埃塞', origin: 'ET', processingMethod: 0, regionCode: null } },
    }), 'batch-1');

    expect(result.beanSnapshot).toMatchObject({ name: '埃塞', origin: 'ET' });
    expect(result.beanSnapshot?.regionCode).toBeUndefined();
  });
});
