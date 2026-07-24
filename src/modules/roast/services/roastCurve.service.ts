import { AppError } from '@/shared/errors/AppError';
import type { ApiResponse } from '@/services/api.types';

import {
  getGreenBeanClient,
  hasGreenBeanConnection,
  isMissingRemoteResourceError,
  ok,
} from './roast-batch/roastBatch.service.shared';
import {
  createLocalCurveId,
  loadLocalCurveByBatchId,
  saveLocalCurveRecord,
} from './roast-curve/roastCurve.service.state';
import {
  getBatchSummaryFromCurve,
  mapRemoteRoastCurveRecord,
  toPocketBaseRoastCurvePayload,
} from './roast-curve/roastCurve.service.shared';
import { parseRoastCurveJson } from './roastCurveImport.service';
import type {
  RoastCurveImportInput,
  RoastCurveImportResult,
  RoastCurveRecord,
} from '../types/roastCurve';

interface RoastCurveRepository {
  getByBatchId(roastBatchId: string): Promise<RoastCurveRecord | null>;
  upsert(input: Omit<RoastCurveRecord, 'id'>): Promise<RoastCurveRecord>;
}

class LocalRoastCurveRepository implements RoastCurveRepository {
  getByBatchId(roastBatchId: string): Promise<RoastCurveRecord | null> {
    return Promise.resolve(loadLocalCurveByBatchId(roastBatchId));
  }

  async upsert(input: Omit<RoastCurveRecord, 'id'>): Promise<RoastCurveRecord> {
    const current = await this.getByBatchId(input.roastBatchId);
    const record: RoastCurveRecord = {
      ...input,
      id: current?.id ?? createLocalCurveId(),
    };

    return saveLocalCurveRecord(record);
  }
}

class RemoteRoastCurveRepository implements RoastCurveRepository {
  private readonly collectionName = 'roast_curve_records';
  private readonly client = getGreenBeanClient();

  async getByBatchId(roastBatchId: string): Promise<RoastCurveRecord | null> {
    try {
      const rows = await this.client.list<Record<string, unknown>>(this.collectionName, {
        limit: 1,
        match: { roast_batch_id: roastBatchId },
      });

      return rows[0] ? mapRemoteRoastCurveRecord(rows[0]) : null;
    } catch (error) {
      if (isMissingRemoteResourceError(error)) {
        return null;
      }

      throw error;
    }
  }

  async upsert(input: Omit<RoastCurveRecord, 'id'>): Promise<RoastCurveRecord> {
    const current = await this.getByBatchId(input.roastBatchId);
    const payload = toPocketBaseRoastCurvePayload(input);
    const rows = current
      ? await this.client.update<Record<string, unknown>>(this.collectionName, payload, {
          match: { id: current.id },
          select: '*',
        })
      : await this.client.insert<Record<string, unknown>>(this.collectionName, payload, { select: '*' });
    const row = rows[0];

    if (!row) {
      throw new AppError('曲线保存失败：PocketBase 未返回数据。', { code: 'DATA' });
    }

    return mapRemoteRoastCurveRecord(row);
  }
}

const resolveRoastCurveRepository = (): RoastCurveRepository => {
  if (import.meta.env.MODE === 'test' || !hasGreenBeanConnection()) {
    return new LocalRoastCurveRepository();
  }

  return new RemoteRoastCurveRepository();
};

export const roastCurveService = {
  async getByBatchId(roastBatchId: string): Promise<ApiResponse<RoastCurveRecord | null>> {
    try {
      const record = await resolveRoastCurveRepository().getByBatchId(roastBatchId);
      return ok(record);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('获取烘焙曲线失败。', { code: 'NETWORK', cause: error });
    }
  },

  async importHiBeanCurve(input: RoastCurveImportInput): Promise<ApiResponse<RoastCurveImportResult>> {
    try {
      const parsed = parseRoastCurveJson(input.jsonText, input.roastBatchId, input.fileName);
      const record = await resolveRoastCurveRepository().upsert(parsed);

      return ok({
        batchSummary: getBatchSummaryFromCurve(record),
        record,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('导入曲线 JSON 失败。', { code: 'NETWORK', cause: error });
    }
  },
};

export { parseArtisanRoastCurveJson, parseHibeanRoastCurveJson, parseRoastCurveJson } from './roastCurveImport.service';
