import type { ApiResponse } from '@/services/api.types';
import { httpClient } from '@/services/httpClient';

import type { RoastAiFeature, RoastAiUsage } from '../types/roastAiUsage';

const isRoastAiUsage = (value: unknown): value is RoastAiUsage => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<RoastAiUsage>;

  return (
    typeof candidate.enabled === 'boolean' &&
    typeof candidate.monthlyLimit === 'number' &&
    typeof candidate.remainingUses === 'number' &&
    typeof candidate.usedThisMonth === 'number'
  );
};

export const formatRoastAiUsageText = (
  usage: RoastAiUsage | null | undefined,
  options: { error?: string; isLoading?: boolean } = {},
): string => {
  if (options.isLoading) {
    return '额度读取中';
  }

  if (options.error) {
    return `额度读取失败：${options.error}`;
  }

  if (!usage) {
    return '剩余额度待检测';
  }

  if (!usage.enabled) {
    return '当前账号已关闭';
  }

  return `本月剩余 ${String(usage.remainingUses)} / ${String(usage.monthlyLimit)}`;
};

export const isRoastAiUsageAvailable = (usage: RoastAiUsage | null | undefined): boolean => {
  return usage?.enabled === true && usage.remainingUses > 0;
};

export const roastAiUsageService = {
  async getUsage(feature: RoastAiFeature): Promise<RoastAiUsage> {
    const searchParams = new URLSearchParams({ feature });
    const response = await httpClient.get<RoastAiUsage>(`/ai/roast-usage?${searchParams.toString()}`);
    const data = (response as ApiResponse<unknown>).data;

    if (!isRoastAiUsage(data)) {
      throw new Error('烘焙 AI 额度接口返回格式不符合约定。');
    }

    return data;
  },
};
