import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { isPocketBaseProjectConnectionConfigured } from '@/modules/settings/types';
import { normalizeFlavorTags } from '@/modules/bean/utils/flavorTags';
import type { GreenBeanCreateInput, GreenBeanUpdateInput, LocalGreenBeanRecord } from '../types/localGreenBean';

let currentPendingOperations: PendingOperation[] = [];

export type PendingOperationType = 'create' | 'update' | 'delete';

interface PendingOperation {
  entity: 'bean';
  id: string;
  payload: Record<string, unknown>;
  timestamp: string;
  type: PendingOperationType;
}

const isPendingOperation = (value: unknown): value is PendingOperation => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'entity' in value &&
    value.entity === 'bean' &&
    'id' in value &&
    typeof value.id === 'string' &&
    'payload' in value &&
    typeof value.payload === 'object' &&
    value.payload !== null &&
    'timestamp' in value &&
    typeof value.timestamp === 'string' &&
    'type' in value &&
    (value.type === 'create' || value.type === 'delete' || value.type === 'update')
  );
};

const toOptionalNumber = (value: unknown): null | number | undefined => {
  if (value == null) {
    return value;
  }

  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const toOptionalString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const toRequiredString = (value: unknown): string => {
  return typeof value === 'string' ? value : '';
};

const generatePendingId = (): string => {
  return `pending-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const loadPendingOps = (): PendingOperation[] => {
  if (currentPendingOperations.every(isPendingOperation)) {
    return currentPendingOperations;
  }

  currentPendingOperations = [];

  return [];
};

const savePendingOps = (ops: PendingOperation[]): void => {
  if (!ops.every(isPendingOperation)) {
    currentPendingOperations = [];
    return;
  }

  currentPendingOperations = ops;
};

export const beanSyncService = {
  /**
   * 检查当前是否可以访问远端主库（有配置且有网络）
   */
  isOnline(): boolean {
    if (typeof navigator === 'undefined') return false;
    if (!navigator.onLine) return false;

    const connection = pocketBaseConnectionSettingsService.resolveProjectConnection('greenBean');

    return isPocketBaseProjectConnectionConfigured(connection);
  },

  /**
   * 获取所有待同步操作
   */
  getPendingOperations(): PendingOperation[] {
    return loadPendingOps();
  },

  /**
   * 记录一个待创建操作（离线时调用）
   */
  recordPendingCreate(input: GreenBeanCreateInput): PendingOperation {
    const op: PendingOperation = {
      entity: 'bean',
      id: generatePendingId(),
      payload: { ...input },
      timestamp: new Date().toISOString(),
      type: 'create',
    };

    const ops = loadPendingOps();
    ops.push(op);
    savePendingOps(ops);

    return op;
  },

  /**
   * 记录一个待更新操作（离线时调用）
   */
  recordPendingUpdate(beanId: string | number, input: GreenBeanUpdateInput): PendingOperation {
    const op: PendingOperation = {
      entity: 'bean',
      id: generatePendingId(),
      payload: { beanId, ...input },
      timestamp: new Date().toISOString(),
      type: 'update',
    };

    const ops = loadPendingOps();
    ops.push(op);
    savePendingOps(ops);

    return op;
  },

  /**
   * 记录一个待删除操作（离线时调用）
   */
  recordPendingDelete(beanId: string | number): PendingOperation {
    const op: PendingOperation = {
      entity: 'bean',
      id: generatePendingId(),
      payload: { beanId },
      timestamp: new Date().toISOString(),
      type: 'delete',
    };

    const ops = loadPendingOps();
    ops.push(op);
    savePendingOps(ops);

    return op;
  },

  /**
   * 移除已同步的操作
   */
  removePendingOp(opId: string): void {
    const ops = loadPendingOps().filter((op) => op.id !== opId);
    savePendingOps(ops);
  },

  /**
   * 清空所有待同步操作
   */
  clearPendingOps(): void {
    currentPendingOperations = [];
  },

  /**
   * 将本地创建的生豆记录转换为 GreenBeanCreateInput 格式
   */
  localRecordToCreateInput(record: LocalGreenBeanRecord | Record<string, unknown>): GreenBeanCreateInput {
    return {
      agingDays: Number(record.agingDays) || 14,
      costTemplateId: toOptionalString(record.costTemplateId),
      code: toRequiredString(record.code),
      defaultRoastInputGrams: Number(record.defaultRoastInputGrams) || 200,
      defaultSaleUnitPrice: Number(record.defaultSaleUnitPrice) || 0,
      defaultSaleUnitWeightGrams:
        record.defaultSaleUnitWeightGrams == null ? null : Number(record.defaultSaleUnitWeightGrams) || 0,
      displayName: toRequiredString(record.displayName),
      flavorTags: normalizeFlavorTags(Array.isArray(record.flavorTags) ? record.flavorTags : []),
      grade: toOptionalString(record.grade),
      harvestSeason: toOptionalString(record.harvestSeason),
      millName: toOptionalString(record.millName),
      notes: toOptionalString(record.notes),
      originArea: toOptionalString(record.originArea),
      originCountry: toOptionalString(record.originCountry),
      originRegion: toOptionalString(record.originRegion),
      processMethod: toRequiredString(record.processMethod),
      purchaseDate: toRequiredString(record.purchaseDate),
      purchasedTotalPrice: Number(record.purchasedTotalPrice) || 0,
      purchasedWeightGrams: Number(record.purchasedWeightGrams) || 0,
      remainingWeightGrams:
        record.remainingWeightGrams == null
          ? Number(record.purchasedWeightGrams) || 0
          : Number(record.remainingWeightGrams) || 0,
      supplierName: toOptionalString(record.supplierName),
      tastingEndDays: Number(record.tastingEndDays) || 40,
      variety: toRequiredString(record.variety),
      altitudeMetersMax: toOptionalNumber(record.altitudeMetersMax),
      altitudeMetersMin: toOptionalNumber(record.altitudeMetersMin),
      densityGPerL: toOptionalNumber(record.densityGPerL),
      moisturePercent: toOptionalNumber(record.moisturePercent),
    };
  },
};
