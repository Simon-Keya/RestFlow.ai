// apps/api/src/modules/finished-goods/dto/adjust-finished-good.dto.ts
import { z } from 'zod';

export const AdjustFinishedGoodSchema = z.object({
  item_id: z.string().min(1),
  batch_number: z.string().min(1),

  adjustment_quantity: z.number().int(), // Positive = add, Negative = remove
  reason: z.string().min(1, { message: 'Reason is required' }), // e.g. "Damaged", "Sold", "Expired"
  notes: z.string().optional(),
});

export type AdjustFinishedGoodDto = z.infer<typeof AdjustFinishedGoodSchema>;