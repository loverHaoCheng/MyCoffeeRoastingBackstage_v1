import {
  isSupabaseProjectUrl,
  normalizePocketBaseBaseUrl,
  normalizeSupabaseProjectUrl,
  resolvePocketBaseBaseUrl,
} from '@/services/pocketBaseConfig';

export type PocketBaseDataSource = 'greenBean' | 'roastedBean';
export type AppThemeMode = 'dark' | 'light';
export type AppCardModuleKey = 'beanInventory' | 'roastBatch' | 'roastPlan';
export type CardDisplayCount = 0 | 2 | 4;

export interface PocketBaseProjectConnection {
  projectUrl: string;
  publishableKey: string;
}

export const normalizePocketBaseProjectConnection = (
  connection: null | undefined | Partial<PocketBaseProjectConnection>,
  options: { fallbackToDefaultUrl?: boolean } = {},
): PocketBaseProjectConnection => {
  const fallbackProjectUrl = options.fallbackToDefaultUrl === false ? '' : resolvePocketBaseBaseUrl();
  const projectUrl = connection?.projectUrl?.trim() ?? '';

  return {
    projectUrl: projectUrl.length > 0 ? normalizePocketBaseBaseUrl(projectUrl) : fallbackProjectUrl,
    publishableKey: connection?.publishableKey?.trim() ?? '',
  };
};

const isLegacyRoastedBeanProjectUrl = (value: string): boolean => {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return false;
  }

  if (isSupabaseProjectUrl(normalizedValue)) {
    return false;
  }

  if (normalizedValue === resolvePocketBaseBaseUrl()) {
    return true;
  }

  return normalizePocketBaseBaseUrl(normalizedValue) === resolvePocketBaseBaseUrl();
};

export const normalizeRoastedBeanPocketBaseProjectConnection = (
  connection: null | undefined | Partial<PocketBaseProjectConnection>,
): PocketBaseProjectConnection => {
  const projectUrl = normalizeSupabaseProjectUrl(connection?.projectUrl);
  const publishableKey = connection?.publishableKey?.trim() ?? '';

  if (!projectUrl) {
    return {
      projectUrl: '',
      publishableKey,
    };
  }

  if (isLegacyRoastedBeanProjectUrl(projectUrl)) {
    return {
      projectUrl: '',
      publishableKey: '',
    };
  }

  return {
    projectUrl,
    publishableKey,
  };
};

export const isPocketBaseProjectConnectionConfigured = (
  connection: Pick<PocketBaseProjectConnection, 'projectUrl'>,
): boolean => {
  return connection.projectUrl.trim().length > 0;
};

export interface PocketBaseConnectionSettings {
  greenBean: PocketBaseProjectConnection;
  roastedBean: PocketBaseProjectConnection;
  updatedAt: null | string;
}

export type PocketBaseConnectionFormValues = Omit<PocketBaseConnectionSettings, 'updatedAt'>;

export interface CostTemplate {
  createdAt: string;
  dehydrationRate: number;
  energyCost: number;
  id: string;
  laborCost: number;
  name: string;
  notes: string;
  otherCost: number;
  packagingCost: number;
  roastInputWeightGrams: number;
  saleUnitWeightGrams: number;
  targetProfitRate: number;
  updatedAt: string;
}

export interface CostTemplateSettings {
  defaultTemplateId: null | string;
  templates: CostTemplate[];
  updatedAt: null | string;
}

export interface CostTemplateFormValues {
  dehydrationRate: number;
  energyCost: number;
  laborCost: number;
  name: string;
  notes: string;
  otherCost: number;
  packagingCost: number;
  roastInputWeightGrams: number;
  saleUnitWeightGrams: number;
  targetProfitRate: number;
}

export interface AppDisplaySettings {
  cardDisplaySettings: Record<AppCardModuleKey, CardMetaDisplaySettings>;
  scale: number;
  themeMode: AppThemeMode;
  updatedAt: null | string;
}

export interface CardMetaDisplaySettings {
  displayCount: CardDisplayCount;
  visibleMetaKeys: string[];
}

export interface AppDisplaySettingsInput {
  cardDisplaySettings?: Partial<{
    beanInventory?: Partial<CardMetaDisplaySettings>;
    roastBatch?: Partial<CardMetaDisplaySettings>;
    roastPlan?: Partial<CardMetaDisplaySettings>;
  }>;
  scale?: number;
  themeMode?: AppThemeMode;
  updatedAt?: null | string;
}

export const appDisplayScaleMin = 0.85;
export const appDisplayScaleMax = 1.2;
export const appDisplayScaleStep = 0.05;

const defaultBeanInventoryVisibleKeys = [
  'stock',
  'cost',
  'supplier',
  'process',
  'originCountry',
  'originRegion',
  'originArea',
  'millName',
  'variety',
  'grade',
  'harvestSeason',
  'code',
  'defaultRoastInput',
  'defaultSaleUnitPrice',
  'defaultSaleUnitWeight',
  'costTemplateId',
  'purchasedWeight',
  'purchasedTotalPrice',
  'remainingWeight',
  'altitudeMetersMin',
  'altitudeMetersMax',
  'moisturePercent',
  'densityGPerL',
  'notes',
] as const;
const legacyDefaultBeanInventoryVisibleKeys = ['stock', 'cost', 'supplier', 'process'] as const;

const defaultCardMetaVisibleKeys: Record<AppCardModuleKey, string[]> = {
  beanInventory: [...defaultBeanInventoryVisibleKeys],
  roastBatch: ['inputWeight', 'outputWeight', 'lossRate', 'roastPlan'],
  roastPlan: ['beanName', 'batchWeight', 'roastLevel', 'status'],
};

const normalizeVisibleMetaKeys = (
  visibleMetaKeys: unknown,
  defaultKeys: string[],
  displayCount: CardDisplayCount,
): string[] => {
  if (!Array.isArray(visibleMetaKeys)) {
    return defaultKeys.slice(0, displayCount);
  }

  const normalized = Array.from(
    new Set(
      visibleMetaKeys.filter((key): key is string => typeof key === 'string' && defaultKeys.includes(key)),
    ),
  );

  if (normalized.length === 0) {
    return defaultKeys.slice(0, displayCount);
  }

  const nextValue = normalized.slice(0, displayCount);

  while (nextValue.length < displayCount) {
    const fallbackKey = defaultKeys.find((key) => !nextValue.includes(key));

    if (!fallbackKey) {
      break;
    }

    nextValue.push(fallbackKey);
  }

  return nextValue;
};

const normalizeCardMetaDisplaySettings = (
  value: Partial<CardMetaDisplaySettings> | null | undefined,
  defaultKeys: string[],
): CardMetaDisplaySettings => {
  const displayCount: CardDisplayCount =
    value?.displayCount === 0 || value?.displayCount === 2 || value?.displayCount === 4
      ? value.displayCount
      : 4;

  return {
    displayCount,
    visibleMetaKeys: normalizeVisibleMetaKeys(value?.visibleMetaKeys, defaultKeys, displayCount),
  };
};

const shouldUpgradeLegacyBeanInventoryKeys = (
  value: Partial<CardMetaDisplaySettings> | null | undefined,
): boolean => {
  if (value?.displayCount !== 4 || !Array.isArray(value.visibleMetaKeys)) {
    return false;
  }

  return legacyDefaultBeanInventoryVisibleKeys.every((key, index) => value.visibleMetaKeys?.[index] === key);
};

export const normalizeAppDisplaySettings = (
  value: AppDisplaySettingsInput | null | undefined,
): AppDisplaySettings => {
  const defaultSettings = createDefaultAppDisplaySettings();
  const source = value ?? {};

  return {
    cardDisplaySettings: {
      beanInventory: normalizeCardMetaDisplaySettings(
        shouldUpgradeLegacyBeanInventoryKeys(source.cardDisplaySettings?.beanInventory)
          ? {
              ...source.cardDisplaySettings?.beanInventory,
              visibleMetaKeys: [...defaultBeanInventoryVisibleKeys],
            }
          : source.cardDisplaySettings?.beanInventory,
        defaultCardMetaVisibleKeys.beanInventory,
      ),
      roastBatch: normalizeCardMetaDisplaySettings(
        source.cardDisplaySettings?.roastBatch,
        defaultCardMetaVisibleKeys.roastBatch,
      ),
      roastPlan: normalizeCardMetaDisplaySettings(
        source.cardDisplaySettings?.roastPlan,
        defaultCardMetaVisibleKeys.roastPlan,
      ),
    },
    scale:
      typeof source.scale === 'number' &&
      Number.isFinite(source.scale) &&
      source.scale >= appDisplayScaleMin &&
      source.scale <= appDisplayScaleMax
        ? source.scale
        : defaultSettings.scale,
    themeMode: source.themeMode === 'dark' ? 'dark' : 'light',
    updatedAt: source.updatedAt ?? null,
  };
};

export const createEmptyPocketBaseProjectConnection = (): PocketBaseProjectConnection => ({
  projectUrl: resolvePocketBaseBaseUrl(),
  publishableKey: '',
});

export const createEmptyRoastedBeanPocketBaseProjectConnection = (): PocketBaseProjectConnection => ({
  projectUrl: '',
  publishableKey: '',
});

export const createDefaultPocketBaseConnectionSettings = (): PocketBaseConnectionSettings => ({
  greenBean: createEmptyPocketBaseProjectConnection(),
  roastedBean: createEmptyRoastedBeanPocketBaseProjectConnection(),
  updatedAt: null,
});

export const createEmptyCostTemplateFormValues = (): CostTemplateFormValues => ({
  dehydrationRate: 14,
  energyCost: 0,
  laborCost: 0,
  name: '',
  notes: '',
  otherCost: 0,
  packagingCost: 0,
  roastInputWeightGrams: 200,
  saleUnitWeightGrams: 100,
  targetProfitRate: 30,
});

export const createDefaultCostTemplateSettings = (): CostTemplateSettings => {
  return {
    defaultTemplateId: null,
    templates: [],
    updatedAt: null,
  };
};

export const createDefaultAppDisplaySettings = (): AppDisplaySettings => ({
  cardDisplaySettings: {
    beanInventory: {
      displayCount: 4,
      visibleMetaKeys: defaultCardMetaVisibleKeys.beanInventory.slice(0, 4),
    },
    roastBatch: {
      displayCount: 4,
      visibleMetaKeys: defaultCardMetaVisibleKeys.roastBatch.slice(0, 4),
    },
    roastPlan: {
      displayCount: 4,
      visibleMetaKeys: defaultCardMetaVisibleKeys.roastPlan.slice(0, 4),
    },
  },
  scale: 1,
  themeMode: 'light',
  updatedAt: null,
});
