import { describe, expect, it } from 'vitest';

import { mapRemoteRoastCurveRecord } from './roast-curve/roastCurve.service.shared';
import { parseArtisanRoastCurveJson, parseHibeanRoastCurveJson, parseRoastCurveJson } from './roastCurveImport.service';

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

describe('parseArtisanRoastCurveJson', () => {
  it('normalizes Artisan JSON from charge to drop into the shared curve model', () => {
    const jsonText = JSON.stringify({
      beans: '埃塞水洗测试豆',
      computed: {
        CHARGE_BT: -1,
        CHARGE_ET: 190,
        DROP_BT: -1,
        DROP_ET: 211,
        DROP_time: 18,
        DRY_BT: -1,
        DRY_ET: 160,
        DRY_time: 6,
        FCe_BT: -1,
        FCe_ET: 209,
        FCe_time: 16,
        FCs_BT: -1,
        FCs_ET: 201,
        FCs_time: 12,
        dryphasetime: 6,
        finishphasetime: 6,
        midphasetime: 6,
        totaltime: 18,
      },
      mode: 'C',
      samplinginterval: 2,
      temp1: [205, 200, 190, 182, 170, 160, 175, 190, 201, 205, 209, 211],
      temp2: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
      timeindex: [2, 5, 8, 10, 0, 0, 11, 0],
      timex: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22],
      title: '烘焙记录仪',
      version: '4.2.0',
      weight: [0.2, 0.17, 'Kg'],
    });

    const record = parseArtisanRoastCurveJson(jsonText, 'batch-1', 'artisan.json');

    expect(record.source).toBe('artisan');
    expect(record.sourceVersion).toBe('4.2.0');
    expect(record.curveData[0]?.timeSeconds).toBe(0);
    expect(record.curveData.at(-1)?.timeSeconds).toBe(18);
    expect(record.curveData[0]?.beanTemperature).toBe(190);
    expect(record.eventList.map((event) => event.type)).toEqual([
      'charge',
      'dryEnd',
      'firstCrackStart',
      'firstCrackEnd',
      'drop',
    ]);
    expect(record.metrics.roastDuration).toBe(18);
    expect(record.metrics.firstCrackTime).toBe(12);
    expect(record.metrics.developmentTime).toBe(6);
    expect(record.metrics.developmentRatio).toBeCloseTo(33.33, 2);
    expect(record.metrics.dropTemperature).toBe(211);
    expect(record.beanSnapshot?.greenBeanWeightGrams).toBe(200);
  });

  it('auto-detects Artisan JSON through the shared import entry', () => {
    const jsonText = JSON.stringify({
      computed: { CHARGE_ET: 190 },
      temp1: [190, 191, 192],
      timeindex: [0, 0, 0, 0, 0, 0, 2, 0],
      timex: [0, 2, 4],
    });

    expect(parseRoastCurveJson(jsonText, 'batch-1').source).toBe('artisan');
  });

  it('normalizes snake_case curve payloads from remote records into the shared curve model', () => {
    const record = mapRemoteRoastCurveRecord({
      curve_data: [
        { bean_temperature: 180, rate_of_rise: 9.2, time_seconds: 300 },
        { bean_temperature: 204, rate_of_rise: 4.8, time_seconds: 540 },
      ],
      id: 'curve-1',
      metrics: {
        drop_temperature: 204,
        drop_time: 540,
        roast_duration: 540,
      },
      roast_batch_id: 'batch-1',
      source: 'hibean',
      source_version: '1.0.0',
      temperature_unit: 'C',
      updated_at: '2026-07-23T00:00:00.000Z',
    });

    expect(record.curveData).toHaveLength(2);
    expect(record.curveData[0]).toMatchObject({
      beanTemperature: 180,
      rateOfRise: 9.2,
      timeSeconds: 300,
    });
    expect(record.metrics).toMatchObject({
      dropTemperature: 204,
      dropTime: 540,
      roastDuration: 540,
    });
  });
});
