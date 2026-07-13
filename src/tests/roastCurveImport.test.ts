import { describe, expect, it } from 'vitest';

import { parseHibeanRoastCurveJson } from '@/modules/roast/services/roastCurve.service';

describe('HiBean roast curve import', () => {
  it('normalizes curve points and derives roast metrics from events', () => {
    const jsonText = JSON.stringify({
      dataList: [
        { duration: -1, bt: 235, et: 0 },
        { duration: 0, bt: 234, et: 0, event: 1 },
        { duration: 1, bt: 229, et: 0, ror: -30, roasterParams: [{ key: 'HP', value: 60 }] },
        { duration: 447, bt: 206.6, et: 0, ror: 8 },
        { duration: 522, bt: 217.6, et: 0, ror: 5 },
        { duration: 555, bt: 210, et: 0, ror: -44 },
      ],
      duration: 555,
      eventList: [
        { event: 1, temperature: 235.3, temperatureUnit: 'C', time: 0 },
        { event: 2, temperature: 102.6, temperatureUnit: 'C', time: 77 },
        { event: 3, temperature: 168.1, temperatureUnit: 'C', time: 282 },
        { event: 4, temperature: 206.6, temperatureUnit: 'C', time: 447 },
        { event: 8, temperature: 217.6, temperatureUnit: 'C', time: 522 },
      ],
      phaseList: [
        { duration: 282, percentage: 0.54, phase: 2 },
        { duration: 165, percentage: 0.31, phase: 3 },
        { duration: 75, percentage: 0.14, phase: 4 },
      ],
      roastContext: {
        bean: { name: 'Bombe Main Station', origin: 'ET' },
        greenBeanWeight: { unit: 'g', value: 200 },
      },
      sampleInterval: 1,
      temperatureUnit: 'C',
      version: '1.0.1',
    });

    const record = parseHibeanRoastCurveJson(jsonText, 'batch-1', 'hibean.json');

    expect(record.roastBatchId).toBe('batch-1');
    expect(record.source).toBe('hibean');
    expect(record.curveData).toHaveLength(6);
    expect(record.curveData[2]?.heatPower).toBe(60);
    expect(record.curveData[2]?.environmentTemperature).toBeUndefined();
    expect(record.eventList.map((event) => event.type)).toEqual([
      'charge',
      'turningPoint',
      'dryEnd',
      'firstCrackStart',
      'drop',
    ]);
    expect(record.metrics.firstCrackTime).toBe(447);
    expect(record.metrics.roastDuration).toBe(522);
    expect(record.metrics.developmentTime).toBe(75);
    expect(record.metrics.developmentRatio).toBeCloseTo(14.37, 2);
    expect(record.beanSnapshot?.greenBeanWeightGrams).toBe(200);
  });
});
