import { z } from 'zod';

export const beanSchema = z.object({
  name: z.string().min(1),
  origin: z.string().min(1),
  stockKg: z.number().nonnegative(),
});

