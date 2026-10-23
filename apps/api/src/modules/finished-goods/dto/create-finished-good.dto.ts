// apps/api/src/modules/finished-goods/dto/create-finished-good.dto.ts

import { z } from 'zod';

export const CreateFinishedGoodSchema = z.object({
  // Item Information
  item_id: z
    .string()
    .min(1, { message: 'Item ID is required' }),

  item_name: z
    .string()
    .min(1, { message: 'Item name is required' }),

  // Production Details
  quantity: z
    .number()
    .int({ message: 'Quantity must be a whole number' })
    .positive({ message: 'Quantity must be greater than zero' }),

  batch_number: z
    .string()
    .min(1, { message: 'Batch number is required' }),

  expiry_date: z.coerce.date({
    message: 'A valid expiry date is required',
  }),

  // Costing
  unit_cost: z
    .number()
    .min(0, { message: 'Unit cost cannot be negative' }),

  total_cost: z
    .number()
    .min(0, { message: 'Total cost cannot be negative' })
    .optional(),

  // References
  production_id: z.string().optional(),

  // Additional Information
  notes: z.string().optional(),

  // Extra metadata (Zod v4 syntax)
  payload: z
    .record(z.string(), z.unknown())
    .optional(),
});

export type CreateFinishedGoodDto = z.infer<
  typeof CreateFinishedGoodSchema
>;