import { z } from 'zod';

import {
  beanFlavorTagMaxCount,
  beanFlavorTagMaxLength,
  normalizeFlavorTags,
} from '@/modules/bean/utils/flavorTags';

export const beanSchema = z.object({
  name: z.string().min(1),
  origin: z.string().min(1),
  stockKg: z.number().nonnegative(),
});

const optionalTrimmedText = z.string().trim().max(200).nullable().optional();
const optionalPositiveNumber = z.number().positive('请输入大于 0 的数值').nullable().optional();
const flavorTagsSchema = z.preprocess(
  (value) => normalizeFlavorTags(Array.isArray(value) ? value : []),
  z
    .array(z.string().min(1, '请输入有效的风味标签').max(beanFlavorTagMaxLength, `单个风味标签不能超过 ${String(beanFlavorTagMaxLength)} 个字符`))
    .max(beanFlavorTagMaxCount, `风味标签不能超过 ${String(beanFlavorTagMaxCount)} 个`),
);

export const greenBeanCreateFormSchema = z
  .object({
    agingDays: z.number().int().nonnegative('养豆时间不能小于 0').max(3650, '养豆时间不能超过 3650 天'),
    costTemplateId: z.string().nullable().optional(),
    code: z.string().trim().min(1, '请输入生豆编号').max(60, '生豆编号长度不能超过 60 个字符'),
    defaultRoastInputGrams: z.number().int().positive('请输入有效的单次烘焙量'),
    displayName: z.string().trim().min(1, '请输入显示名称').max(120, '显示名称长度不能超过 120 个字符'),
    flavorTags: flavorTagsSchema,
    grade: z.string().trim().max(80, '等级长度不能超过 80 个字符').nullable().optional(),
    harvestSeason: z.string().trim().max(60, '产季长度不能超过 60 个字符').nullable().optional(),
    millName: optionalTrimmedText,
    notes: z.string().trim().max(2000, '备注长度不能超过 2000 个字符').nullable().optional(),
    originArea: optionalTrimmedText,
    originCountry: z.string().trim().max(80, '产地国家长度不能超过 80 个字符').nullable().optional(),
    originRegion: z.string().trim().max(80, '产区长度不能超过 80 个字符').nullable().optional(),
    processMethod: z.string().trim().min(1, '请输入处理法').max(80, '处理法长度不能超过 80 个字符'),
    purchaseDate: z.string().trim().min(1, '请选择采购日期'),
    purchasedTotalPrice: z.number().positive('请输入有效的购买总价'),
    purchasedWeightGrams: z.number().int().positive('请输入有效的购买重量'),
    remainingWeightGrams: z.number().int().nonnegative('请输入有效的剩余重量'),
    supplierName: optionalTrimmedText,
    tastingEndDays: z.number().int().positive('赏味结束期必须大于 0').max(3650, '赏味结束期不能超过 3650 天'),
    defaultSaleUnitPrice: z.number().positive('请输入有效的出售单份售价'),
    defaultSaleUnitWeightGrams: z.number().int().positive('请输入有效的出售单份重量').nullable().optional(),
    variety: z.string().trim().min(1, '请输入豆种').max(120, '豆种长度不能超过 120 个字符'),
    altitudeMetersMax: optionalPositiveNumber,
    altitudeMetersMin: optionalPositiveNumber,
    densityGPerL: optionalPositiveNumber,
    moisturePercent: z.number().positive('含水率必须大于 0').max(100, '含水率不能大于 100').nullable().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.altitudeMetersMin != null &&
      value.altitudeMetersMax != null &&
      value.altitudeMetersMax < value.altitudeMetersMin
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: '海拔上限不能小于海拔下限',
        path: ['altitudeMetersMax'],
      });
    }

    if (value.remainingWeightGrams > value.purchasedWeightGrams) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: '剩余重量不能大于购买重量',
        path: ['remainingWeightGrams'],
      });
    }

    if (value.tastingEndDays < value.agingDays) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: '赏味结束期不能早于养豆时间',
        path: ['tastingEndDays'],
      });
    }
  });
