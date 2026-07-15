export const ROASTER_MODEL_OPTIONS = ['tank200d', '其他'] as const;

export type RoastPlanRoasterModel = (typeof ROASTER_MODEL_OPTIONS)[number];

export const isRoasterModelOption = (value: string): value is RoastPlanRoasterModel => {
  return ROASTER_MODEL_OPTIONS.includes(value as RoastPlanRoasterModel);
};

export const normalizeRoasterModel = (value: null | string | undefined): RoastPlanRoasterModel => {
  const normalized = value?.trim().toLowerCase() ?? '';

  return normalized === 'tank200d' ? 'tank200d' : '其他';
};

export const roasterModelSelectOptions = ROASTER_MODEL_OPTIONS.map((value) => ({
  label: value,
  value,
}));
