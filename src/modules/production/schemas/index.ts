import { z } from 'zod';

export const productionBatchSchema = z.object({
  batchNo: z.string().min(1),
  roastPlanId: z.number().int().positive(),
  roastBatchId: z.number().int().positive(),
  packageSpec: z.string().min(1),
  plannedOutput: z.number().int().positive(),
});
