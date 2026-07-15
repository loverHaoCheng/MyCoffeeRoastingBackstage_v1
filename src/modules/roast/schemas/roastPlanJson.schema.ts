import { z } from 'zod';

import { isRoasterModelOption } from '@/modules/roast/constants/roasterModel';

export const roastPlanJsonStepSchema = z.object({
  time: z.string().min(1, '时间不能为空'),
  event: z.string().min(1, '事件不能为空'),
  operation: z.string().min(1, '操作不能为空'),
  temperature: z.string().min(1, '炉温不能为空'),
  airTemperature: z.string().min(1, '风温不能为空'),
  firePower: z.string().min(1, '火力不能为空'),
  drumSpeed: z.string().min(1, '转速不能为空'),
  note: z.string().optional(),
});

export const roastPlanJsonSchema = z.object({
  name: z.string().min(1, '计划名称不能为空'),
  beanName: z.string(),
  beanId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
  roasterModel: z.string().refine(isRoasterModelOption, '烘豆机型号仅支持 tank200d 或 其他'),
  batchWeightGrams: z.number().positive('批次重量必须大于 0'),
  roastLevel: z.string().min(1, '烘焙目标不能为空'),
  purpose: z.string().optional(),
  steps: z.array(roastPlanJsonStepSchema).min(1, '至少需要一个烘焙节点'),
});
