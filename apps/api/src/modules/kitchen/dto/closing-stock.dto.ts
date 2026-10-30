// apps/api/src/modules/kitchen/dto/closing-stock.dto.ts
import { z } from 'zod';

/** counted_qty: 0 is valid (empty shelf). Blank/omitted is not this field — client omits uncounted lines. */
export const ClosingStockLineSchema = z.object({
  item_id: z.string().min(1),
  counted_qty: z.number().finite().min(0),
  notes: z.string().optional(),
  reason_code: z.string().optional(),
});

export const SubmitClosingStockSchema = z.object({
  shop_id: z.string().optional().default('1'),
  shift_label: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(ClosingStockLineSchema).min(1),
});

export type ClosingStockLineDto = z.infer<typeof ClosingStockLineSchema>;
export type SubmitClosingStockDto = z.infer<typeof SubmitClosingStockSchema>;
