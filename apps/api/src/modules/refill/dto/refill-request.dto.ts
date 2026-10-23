// apps/api/src/modules/refill/dto/refill-request.dto.ts
import { z } from 'zod';

export const RefillRequestSchema = z.object({
  item_id: z.string().min(1, { message: 'Item ID is required' }),
  item_name: z.string().min(1, { message: 'Item name is required' }),
  units: z.string().min(1, { message: 'Unit is required' }),

  requested_qty: z
    .number()
    .positive({ message: 'Requested quantity must be positive' })
    .int(),

  notes: z.string().optional(),
  payload: z.record(z.string(), z.any()).optional(),
});

export type RefillRequestDto = z.infer<typeof RefillRequestSchema>;