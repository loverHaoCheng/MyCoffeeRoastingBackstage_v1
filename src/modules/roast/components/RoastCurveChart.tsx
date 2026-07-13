import type { RoastCurveEvent, RoastCurvePhase, RoastCurvePoint } from '@/modules/roast/types/roastCurve';

import styles from './RoastCurveChart.module.css';

export type RoastCurveRorMode = 'sensitive' | 'balanced' | 'gentle';

interface RoastCurveChartProps {
  events: RoastCurveEvent[];
  phaseList: RoastCurvePhase[];
  points: RoastCurvePoint[];
  rorMode: RoastCurveRorMode;
  temperatureUnit: string;
}

interface ChartPoint {
  beanTemperature?: number;
  rateOfRise?: number;
  timeSeconds: number;
}

const CHART_WIDTH = 760;
const CHART_HEIGHT = 420;
const PADDING = {
  bottom: 46,
  left: 48,
  right: 48,
  top: 70,
};
const PHASE_BAR_Y = 304;
const PHASE_BAR_HEIGHT = 22;
const LEGEND_Y = 398;
const MAX_EVENT_LABEL_LENGTH = 4;

const ROR_SMOOTHING_POINTS: Record<RoastCurveRorMode, number> = {
  balanced: 7,
  gentle: 15,
  sensitive: 1,
};
const PHASE_COLORS: Record<number, string> = {
  2: '#0f8b4c',
  3: '#b77a2b',
  4: '#a4517a',
};

const EVENT_LABEL_POSITIONS: Partial<Record<RoastCurveEvent['type'], { anchor: 'end' | 'middle' | 'start'; dx: number; y: number }>> = {
  charge: { anchor: 'start', dx: 8, y: 54 },
  dryEnd: { anchor: 'middle', dx: 0, y: 54 },
  drop: { anchor: 'end', dx: -8, y: 54 },
  firstCrackStart: { anchor: 'middle', dx: 0, y: 90 },
  turningPoint: { anchor: 'start', dx: 8, y: 90 },
};

const getRange = (values: number[]): [number, number] => {
  const finiteValues = values.filter((value) => Number.isFinite(value));

  if (finiteValues.length === 0) {
    return [0, 1];
  }

  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);

  if (min === max) {
    return [min - 1, max + 1];
  }

  return [min, max];
};

const toLinePath = (
  points: ChartPoint[],
  getValue: (point: ChartPoint) => number | undefined,
  getX: (timeSeconds: number) => number,
  getY: (value: number) => number,
): string => {
  const commands: string[] = [];
  let open = false;

  points.forEach((point) => {
    const value = getValue(point);

    if (value == null || !Number.isFinite(value)) {
      open = false;
      return;
    }

    commands.push(`${open ? 'L' : 'M'} ${getX(point.timeSeconds).toFixed(2)} ${getY(value).toFixed(2)}`);
    open = true;
  });

  return commands.join(' ');
};

const formatTime = (seconds: number): string => {
  const sign = seconds < 0 ? '-' : '';
  const absoluteSeconds = Math.abs(seconds);
  const minutes = Math.floor(absoluteSeconds / 60);
  const remainingSeconds = Math.round(absoluteSeconds % 60);

  return `${sign}${String(minutes)}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`;

const smoothImportedRor = (points: ChartPoint[], mode: RoastCurveRorMode): ChartPoint[] => {
  const smoothingPoints = ROR_SMOOTHING_POINTS[mode];

  if (smoothingPoints <= 1) {
    return points;
  }

  const halfWindow = Math.floor(smoothingPoints / 2);

  return points.map((point, index) => {
    if (point.rateOfRise == null || !Number.isFinite(point.rateOfRise) || point.rateOfRise <= 0) {
      return {
        ...point,
        rateOfRise: undefined,
      };
    }

    const values = points
      .slice(Math.max(0, index - halfWindow), Math.min(points.length, index + halfWindow + 1))
      .map((item) => item.rateOfRise)
      .filter((value): value is number => value != null && Number.isFinite(value) && value > 0);

    if (values.length === 0) {
      return {
        ...point,
        rateOfRise: undefined,
      };
    }

    const average = values.reduce((sum, value) => sum + value, 0) / values.length;

    return {
      ...point,
      rateOfRise: average,
    };
  });
};

const getRorValue = (point: ChartPoint): number | undefined => {
  if (point.rateOfRise == null || !Number.isFinite(point.rateOfRise) || point.rateOfRise <= 0) {
    return undefined;
  }

  return point.rateOfRise;
};

const getNearestPoint = (points: ChartPoint[], timeSeconds: number): ChartPoint | undefined => {
  return points.reduce<ChartPoint | undefined>((nearest, point) => {
    if (!nearest) {
      return point;
    }

    return Math.abs(point.timeSeconds - timeSeconds) < Math.abs(nearest.timeSeconds - timeSeconds)
      ? point
      : nearest;
  }, undefined);
};

const getEventLabel = (event: RoastCurveEvent): string => {
  return event.label.length > MAX_EVENT_LABEL_LENGTH ? event.label.slice(0, MAX_EVENT_LABEL_LENGTH) : event.label;
};

const getPhaseStart = (phases: RoastCurvePhase[], phaseIndex: number): number => {
  return phases.slice(0, phaseIndex).reduce((sum, phase) => sum + phase.durationSeconds, 0);
};

export function RoastCurveChart({ events, phaseList, points, rorMode, temperatureUnit }: RoastCurveChartProps) {
  const dropTime = events.find((event) => event.type === 'drop')?.timeSeconds;
  const chartPoints = points
    .filter((point) => point.timeSeconds >= 0)
    .filter((point) => dropTime == null || point.timeSeconds <= dropTime)
    .map<ChartPoint>((point) => ({
      beanTemperature: point.beanTemperature,
      rateOfRise: point.rateOfRise,
      timeSeconds: point.timeSeconds,
    }));
  const rorPoints = smoothImportedRor(chartPoints, rorMode);

  if (chartPoints.length < 2) {
    return <p className={styles.empty}>曲线点不足，无法绘制图表。</p>;
  }

  const [minTime, maxTime] = getRange(chartPoints.map((point) => point.timeSeconds));
  const [minTemp, maxTemp] = getRange(chartPoints.map((point) => point.beanTemperature ?? Number.NaN));
  const [, maxRorValue] = getRange(rorPoints.map((point) => getRorValue(point) ?? Number.NaN));
  const maxRor = Math.max(20, Math.ceil(maxRorValue / 5) * 5);
  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = PHASE_BAR_Y - PADDING.top - 10;
  const timeSpan = maxTime - minTime || 1;
  const tempSpan = maxTemp - minTemp || 1;
  const getX = (timeSeconds: number) => PADDING.left + ((timeSeconds - minTime) / timeSpan) * plotWidth;
  const getTempY = (value: number) => PADDING.top + (1 - (value - minTemp) / tempSpan) * plotHeight;
  const getRorY = (value: number) => PADDING.top + (1 - value / maxRor) * plotHeight;
  const tempPath = toLinePath(chartPoints, (point) => point.beanTemperature, getX, getTempY);
  const rorPath = toLinePath(rorPoints, getRorValue, getX, getRorY);
  const visibleEvents = events
    .filter((event) => event.timeSeconds >= minTime && event.timeSeconds <= maxTime)
    .filter((event) => event.type !== 'unknown');
  const rorTicks = [maxRor, maxRor / 2, 0];
  const minuteTicks = Array.from(
    { length: Math.floor(maxTime / 60) - Math.ceil(minTime / 60) + 1 },
    (_, index) => (Math.ceil(minTime / 60) + index) * 60,
  ).filter((tick) => tick >= minTime && tick <= maxTime);

  return (
    <div className={styles.chartWrap}>
      <svg
        aria-label="烘焙曲线图"
        className={styles.chart}
        role="img"
        viewBox={`0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`}
      >
        <rect className={styles.chartSurface} height={CHART_HEIGHT} rx="10" width={CHART_WIDTH} x="0" y="0" />
        <line
          className={styles.axis}
          x1={PADDING.left}
          x2={CHART_WIDTH - PADDING.right}
          y1={PHASE_BAR_Y - 10}
          y2={PHASE_BAR_Y - 10}
        />
        <line className={styles.axis} x1={PADDING.left} x2={PADDING.left} y1={PADDING.top} y2={PHASE_BAR_Y - 10} />
        <line
          className={styles.axis}
          x1={CHART_WIDTH - PADDING.right}
          x2={CHART_WIDTH - PADDING.right}
          y1={PADDING.top}
          y2={PHASE_BAR_Y - 10}
        />
        {minuteTicks.map((tick) => {
          const x = getX(tick);

          return (
            <g key={tick.toString()}>
              <line className={styles.minuteLine} x1={x} x2={x} y1={PADDING.top} y2={CHART_HEIGHT - PADDING.bottom} />
              <text className={styles.minuteLabel} textAnchor="middle" x={x} y={CHART_HEIGHT - 70}>
                {Math.floor(tick / 60).toString()}
              </text>
            </g>
          );
        })}
        {rorTicks.map((tick) => {
          const y = getRorY(tick);

          return (
            <g key={tick.toString()}>
              <line className={styles.gridLine} x1={PADDING.left} x2={CHART_WIDTH - PADDING.right} y1={y} y2={y} />
              <text className={styles.rorAxisLabel} textAnchor="start" x={CHART_WIDTH - PADDING.right + 6} y={y + 4}>
                {Math.round(tick).toString()}
              </text>
            </g>
          );
        })}
        <text className={styles.axisLabel} x={PADDING.left} y={CHART_HEIGHT - 7}>
          {formatTime(minTime)}
        </text>
        <text className={styles.axisLabel} textAnchor="end" x={CHART_WIDTH - PADDING.right} y={CHART_HEIGHT - 7}>
          {formatTime(maxTime)}
        </text>
        <text className={styles.axisLabel} x={6} y={PADDING.top + 8}>
          {Math.round(maxTemp).toString()}{temperatureUnit}
        </text>
        <text className={styles.axisLabel} x={6} y={CHART_HEIGHT - PADDING.bottom}>
          {Math.round(minTemp).toString()}{temperatureUnit}
        </text>
        {visibleEvents.map((event) => {
          const x = getX(event.timeSeconds);
          const nearestPoint = getNearestPoint(chartPoints, event.timeSeconds);
          const markerTemperature = event.temperature ?? nearestPoint?.beanTemperature;
          const markerY = markerTemperature == null ? PADDING.top : getTempY(markerTemperature);
          const labelPosition = EVENT_LABEL_POSITIONS[event.type] ?? { anchor: 'middle' as const, dx: 0, y: 72 };
          const labelX = x + labelPosition.dx;

          return (
            <g key={`${String(event.code)}-${event.timeSeconds.toString()}`}>
              <line className={styles.eventLine} x1={x} x2={x} y1={PADDING.top} y2={CHART_HEIGHT - PADDING.bottom} />
              <circle className={styles.eventMarker} cx={x} cy={markerY} r={5.2} />
              <text className={styles.eventLabel} textAnchor={labelPosition.anchor} x={labelX} y={labelPosition.y}>
                <tspan x={labelX}>{getEventLabel(event)}</tspan>
                <tspan x={labelX} dy="13">
                  {formatTime(event.timeSeconds)}
                  {markerTemperature == null ? '' : ` ${markerTemperature.toFixed(1)}${temperatureUnit}`}
                </tspan>
              </text>
            </g>
          );
        })}
        <path className={styles.tempLine} d={tempPath} fill="none" />
        {rorPath ? <path className={styles.rorLine} d={rorPath} fill="none" /> : null}
        {phaseList.map((phase, index) => {
          const startSeconds = getPhaseStart(phaseList, index);
          const phaseX = getX(startSeconds);
          const phaseWidth = Math.max(0, getX(startSeconds + phase.durationSeconds) - phaseX);
          const labelX = phaseX + phaseWidth / 2;

          return (
            <g key={`${phase.phase.toString()}-${phase.label}`}>
              <rect
                className={styles.phaseSegment}
                fill={PHASE_COLORS[phase.phase] ?? '#555'}
                height={PHASE_BAR_HEIGHT}
                width={phaseWidth}
                x={phaseX}
                y={PHASE_BAR_Y}
              />
              <text className={styles.phaseLabel} textAnchor="middle" x={labelX} y={PHASE_BAR_Y + 15}>
                {formatTime(phase.durationSeconds)} {formatPercent(phase.percentage)}
              </text>
            </g>
          );
        })}
        <line className={styles.baseLine} x1={PADDING.left} x2={CHART_WIDTH - PADDING.right} y1={CHART_HEIGHT - 45} y2={CHART_HEIGHT - 45} />
        <g className={styles.legend} transform={`translate(${String(CHART_WIDTH / 2 - 150)} ${String(LEGEND_Y)})`}>
          <circle className={styles.tempDot} cx="0" cy="0" r="4" />
          <text x="14" y="5">豆温</text>
          <circle className={styles.rorDot} cx="92" cy="0" r="4" />
          <text x="106" y="5">RoR</text>
          <circle className={styles.powerDot} cx="184" cy="0" r="4" />
          <text x="198" y="5">火力</text>
          <circle className={styles.drumDot} cx="276" cy="0" r="4" />
          <text x="290" y="5">转速</text>
        </g>
      </svg>
    </div>
  );
}
