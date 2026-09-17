export const toMoney = (value: number): number => {
  return Number(value.toFixed(2));
};

export const formatRevenueUnitCount = (value: number): string => {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
};
