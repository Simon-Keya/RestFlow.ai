// apps/api/src/modules/production/dto/production-waste.dto.ts
import { z } from 'zod';

export const ProductionWasteSchema = z.object({
  production_id: z.string().min(1, { message: 'Production ID is required' }),

  item_id: z.string().min(1, { message: 'Item ID is required' }),
  item_name: z.string().min(1, { message: 'Item name is required' }),

  waste_quantity: z
    .number()
    .nonnegative({ message: 'Waste quantity cannot be negative' }),

  waste_reason: z
    .string()
    .min(1, { message: 'Waste reason is required' }),

  batch_number: z.string().optional(),
  expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: 'Expiry date must be YYYY-MM-DD',
    })
    .or(z.date())
    .optional(),

  unit_cost: z.number().min(0).optional(),
  total_waste_cost: z.number().min(0).optional(),

  notes: z.string().optional(),
  waste_photo_url: z.string().optional(),

  payload: z.record(z.string(), z.any()).optional(),
});

export type ProductionWasteDto = z.infer<typeof ProductionWasteSchema>;