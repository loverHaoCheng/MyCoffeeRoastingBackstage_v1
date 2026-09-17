export const formatUnit = (value: string, unit: string): string => {
  if (!value.trim() || value === '不可调' || value === '-') return value;
  return `${value.trim().replace(/(?:℃|°C|rpm|r|%)$/i, '')}${unit}`;
};

export const stripUnit = (value: string): string => value.replace(/(?:℃|°C|rpm|r|%)\s*$/i, '');
