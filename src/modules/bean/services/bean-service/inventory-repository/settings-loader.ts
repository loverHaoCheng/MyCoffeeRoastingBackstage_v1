import type { PocketBaseRestClient } from '@/shared/services/pocketBaseRestClient';

import { normalizeText } from '../bean.service.shared';
import {
  getBeanCostTemplateSettingKey,
  getBeanGradeSettingKey,
  getBeanSaleDefaultsSettingKey,
} from '../bean.service.shared';
import {
  parseBeanCostTemplateSettingValue,
  parseBeanGradeSettingValue,
  parseBeanSaleDefaultsSettingValue,
} from '../bean.service.shared';
import { withOptionalCollectionFallback } from '../bean.service.inventory-repository.utils';
import type {
  BeanCostTemplateSettingValue,
  BeanGradeSettingValue,
  BeanSaleDefaultsSettingValue,
  RemoteAppSettingRecord,
} from '../bean.service.types';

export function createSettingsLoader(
  client: Pick<PocketBaseRestClient, 'insert' | 'list' | 'update'>,
) {
  const loadSettingRecord = async (key: string): Promise<null | RemoteAppSettingRecord> => {
    const rows = await client.list<RemoteAppSettingRecord>('app_settings', {
      limit: 1,
      match: { key },
      orderBy: {
        ascending: false,
        column: 'updated_at',
      },
    });

    return rows[0] ?? null;
  };

  const loadSettingMap = async <T,>(
    prefix: string,
    parser: (value: unknown) => null | T,
    operation: string,
  ): Promise<Map<string, T>> => {
    return withOptionalCollectionFallback('app_settings', operation, async () => {
      const rows = await client.list<RemoteAppSettingRecord>('app_settings', {
        orderBy: {
          ascending: false,
          column: 'updated_at',
        },
      });
      const result = new Map<string, T>();

      rows.forEach((row) => {
        if (!row.key.startsWith(prefix)) {
          return;
        }

        const beanId = row.key.replace(prefix, '');
        const parsedValue = parser(row.value);

        if (!beanId || !parsedValue || result.has(beanId)) {
          return;
        }

        result.set(beanId, parsedValue);
      });

      return result;
    }, new Map<string, T>());
  };

  const upsertSetting = async (key: string, value: Record<string, unknown>, operation: string) => {
    await withOptionalCollectionFallback('app_settings', operation, async () => {
      const currentRecord = await loadSettingRecord(key);
      const payload = { key, value };

      if (!currentRecord) {
        await client.insert('app_settings', payload);
        return;
      }

      await client.update('app_settings', payload, {
        match: { id: currentRecord.id },
        select: '*',
      });
    }, undefined);
  };

  return {
    loadBeanSaleDefaultsRecord: async (beanId: string | number): Promise<null | RemoteAppSettingRecord> => {
      return withOptionalCollectionFallback(
        'app_settings',
        'load bean sale defaults',
        () => loadSettingRecord(getBeanSaleDefaultsSettingKey(String(beanId))),
        null,
      );
    },

    loadBeanCostTemplateRecord: async (beanId: string | number): Promise<null | RemoteAppSettingRecord> => {
      return withOptionalCollectionFallback(
        'app_settings',
        'load bean cost template',
        () => loadSettingRecord(getBeanCostTemplateSettingKey(String(beanId))),
        null,
      );
    },

    loadBeanGradeRecord: async (beanId: string | number): Promise<null | RemoteAppSettingRecord> => {
      return withOptionalCollectionFallback(
        'app_settings',
        'load bean grade',
        () => loadSettingRecord(getBeanGradeSettingKey(String(beanId))),
        null,
      );
    },

    loadBeanSaleDefaultsMap: () =>
      loadSettingMap<BeanSaleDefaultsSettingValue>(
        'green_bean_sale_defaults:',
        parseBeanSaleDefaultsSettingValue,
        'load bean sale defaults map',
      ),

    loadBeanCostTemplateMap: () =>
      loadSettingMap<BeanCostTemplateSettingValue>(
        'green_bean_cost_template:',
        parseBeanCostTemplateSettingValue,
        'load bean cost template map',
      ),

    loadBeanGradeMap: () =>
      loadSettingMap<BeanGradeSettingValue>(
        'green_bean_grade:',
        parseBeanGradeSettingValue,
        'load bean grade map',
      ),

    saveBeanSaleDefaults: async (
      beanId: string | number,
      input: { defaultSaleUnitPrice: number; defaultSaleUnitWeightGrams?: null | number | undefined },
    ) => {
      return upsertSetting(
        getBeanSaleDefaultsSettingKey(String(beanId)),
        {
          defaultSaleUnitPrice: input.defaultSaleUnitPrice,
          defaultSaleUnitWeightGrams: input.defaultSaleUnitWeightGrams ?? null,
          updatedAt: new Date().toISOString(),
        },
        'save bean sale defaults',
      );
    },

    saveBeanCostTemplate: async (beanId: string | number, costTemplateId: null | string) => {
      return upsertSetting(
        getBeanCostTemplateSettingKey(String(beanId)),
        {
          costTemplateId,
          updatedAt: new Date().toISOString(),
        },
        'save bean cost template',
      );
    },

    saveBeanGrade: async (beanId: string | number, grade: null | string | undefined) => {
      return upsertSetting(
        getBeanGradeSettingKey(String(beanId)),
        {
          grade: normalizeText(grade),
          updatedAt: new Date().toISOString(),
        },
        'save bean grade',
      );
    },
  };
}
