import { z } from 'zod';

import { isRoasterModelOption } from '@/modules/roast/constants/roasterModel';

export { roastPlanJsonSchema, roastPlanJsonStepSchema } from './roastPlanJson.schema';
export { hibeanRoastCurveSchema } from './hibeanRoastCurve.schema';

export const roastPlanSchema = z.object({
  name: z.string().min(1),
  beanId: z.union([z.number().int().positive(), z.string().min(1)]),
  roasterModel: z.string().refine(isRoasterModelOption),
  batchWeightGrams: z.number().positive(),
  targetRoastLevel: z.string().min(1),
});
