// apps/api/src/modules/production/dto/start-production.dto.ts
import { z } from 'zod';

const sku = z
  .string()
  .min(1)
  .transform((s) => s.trim().toUpperCase());

export const StartProductionSchema = z.object({
  recipe_id: z.string().min(1, { message: 'Recipe ID is required' }),
  item_id: sku,
  item_name: z.string().min(1, { message: 'Produced item name is required' }),
  planned_quantity: z
    .number()
    .positive({ message: 'Planned quantity must be positive' }),
  notes: z.string().optional(),
  payload: z.record(z.string(), z.any()).optional(),
});

export type StartProductionDto = z.infer<typeof StartProductionSchema>;
