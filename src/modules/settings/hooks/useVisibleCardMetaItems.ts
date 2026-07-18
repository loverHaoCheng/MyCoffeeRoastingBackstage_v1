import { useMemo } from 'react';

import { cardDisplayModules } from '@/modules/settings/constants/cardDisplayModules';
import { useAppDisplaySettings } from '@/modules/settings/hooks/useAppDisplaySettings';
import type { AppCardModuleKey } from '@/modules/settings/types';
import type { UnifiedDataCardMetaItem } from '@/shared/components/UnifiedDataCard';

const getVisibleMetaKeys = (moduleKey: AppCardModuleKey): string[] => {
  return cardDisplayModules.find((module) => module.key === moduleKey)?.metaOptions.map((item) => item.key) ?? [];
};

export function useVisibleCardMetaItems(moduleKey: AppCardModuleKey, metaItems: UnifiedDataCardMetaItem[]) {
  const { appDisplaySettings } = useAppDisplaySettings();

  return useMemo(() => {
    const moduleSettings = appDisplaySettings.cardDisplaySettings[moduleKey];
    const displayCount = moduleSettings.displayCount;

    if (displayCount === 0) {
      return [];
    }

    const allowedKeys = getVisibleMetaKeys(moduleKey);
    const preferredKeys = moduleSettings.visibleMetaKeys.filter((key) => allowedKeys.includes(key));
    const metaItemByKey = new Map(metaItems.map((item) => [item.key, item] as const));
    const selectedItems = preferredKeys
      .map((key) => metaItemByKey.get(key))
      .filter((item): item is UnifiedDataCardMetaItem => item != null);

    return selectedItems.slice(0, displayCount);
  }, [appDisplaySettings.cardDisplaySettings, metaItems, moduleKey]);
}
