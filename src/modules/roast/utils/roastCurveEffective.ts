import type {
  RoastCurveEditableEventType,
  RoastCurveEvent,
  RoastCurveEventOverrides,
  RoastCurveEventType,
  RoastCurveMetrics,
  RoastCurvePhase,
  RoastCurvePoint,
  RoastCurveRecord,
} from '@/modules/roast/types/roastCurve';

const EDITABLE_EVENT_TYPES: RoastCurveEditableEventType[] = [
  'charge',
  'turningPoint',
  'dryEnd',
  'firstCrackStart',
  'firstCrackEnd',
  'drop',
];

const getEvent = (events: RoastCurveEvent[], type: RoastCurveEventType): RoastCurveEvent | undefined =>
  events.find((event) => event.type === type);

const getNearestPointIndex = (points: RoastCurvePoint[], timeSeconds: number): number | undefined => {
  if (points.length === 0) return undefined;

  return points.reduce((nearestIndex, point, index) => {
    const nearestPoint = points[nearestIndex];
    return nearestPoint && Math.abs(point.timeSeconds - timeSeconds) < Math.abs(nearestPoint.timeSeconds - timeSeconds)
      ? index
      : nearestIndex;
  }, 0);
};

const getEventSampleIndex = (
  event: RoastCurveEvent | undefined,
  points: RoastCurvePoint[],
  override: { sampleIndex: number } | undefined,
): number | undefined => {
  if (override && Number.isInteger(override.sampleIndex) && points[override.sampleIndex]) {
    return override.sampleIndex;
  }

  return event ? getNearestPointIndex(points, event.timeSeconds) : undefined;
};

const toMetric = (event: RoastCurveEvent | undefined): Pick<RoastCurveMetrics, 'chargeTemperature' | 'chargeTime'> => ({
  chargeTemperature: event?.temperature,
  chargeTime: event?.timeSeconds,
});

const makeMetrics = (events: RoastCurveEvent[]): RoastCurveMetrics => {
  const charge = getEvent(events, 'charge');
  const turningPoint = getEvent(events, 'turningPoint');
  const dryEnd = getEvent(events, 'dryEnd');
  const firstCrack = getEvent(events, 'firstCrackStart');
  const drop = getEvent(events, 'drop');
  const roastDuration = drop?.timeSeconds;
  const developmentTime = firstCrack && roastDuration != null ? Math.max(0, roastDuration - firstCrack.timeSeconds) : undefined;

  return {
    ...toMetric(charge),
    developmentRatio: developmentTime != null && roastDuration != null && roastDuration > 0 ? (developmentTime / roastDuration) * 100 : undefined,
    developmentTime,
    dryEndTemperature: dryEnd?.temperature,
    dryEndTime: dryEnd?.timeSeconds,
    dropTemperature: drop?.temperature,
    dropTime: drop?.timeSeconds,
    firstCrackTemperature: firstCrack?.temperature,
    firstCrackTime: firstCrack?.timeSeconds,
    roastDuration,
    turningPointTemperature: turningPoint?.temperature,
    turningPointTime: turningPoint?.timeSeconds,
  };
};

const makePhases = (events: RoastCurveEvent[], roastDuration: number | undefined): RoastCurvePhase[] => {
  const dryEnd = getEvent(events, 'dryEnd');
  const firstCrack = getEvent(events, 'firstCrackStart');
  const durations = [
    { durationSeconds: dryEnd?.timeSeconds, label: '脱水', phase: 2 },
    { durationSeconds: dryEnd && firstCrack ? firstCrack.timeSeconds - dryEnd.timeSeconds : undefined, label: '梅纳', phase: 3 },
    { durationSeconds: firstCrack && roastDuration != null ? roastDuration - firstCrack.timeSeconds : undefined, label: '发展', phase: 4 },
  ];

  return durations
    .filter((phase): phase is { durationSeconds: number; label: string; phase: number } => phase.durationSeconds != null && phase.durationSeconds >= 0)
    .map((phase) => ({
      ...phase,
      percentage: roastDuration != null && roastDuration > 0 ? phase.durationSeconds / roastDuration : 0,
    }));
};

export const getEditableCurveEventTypes = (curve: RoastCurveRecord): RoastCurveEditableEventType[] =>
  EDITABLE_EVENT_TYPES.filter((type) => getEvent(curve.eventList, type) != null);

export const resolveEffectiveRoastCurve = (curve: RoastCurveRecord): RoastCurveRecord => {
  const points = curve.curveData;
  const selectedIndexes = new Map<RoastCurveEditableEventType, number>();

  EDITABLE_EVENT_TYPES.forEach((type) => {
    const index = getEventSampleIndex(getEvent(curve.eventList, type), points, curve.eventOverrides?.[type]);
    if (index != null) selectedIndexes.set(type, index);
  });

  const rawChargeIndex = selectedIndexes.get('charge') ?? 0;
  const rawDropIndex = selectedIndexes.get('drop') ?? points.length - 1;
  const startIndex = Math.min(rawChargeIndex, rawDropIndex);
  const endIndex = Math.max(rawChargeIndex, rawDropIndex);
  const chargeTime = points[startIndex]?.timeSeconds ?? 0;
  const effectivePoints = points.slice(startIndex, endIndex + 1).map((point) => ({
    ...point,
    timeSeconds: point.timeSeconds - chargeTime,
  }));
  const effectiveEvents = curve.eventList
    .map((event) => {
      const type = event.type as RoastCurveEditableEventType;
      const index = EDITABLE_EVENT_TYPES.includes(type) ? selectedIndexes.get(type) : getNearestPointIndex(points, event.timeSeconds);
      const point = index == null ? undefined : points[index];
      const rawTime = point?.timeSeconds ?? event.timeSeconds;

      if (rawTime < chargeTime || rawTime > (points[endIndex]?.timeSeconds ?? rawTime)) return undefined;

      return {
        ...event,
        ...(point?.beanTemperature != null ? { temperature: point.beanTemperature } : {}),
        timeSeconds: rawTime - chargeTime,
      };
    })
    .filter((event): event is RoastCurveEvent => event != null)
    .sort((left, right) => left.timeSeconds - right.timeSeconds);
  const metrics = makeMetrics(effectiveEvents);

  return {
    ...curve,
    curveData: effectivePoints,
    eventList: effectiveEvents,
    metrics,
    phaseList: makePhases(effectiveEvents, metrics.roastDuration),
  };
};

export const isValidEventOverrideOrder = (curve: RoastCurveRecord, overrides: RoastCurveEventOverrides): boolean => {
  let previousIndex = -1;

  for (const type of EDITABLE_EVENT_TYPES) {
    const index = getEventSampleIndex(getEvent(curve.eventList, type), curve.curveData, overrides[type]);
    if (index == null) continue;
    if (index < previousIndex) return false;
    previousIndex = index;
  }

  return true;
};
