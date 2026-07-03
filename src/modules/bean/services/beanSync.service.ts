import { localGreenBeanService } from '@/modules/bean/services/localGreenBean.service';
import { supabaseConnectionSettingsService } from '@/modules/settings/services/supabaseConnectionSettings.service';
import type { GreenBeanCreateInput } from '../types/localGreenBean';

const PENDING_OPS_KEY = 'coffee-roasting-backstage:pending-ops';

export type PendingOperationType = 'create' | 'update' | 'delete';

interface PendingOperation {
  entity: 'bean';
  id: string;
  payload: Record<string, unknown>;
  timestamp: string;
  type: PendingOperationType;
}

const generatePendingId = (): string => {
  return `pending-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const loadPendingOps = (): PendingOperation[] => {
  try {
    const raw = window.localStorage.getItem(PENDING_OPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (op) =>
          typeof op === 'object' &&
          op !== null &&
          typeof op.id === 'string' &&
          typeof op.entity === 'string' &&
          typeof op.type === 'string' &&
          typeof op.timestamp === 'string',
      )
    ) {
      return parsed as PendingOperation[];
    }
    return [];
  } catch {
    return [];
  }
};

const savePendingOps = (ops: PendingOperation[]): void => {
  window.localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(ops));
};

export const beanSyncService = {
  /**
   * 检查当前是否可以访问 Supabase（有配置且有网络）
   */
  isOnline(): boolean {
    if (typeof navigator === 'undefined') return false;
    if (!navigator.onLine) return false;

    const connection = supabaseConnectionSettingsService.resolveProjectConnection('greenBean');
    if (!connection) return false;

    return connection.projectUrl.trim().length > 0 && connection.publishableKey.trim().length > 0;
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
      payload: input as unknown as Record<string, unknown>,
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
  recordPendingUpdate(beanId: string | number, input: Record<string, unknown>): PendingOperation {
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
    window.localStorage.removeItem(PENDING_OPS_KEY);
  },

  /**
   * 将本地创建的生豆记录转换为 GreenBeanCreateInput 格式
   */
  localRecordToCreateInput(record: Record<string, unknown>): GreenBeanCreateInput {
    return {
      code: String(record.code ?? ''),
      defaultRoastInputGrams: Number(record.defaultRoastInputGrams) || 200,
      defaultSaleUnitPrice: Number(record.defaultSaleUnitPrice) || 0,
      defaultSaleUnitWeightGrams:
        record.defaultSaleUnitWeightGrams == null ? null : Number(record.defaultSaleUnitWeightGrams) || 0,
      displayName: String(record.displayName ?? ''),
      harvestSeason: record.harvestSeason ? String(record.harvestSeason) : undefined,
      millName: record.millName ? String(record.millName) : undefined,
      notes: record.notes ? String(record.notes) : undefined,
      originArea: record.originArea ? String(record.originArea) : undefined,
      originCountry: record.originCountry ? String(record.originCountry) : undefined,
      originRegion: record.originRegion ? String(record.originRegion) : undefined,
      processMethod: String(record.processMethod ?? ''),
      purchasedTotalPrice: Number(record.purchasedTotalPrice) || 0,
      purchasedWeightGrams: Number(record.purchasedWeightGrams) || 0,
      remainingWeightGrams:
        record.remainingWeightGrams == null
          ? Number(record.purchasedWeightGrams) || 0
          : Number(record.remainingWeightGrams) || 0,
      supplierName: record.supplierName ? String(record.supplierName) : undefined,
      variety: String(record.variety ?? ''),
      altitudeMetersMax: record.altitudeMetersMax as number | null | undefined,
      altitudeMetersMin: record.altitudeMetersMin as number | null | undefined,
      densityGPerL: record.densityGPerL as number | null | undefined,
      moisturePercent: record.moisturePercent as number | null | undefined,
    };
  },
};
