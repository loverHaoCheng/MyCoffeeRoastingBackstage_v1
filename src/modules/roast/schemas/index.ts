import { z } from 'zod';

export { roastPlanJsonSchema, roastPlanJsonStepSchema } from './roastPlanJson.schema';

export const roastPlanSchema = z.object({
  name: z.string().min(1),
  beanId: z.number().int().positive(),
  batchWeightGrams: z.number().positive(),
  targetRoastLevel: z.string().min(1),
});
