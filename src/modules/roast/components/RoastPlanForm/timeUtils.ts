export const parseTimeValue = (value: string): { end?: string; start: string } => {
  const parts = value.trim().split(/\s*(?:~|～|-)\s*/);
  return { start: parts[0] ?? '00:00', end: parts[1] };
};

export const normalizeTimePart = (value: string | undefined): string => {
  const match = value?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match?.[1] || !match[2]) return '00:00';
  const minute = Math.min(59, Math.max(0, Number(match[1])));
  const second = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
};
