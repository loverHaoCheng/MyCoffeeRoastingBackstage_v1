import { z } from 'zod';

const optionalIsoDatetimeSchema = z.string().datetime().nullable().optional();

const supabaseConnectionStorageSchema = z.object({
  projectUrl: z.string(),
  publishableKey: z.string(),
});

const supabaseConnectionFormSectionSchema = (required: boolean) =>
  z
    .object({
      projectUrl: z.string().trim(),
      publishableKey: z.string().trim().max(2048, 'Publishable Key 长度超出限制'),
    })
    .superRefine((value, context) => {
      const hasProjectUrl = value.projectUrl.length > 0;
      const hasPublishableKey = value.publishableKey.length > 0;

      if (!required && !hasProjectUrl && !hasPublishableKey) {
        return;
      }

      if (!hasProjectUrl) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: '请输入 Project URL',
          path: ['projectUrl'],
        });
      }

      if (!hasPublishableKey) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: '请输入 Publishable Key',
          path: ['publishableKey'],
        });
      }

      if (!hasProjectUrl || !hasPublishableKey) {
        return;
      }

      const projectUrlValidation = z
        .string()
        .url('请输入有效的 Supabase Project URL')
        .refine((item) => item.startsWith('https://'), 'Project URL 必须以 https:// 开头')
        .safeParse(value.projectUrl);

      if (!projectUrlValidation.success) {
        projectUrlValidation.error.issues.forEach((issue) => {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: issue.message,
            path: ['projectUrl'],
          });
        });
      }

      if (/\s/.test(value.publishableKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Publishable Key 不能包含空格',
          path: ['publishableKey'],
        });
      }
    });

export const supabaseConnectionSettingsStorageSchema = z.object({
  greenBean: supabaseConnectionStorageSchema,
  roastedBean: supabaseConnectionStorageSchema,
  updatedAt: optionalIsoDatetimeSchema,
});

export const supabaseConnectionFormSchema = z.object({
  greenBean: supabaseConnectionFormSectionSchema(true),
  roastedBean: supabaseConnectionFormSectionSchema(false),
});

const costTemplateStorageItemSchema = z.object({
  createdAt: z.string().datetime(),
  dehydrationRate: z.number(),
  energyCost: z.number(),
  id: z.string(),
  laborCost: z.number(),
  name: z.string(),
  notes: z.string(),
  otherCost: z.number(),
  packagingCost: z.number(),
  roastInputWeightGrams: z.number().optional().default(200),
  saleUnitWeightGrams: z.number(),
  targetProfitRate: z.number(),
  updatedAt: z.string().datetime(),
});

export const costTemplateSettingsStorageSchema = z.object({
  defaultTemplateId: z.string().nullable().optional(),
  templates: z.array(costTemplateStorageItemSchema),
  updatedAt: optionalIsoDatetimeSchema,
});

export const costTemplateFormSchema = z.object({
  dehydrationRate: z.number().min(0, '脱水率不能小于 0').max(100, '脱水率不能大于 100'),
  energyCost: z.number().nonnegative('能耗费用不能为负数'),
  laborCost: z.number().nonnegative('人工费用不能为负数'),
  name: z.string().trim().min(1, '请输入模板名称').max(60, '模板名称不能超过 60 个字符'),
  notes: z.string().trim().max(500, '模板备注不能超过 500 个字符'),
  otherCost: z.number().nonnegative('其他费用不能为负数'),
  packagingCost: z.number().nonnegative('包装费用不能为负数'),
  roastInputWeightGrams: z.number().int().positive('生豆重量必须大于 0'),
  saleUnitWeightGrams: z.number().int().positive('单份熟豆重量必须大于 0'),
  targetProfitRate: z.number().min(0, '目标利润率不能小于 0').max(1000, '目标利润率过高'),
});

const cardDisplaySettingsStorageSchema = z.object({
  displayCount: z.union([z.literal(0), z.literal(2), z.literal(4)]),
  visibleMetaKeys: z.array(z.string()),
});

export const appDisplaySettingsStorageSchema = z.object({
  cardDisplaySettings: z
    .object({
      beanInventory: cardDisplaySettingsStorageSchema.optional(),
      roastBatch: cardDisplaySettingsStorageSchema.optional(),
      roastPlan: cardDisplaySettingsStorageSchema.optional(),
    })
    .optional(),
  scale: z.number().min(0.85).max(1.2).optional(),
  themeMode: z.enum(['dark', 'light']).optional(),
  updatedAt: optionalIsoDatetimeSchema,
});
