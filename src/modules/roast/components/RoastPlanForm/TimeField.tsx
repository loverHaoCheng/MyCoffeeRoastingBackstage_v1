import { TimePicker } from '@/shared/components/ui/time-picker';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { normalizeTimePart, parseTimeValue } from './timeUtils';
import styles from '../RoastPlanManualCreator.module.css';

interface TimeFieldProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
}

export const TimeField = ({ name, value, onChange }: TimeFieldProps) => {
  const parsed = parseTimeValue(value);
  const [startMinute, startSecond] = normalizeTimePart(parsed.start).split(':');
  const [endMinute, endSecond] = normalizeTimePart(parsed.end).split(':');
  const update = (start: string, end?: string): void => { onChange(end ? `${start}~${end}` : start); };
  const endpoint = (minute: string, second: string, label: string, onValue: (next: string) => void) => (
    <span className={styles.timeEndpoint}>
      <TimePicker
        label={`${label}分钟`}
        max={59}
        min={0}
        onChange={(value) => {
          onValue(`${String(value).padStart(2, '0')}:${second}`);
        }}
        value={Number(minute)}
      />
      <span>:</span>
      <TimePicker
        label={`${label}秒`}
        max={59}
        min={0}
        onChange={(value) => {
          onValue(`${minute}:${String(value).padStart(2, '0')}`);
        }}
        value={Number(second)}
      />
    </span>
  );

  return (
    <div className={styles.timeField}>
      <input aria-hidden="true" className={styles.timeValue} name={name} onChange={(event) => { onChange(event.target.value); }} tabIndex={-1} type="text" value={value} />
      <Tabs className={styles.timeModeTabs} value={parsed.end ? 'range' : 'single'} onValueChange={(next) => { update(normalizeTimePart(parsed.start), next === 'range' ? '00:00' : undefined); }}>
        <TabsList>
          <TabsTrigger value="single">单个时间</TabsTrigger>
          <TabsTrigger value="range">时间范围</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className={styles.timeValues}>
        <span className={styles.timeGroup}>
          <span className={styles.timeLabel}>开始时间</span>
          {endpoint(startMinute ?? '00', startSecond ?? '00', '开始时间', (next) => { update(next, parsed.end); })}
        </span>
        {parsed.end ? <span className={styles.timeGroup}><span className={styles.timeLabel}>结束时间</span>{endpoint(endMinute ?? '00', endSecond ?? '00', '结束时间', (next) => { update(normalizeTimePart(parsed.start), next); })}</span> : null}
      </div>
    </div>
  );
};
