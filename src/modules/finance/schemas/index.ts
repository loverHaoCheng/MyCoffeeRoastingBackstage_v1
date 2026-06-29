import { z } from 'zod';

export const costCalculationFormSchema = z.object({
  beanId: z.string().trim().min(1, '请选择生豆'),
  beanName: z.string().trim().min(1, '缺少生豆名称'),
  calculationName: z.string().trim().min(1, '请输入核算名称').max(120, '核算名称不能超过 120 个字符'),
  purchaseCostPerKg: z.number().positive('请输入有效的生豆成本'),
  dehydrationRate: z.number().min(0, '脱水率不能小于 0').max(100, '脱水率不能大于 100'),
  roastInputWeightGrams: z.number().int().positive('请输入有效的单锅生豆重量'),
  packagingCost: z.number().nonnegative('包装费用不能为负数'),
  energyCost: z.number().nonnegative('能耗费用不能为负数'),
  laborCost: z.number().nonnegative('人工费用不能为负数'),
  otherCost: z.number().nonnegative('其他费用不能为负数'),
  saleUnitWeightGrams: z.number().int().positive('请输入单份熟豆重量'),
  saleUnitPrice: z.number().nonnegative('单份熟豆售价不能为负数'),
  targetProfitRate: z.number().min(0, '目标利润率不能为负数').max(1000, '目标利润率过高'),
  notes: z.string().trim().max(2000, '备注长度不能超过 2000 个字符').nullable().optional(),
});
