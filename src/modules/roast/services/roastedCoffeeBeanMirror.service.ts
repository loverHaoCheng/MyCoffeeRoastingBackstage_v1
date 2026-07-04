import { beanService } from '@/modules/bean/services';
import { supabaseConnectionSettingsService } from '@/modules/settings/services/supabaseConnectionSettings.service';
import { logger } from '@/shared/logger/logger';
import { AppError } from '@/shared/errors/AppError';
import { SupabaseRestClient } from '@/services/supabaseRestClient';
import type { Bean } from '@/types/domain';

import type { RoastBatchRecord } from '../types/roastBatch';

const ROASTED_COFFEE_BEANS_TABLE = 'coffee_beans';
const DEFAULT_SINGLE_USER_ID = 'default_user';

interface RoastedCoffeeBeanMirrorRow {
  id: string;
  user_id: string;
}

interface RoastedCoffeeBlendComponent {
  estate: string;
  origin: string;
  process: string;
  variety: string;
}

interface MirrorBeanContext {
  bean: Bean | null;
  blendComponent: RoastedCoffeeBlendComponent;
}

const resolveMirrorName = (batch: RoastBatchRecord): string => {
  const roastedBeanName = batch.roastedBeanName?.trim() ?? '';

  if (roastedBeanName.length > 0) {
    return roastedBeanName;
  }

  const roastPlanName = batch.roastPlanName?.trim() ?? '';

  if (roastPlanName.length > 0) {
    return roastPlanName;
  }

  return batch.greenBeanName.trim();
};

const resolveBeanType = (batch: RoastBatchRecord): 'espresso' | 'filter' => {
  const sourceText = [
    batch.roastedBeanName,
    batch.roastPlanName,
    batch.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (sourceText.includes('espresso') || sourceText.includes('soe') || sourceText.includes('意式')) {
    return 'espresso';
  }

  return 'filter';
};

const resolveTimestamp = (batch: RoastBatchRecord): number => {
  const parsedTimestamp = new Date(batch.updatedAt || batch.createdAt || batch.roastDate).getTime();

  return Number.isNaN(parsedTimestamp) ? Date.now() : parsedTimestamp;
};

const resolveBeanContext = async (batch: RoastBatchRecord): Promise<MirrorBeanContext> => {
  try {
    const response = await beanService.getBeanById(batch.greenBeanId);
    const bean: Bean | null = response.data;

    return {
      bean,
      blendComponent: {
        estate: bean?.name ?? '',
        origin: bean?.origin ?? '',
        process: bean?.process ?? '',
        variety: bean?.variety ?? bean?.grade ?? '',
      },
    };
  } catch (error) {
    logger.warn('mirror bean detail lookup failed, falling back to empty blend component', {
      batchId: batch.id,
      error,
    });

    return {
      bean: null,
      blendComponent: {
        estate: '',
        origin: '',
        process: '',
        variety: '',
      },
    };
  }
};

const buildMirrorData = async (batch: RoastBatchRecord): Promise<string> => {
  const { bean, blendComponent } = await resolveBeanContext(batch);
  const saleUnitWeight =
    bean?.defaultSaleUnitWeightGrams != null && bean.defaultSaleUnitWeightGrams > 0
      ? String(bean.defaultSaleUnitWeightGrams)
      : '';

  return JSON.stringify({
    id: batch.id,
    name: resolveMirrorName(batch),
    notes: batch.notes ?? '',
    price: bean?.defaultSaleUnitPrice != null && bean.defaultSaleUnitPrice > 0 ? String(bean.defaultSaleUnitPrice) : '',
    flavor: [],
    beanType: resolveBeanType(batch),
    capacity: saleUnitWeight,
    beanState: 'roasted',
    remaining: saleUnitWeight,
    roastDate: batch.roastDate,
    timestamp: resolveTimestamp(batch),
    roastLevel: batch.roastLevel,
    blendComponents: [blendComponent],
  });
};

const hasRoastedBeanConnection = (): boolean => {
  const connection = supabaseConnectionSettingsService.resolveProjectConnection('roastedBean');

  return connection.projectUrl.trim().length > 0 && connection.publishableKey.trim().length > 0;
};

const getRoastedBeanClient = (): SupabaseRestClient => {
  const connection = supabaseConnectionSettingsService.resolveProjectConnection('roastedBean');

  return new SupabaseRestClient({
    projectUrl: connection.projectUrl,
    publishableKey: connection.publishableKey,
  });
};

const buildMirrorPayload = async (batch: RoastBatchRecord): Promise<Record<string, unknown>> => {
  return {
    id: batch.id,
    user_id: DEFAULT_SINGLE_USER_ID,
    data: await buildMirrorData(batch),
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
      await client.insert<Record<string, unknown>, RoastedCoffeeBeanMirrorRow>(
        ROASTED_COFFEE_BEANS_TABLE,
        await buildMirrorPayload(batch),
        { select: 'id,user_id' },
      );
    } catch (error) {
      throw new AppError('熟豆数据库同步失败，请检查熟豆库连接、RLS 与 coffee_beans 表结构。', {
        code: error instanceof AppError ? error.code : 'NETWORK',
        cause: error,
      });
    }
  },
};
