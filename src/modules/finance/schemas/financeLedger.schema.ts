import { z } from 'zod';

export const financeIncomeFormSchema = z.object({
  amount: z.number().positive('请输入有效的收入金额'),
  channel: z.enum(['retail', 'wholesale', 'other']),
  incomeDate: z.string().trim().min(1, '请选择收入日期'),
  notes: z.string().trim().max(2000, '备注长度不能超过 2000 个字符').nullable().optional(),
  status: z.enum(['received', 'pending']),
  title: z.string().trim().min(1, '请输入收入名称').max(120, '收入名称不能超过 120 个字符'),
});

export const financeExpenseFormSchema = z.object({
  amount: z.number().positive('请输入有效的费用金额'),
  category: z.enum(['beanPurchase', 'packaging', 'shipping', 'custom', 'depreciation', 'other']),
  customCategoryLabel: z.string().trim().max(80, '自定义类别长度不能超过 80 个字符').nullable().optional(),
  expenseDate: z.string().trim().min(1, '请选择费用日期'),
  notes: z.string().trim().max(2000, '备注长度不能超过 2000 个字符').nullable().optional(),
  roastBatchIds: z.array(z.string().min(1)).max(100).optional(),
  status: z.enum(['paid', 'pending']),
  title: z.string().trim().min(1, '请输入费用名称').max(120, '费用名称不能超过 120 个字符'),
}).superRefine((value, context) => {
  if (value.category === 'custom' && !(value.customCategoryLabel?.trim())) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: '请输入自定义类别',
      path: ['customCategoryLabel'],
    });
  }

  if (value.category === 'shipping' && (value.roastBatchIds?.length ?? 0) === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: '请至少选择一条关联烘焙记录',
      path: ['roastBatchIds'],
    });
  }
});
