import { beanService } from '@/modules/bean/services';
import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { isPocketBaseProjectConnectionConfigured } from '@/modules/settings/types';
import { isSupabaseProjectUrl } from '@/services/pocketBaseConfig';
import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger/logger';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';
import { RoastedBeanSupabaseDataClient } from '@/services/roastedBeanSupabaseDataClient';
import type { Bean } from '@/types/domain';

import { normalizeRoastLevel } from '../constants/roastLevel';
import type { RoastBatchRecord } from '../types/roastBatch';

const ROASTED_COFFEE_BEANS_TABLE = 'coffee_beans';
const DEFAULT_SINGLE_USER_ID = 'default_user';

type CoffeeBeanType = 'espresso' | 'filter' | 'omni';
type CoffeeBeanState = 'green' | 'roasted';

interface RoastedCoffeeBeanMirrorRow {
  id: string;
  user_id: string;
}

interface CoffeeBeanBlendComponent {
  percentage: number;
  estate: string;
  origin: string;
  process: string;
  variety: string;
}

interface CoffeeBeanMirrorData {
  id: string;
  timestamp: number;
  name: string;
  roaster: string;
  image: string;
  backImage: string;
  capacity: string;
  remaining: string;
  price: string;
  roastLevel: string;
  roastDate: string;
  flavor: string[];
  notes: string;
  startDay: number;
  endDay: number;
  isFrozen: boolean;
  isInTransit: boolean;
  beanType: CoffeeBeanType;
  beanState: CoffeeBeanState;
  brand: string;
  purchaseDate: string;
  sourceGreenBeanId: string;
  overallRating: number;
  ratingNotes: string;
  blendComponents: CoffeeBeanBlendComponent[];
  roastBatchId: string;
  roastedBeanName: string;
  roastPlanId: string;
  roastPlanName: string;
  inputWeightGrams: number;
  outputWeightGrams: number;
  developmentRatio: number | null;
  firstCrackTime: number | null;
  totalRoastTime: number | null;
  status: RoastBatchRecord['status'];
  imageUrls: string[];
  greenBeanCode: string;
  greenBeanDisplayName: string;
  greenBeanOrigin: string;
  greenBeanOriginCountry: string;
  greenBeanOriginRegion: string;
  greenBeanOriginArea: string;
  greenBeanProcess: string;
  greenBeanGrade: string;
  greenBeanVariety: string;
  greenBeanHarvestSeason: string;
  greenBeanMillName: string;
  greenBeanNotes: string;
  greenBeanDefaultRoastInputGrams: number;
  greenBeanDefaultSaleUnitPrice: number | null;
  greenBeanDefaultSaleUnitWeightGrams: number | null;
  greenBeanPurchasedTotalPrice: number | null;
  greenBeanPurchasedWeightGrams: number | null;
  greenBeanRemainingWeightGrams: number | null;
  greenBeanStockKg: number | null;
  greenBeanCostPerKg: number | null;
  greenBeanSupplierId: number | null;
  greenBeanSupplierName: string;
  greenBeanCreatedAt: string;
  greenBeanUpdatedAt: string;
}

interface MirrorBeanContext {
  bean: Bean | null;
  blendComponent: CoffeeBeanBlendComponent;
}

const getTrimmedText = (value: string | null | undefined): string => {
  return value?.trim() ?? '';
};

const resolveMirrorBaseName = (batch: RoastBatchRecord): string => {
  const candidates = [batch.roastedBeanName, batch.greenBeanName, batch.roastPlanName];

  for (const candidate of candidates) {
    const value = getTrimmedText(candidate);

    if (value.length > 0) {
      return value;
    }
  }

  return batch.greenBeanName;
};

const resolveMirrorName = (batch: RoastBatchRecord, bean: Bean | null): string => {
  const baseName = resolveMirrorBaseName(batch);
  const process = getTrimmedText(bean?.process);

  if (baseName.length === 0) {
    return process;
  }

  return process.length > 0 ? `${baseName} ${process}` : baseName;
};

const resolveBeanType = (batch: RoastBatchRecord, bean: Bean | null): CoffeeBeanType => {
  const sourceText = [
    batch.roastedBeanName,
    batch.roastPlanName,
    batch.notes,
    bean?.name,
    bean?.origin,
    bean?.process,
    bean?.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (sourceText.includes('espresso') || sourceText.includes('soe') || sourceText.includes('意式')) {
    return 'espresso';
  }

  if (
    sourceText.includes('omni') ||
    sourceText.includes('全能') ||
    sourceText.includes('通用') ||
    sourceText.includes('万能')
  ) {
    return 'omni';
  }

  return 'filter';
};

const resolveTimestamp = (batch: RoastBatchRecord): number => {
  const parsedTimestamp = new Date(batch.updatedAt || batch.createdAt || batch.roastDate).getTime();

  return Number.isNaN(parsedTimestamp) ? Date.now() : parsedTimestamp;
};

const formatDateOnly = (value: string): string => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10);
  }

  return parsed.toISOString().slice(0, 10);
};

const resolvePurchaseDate = (batch: RoastBatchRecord, bean: Bean | null): string => {
  const purchaseDateCandidates = [bean?.createdAt, batch.createdAt, batch.roastDate];

  for (const candidate of purchaseDateCandidates) {
    const value = getTrimmedText(candidate);

    if (value.length > 0) {
      return value;
    }
  }

  return batch.roastDate;
};

const resolveImageUrl = (batch: RoastBatchRecord, index: number): string => {
  const url = batch.imageUrls?.[index];

  return typeof url === 'string' ? url.trim() : '';
};

const resolveSaleUnitWeight = (bean: Bean | null): string => {
  if (bean?.defaultSaleUnitWeightGrams != null && bean.defaultSaleUnitWeightGrams > 0) {
    return String(bean.defaultSaleUnitWeightGrams);
  }

  return '';
};

const resolveSaleUnitPrice = (bean: Bean | null): string => {
  if (bean?.defaultSaleUnitPrice != null && bean.defaultSaleUnitPrice > 0) {
    return String(bean.defaultSaleUnitPrice);
  }

  return '';
};

const resolveBlendComponent = (bean: Bean | null): CoffeeBeanBlendComponent => ({
  percentage: 100,
  estate: bean?.name ?? '',
  origin: bean?.origin ?? '',
  process: bean?.process ?? '',
  variety: bean?.variety ?? bean?.grade ?? '',
});

const resolveBeanContext = async (batch: RoastBatchRecord): Promise<MirrorBeanContext> => {
  try {
    const response = await beanService.getBeanById(batch.greenBeanId);
    const bean: Bean | null = response.data;

    return {
      bean,
      blendComponent: resolveBlendComponent(bean),
    };
  } catch (error) {
    logger.warn('mirror bean detail lookup failed, falling back to empty blend component', {
      batchId: batch.id,
      error,
    });

    return {
      bean: null,
      blendComponent: resolveBlendComponent(null),
    };
  }
};

export const buildMirrorData = (
  batch: RoastBatchRecord,
  bean: Bean | null,
  blendComponent: CoffeeBeanBlendComponent,
): CoffeeBeanMirrorData => {
  const capacity = resolveSaleUnitWeight(bean);
  const price = resolveSaleUnitPrice(bean);
  const remaining = capacity || (batch.outputWeightGrams > 0 ? String(batch.outputWeightGrams) : '');
  const brand = getTrimmedText(bean?.supplierName) || getTrimmedText(bean?.name);
  const imageUrls = batch.imageUrls?.filter((url): url is string => typeof url === 'string').map((url) => url.trim()) ?? [];

  return {
    id: batch.id,
    timestamp: resolveTimestamp(batch),
    name: resolveMirrorName(batch, bean),
    roaster: '',
    image: resolveImageUrl(batch, 0),
    backImage: resolveImageUrl(batch, 1),
    capacity,
    remaining,
    price,
    roastLevel: normalizeRoastLevel(batch.roastLevel),
    roastDate: formatDateOnly(batch.roastDate),
    flavor: [],
    notes: getTrimmedText(batch.notes) || getTrimmedText(bean?.notes),
    startDay: 0,
    endDay: 0,
    isFrozen: false,
    isInTransit: false,
    beanType: resolveBeanType(batch, bean),
    beanState: 'roasted',
    brand,
    purchaseDate: resolvePurchaseDate(batch, bean),
    sourceGreenBeanId: batch.greenBeanId,
    overallRating: 0,
    ratingNotes: '',
    blendComponents: [blendComponent],
    roastBatchId: batch.id,
    roastedBeanName: getTrimmedText(batch.roastedBeanName),
    roastPlanId: getTrimmedText(batch.roastPlanId),
    roastPlanName: getTrimmedText(batch.roastPlanName),
    inputWeightGrams: batch.inputWeightGrams,
    outputWeightGrams: batch.outputWeightGrams,
    developmentRatio: batch.developmentRatio ?? null,
    firstCrackTime: batch.firstCrackTime ?? null,
    totalRoastTime: batch.totalRoastTime ?? null,
    status: batch.status,
    imageUrls,
    greenBeanCode: bean?.code ?? '',
    greenBeanDisplayName: bean?.name ?? '',
    greenBeanOrigin: bean?.origin ?? '',
    greenBeanOriginCountry: bean?.originCountry ?? '',
    greenBeanOriginRegion: bean?.originRegion ?? '',
    greenBeanOriginArea: bean?.originArea ?? '',
    greenBeanProcess: bean?.process ?? '',
    greenBeanGrade: bean?.grade ?? '',
    greenBeanVariety: bean?.variety ?? '',
    greenBeanHarvestSeason: bean?.harvestSeason ?? '',
    greenBeanMillName: bean?.millName ?? '',
    greenBeanNotes: bean?.notes ?? '',
    greenBeanDefaultRoastInputGrams: bean?.defaultRoastInputGrams ?? 0,
    greenBeanDefaultSaleUnitPrice: bean?.defaultSaleUnitPrice ?? null,
    greenBeanDefaultSaleUnitWeightGrams: bean?.defaultSaleUnitWeightGrams ?? null,
    greenBeanPurchasedTotalPrice: bean?.purchasedTotalPrice ?? null,
    greenBeanPurchasedWeightGrams: bean?.purchasedWeightGrams ?? null,
    greenBeanRemainingWeightGrams: bean?.remainingWeightGrams ?? null,
    greenBeanStockKg: bean?.stockKg ?? null,
    greenBeanCostPerKg: bean?.costPerKg ?? null,
    greenBeanSupplierId: bean?.supplierId ?? null,
    greenBeanSupplierName: bean?.supplierName ?? '',
    greenBeanCreatedAt: bean?.createdAt ?? '',
    greenBeanUpdatedAt: bean?.updatedAt ?? '',
  };
};

const hasRoastedBeanConnection = (): boolean => {
  if (import.meta.env.MODE === 'test') {
    return false;
  }

  const connection = pocketBaseConnectionSettingsService.resolveProjectConnection('roastedBean');

  return isPocketBaseProjectConnectionConfigured(connection);
};

const getRoastedBeanClient = (): Pick<PocketBaseRestClient, 'insert'> => {
  const connection = pocketBaseConnectionSettingsService.resolveProjectConnection('roastedBean');

  if (isSupabaseProjectUrl(connection.projectUrl)) {
    return new RoastedBeanSupabaseDataClient({
      projectUrl: connection.projectUrl,
      publishableKey: connection.publishableKey,
    });
  }

  return new PocketBaseRestClient({
    projectUrl: connection.projectUrl,
    publishableKey: connection.publishableKey,
  });
};

const buildMirrorPayload = async (batch: RoastBatchRecord): Promise<Record<string, unknown>> => {
  const { bean, blendComponent } = await resolveBeanContext(batch);

  return {
    id: batch.id,
    user_id: DEFAULT_SINGLE_USER_ID,
    data: buildMirrorData(batch, bean, blendComponent),
    deleted_at: null,
    version: 1,
    created_at: batch.createdAt,
    updated_at: batch.updatedAt,
  };
};

export const roastedCoffeeBeanMirrorService = {
  isEnabled(): boolean {
    return hasRoastedBeanConnection();
  },
  async syncCreatedBatch(batch: RoastBatchRecord): Promise<void> {
    if (!hasRoastedBeanConnection()) {
      logger.info('roasted coffee bean mirror skipped', {
        batchId: batch.id,
        reason: 'connection-missing',
      });
      return;
    }

    const client = getRoastedBeanClient();

    try {
      await client.insert<RoastedCoffeeBeanMirrorRow>(
        ROASTED_COFFEE_BEANS_TABLE,
        await buildMirrorPayload(batch),
        { select: 'id,user_id' },
      );
    } catch (error) {
      if (error instanceof AppError) {
        throw new AppError(`熟豆数据库同步失败（coffee_beans.data 写入）：${error.message}`, {
          code: error.code,
          cause: error.cause,
          status: error.status,
        });
      }

      throw new AppError(
        '熟豆数据库同步失败（coffee_beans.data 写入），请检查熟豆库连接、RLS 与 coffee_beans 表结构。',
        {
          code: error instanceof AppError ? error.code : 'NETWORK',
          cause: error,
        },
      );
    }
  },
};
