export const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';

interface ShanghaiDateParts {
  day: string;
  hour: string;
  minute: string;
  month: string;
  second: string;
  year: string;
}

const formatter = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  month: '2-digit',
  second: '2-digit',
  timeZone: SHANGHAI_TIME_ZONE,
  year: 'numeric',
});

const toDate = (value: Date | string): Date | null => {
  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

export const getShanghaiDateParts = (value: Date | string): ShanghaiDateParts | null => {
  const date = toDate(value);

  if (!date) {
    return null;
  }

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const year = parts.year;
  const month = parts.month;
  const day = parts.day;
  const hour = parts.hour;
  const minute = parts.minute;
  const second = parts.second;

  return year && month && day && hour && minute && second
    ? { day, hour, minute, month, second, year }
    : null;
};

export const toShanghaiDateString = (value: Date | string): string => {
  const parts = getShanghaiDateParts(value);

  return parts ? `${parts.year}-${parts.month}-${parts.day}` : '';
};

export const formatShanghaiDateTime = (value: Date | string): string => {
  const parts = getShanghaiDateParts(value);

  return parts
    ? `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
    : '时间无效';
};

export const formatShanghaiBuildVersion = (version: string): string => {
  const match = /^(.*)-(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)$/.exec(version);

  const packageVersion = match?.[1];
  const timestamp = match?.[2];

  if (!packageVersion || !timestamp) {
    return version;
  }

  return `${packageVersion} · ${formatShanghaiDateTime(timestamp)} 北京时间`;
};
