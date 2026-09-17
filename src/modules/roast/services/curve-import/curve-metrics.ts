import type {
  RoastCurveEvent,
  RoastCurveEventType,
  RoastCurveMetrics,
  RoastCurvePoint,
} from '../../types/roastCurve';

export const findEvent = (events: RoastCurveEvent[], type: RoastCurveEventType): RoastCurveEvent | undefined => {
  return events.find((event) => event.type === type);
};

export const deriveMetrics = (
  sourceDuration: number | undefined,
  events: RoastCurveEvent[],
  points: RoastCurvePoint[],
): RoastCurveMetrics => {
  const charge = findEvent(events, 'charge');
  const turningPoint = findEvent(events, 'turningPoint');
  const dryEnd = findEvent(events, 'dryEnd');
  const firstCrack = findEvent(events, 'firstCrackStart');
  const drop = findEvent(events, 'drop');
  const latestRoastPoint = points.filter((point) => point.timeSeconds >= 0).at(-1);
  const roastDuration = drop?.timeSeconds ?? sourceDuration ?? latestRoastPoint?.timeSeconds;
  const developmentTime =
    firstCrack?.timeSeconds != null && roastDuration != null
      ? Math.max(0, roastDuration - firstCrack.timeSeconds)
      : undefined;
  const developmentRatio =
    developmentTime != null && roastDuration != null && roastDuration > 0
      ? (developmentTime / roastDuration) * 100
      : undefined;

  return {
    chargeTemperature: charge?.temperature,
    chargeTime: charge?.timeSeconds,
    developmentRatio,
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

export const getNearestPointTemperature = (
  points: RoastCurvePoint[],
  timeSeconds: number,
): number | undefined => {
  return points.reduce<RoastCurvePoint | undefined>((nearest, point) => {
    if (!nearest) {
      return point;
    }

    const currentDistance = Math.abs(point.timeSeconds - timeSeconds);
    const nearestDistance = Math.abs(nearest.timeSeconds - timeSeconds);

    return currentDistance < nearestDistance ? point : nearest;
  }, undefined)?.beanTemperature;
};

export const getMedianSampleInterval = (points: RoastCurvePoint[]): number | undefined => {
  const intervals = points
    .slice(1)
    .map((point, index) => {
      const previous = points[index];

      return previous ? point.timeSeconds - previous.timeSeconds : 0;
    })
    .filter((duration) => Number.isFinite(duration) && duration > 0)
    .sort((left, right) => left - right);

  if (intervals.length === 0) {
    return undefined;
  }

  return intervals[Math.floor(intervals.length / 2)];
};
