import { z } from 'zod';

export const costRecordSchema = z.object({
  targetType: z.enum(['bean', 'roastBatch', 'productionBatch']),
  targetId: z.number().int().positive(),
  materialCost: z.number().nonnegative(),
  laborCost: z.number().nonnegative(),
  energyCost: z.number().nonnegative(),
});

