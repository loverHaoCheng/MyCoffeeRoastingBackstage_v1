export const getErrorMessage = (error: { message?: string } | undefined): string | undefined => {
  return typeof error?.message === 'string' ? error.message : undefined;
};

export const getHelpText = (message: string | undefined, fallback: string): string => {
  return message ?? fallback;
};

export const getBatchCountById = (batchIds: string[]): Map<string, number> => {
  return batchIds.reduce((counts, batchId) => {
    counts.set(batchId, (counts.get(batchId) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
};

export const repeatBatchId = (batchId: string, count: number): string[] => {
  return Array.from({ length: count }, () => batchId);
};
