import { z } from 'zod';

export const inventoryAdjustmentSchema = z.object({
  beanId: z.number().int().positive(),
  quantityKg: z.number(),
  location: z.string().min(1),
});

