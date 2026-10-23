// apps/api/src/modules/production/dto/pre-prep.dto.ts
import { z } from 'zod';

export const PrePrepSchema = z
  .object({
    shop_id: z.string().optional(),
    raw_item_id: z.string().min(1, 'raw_item_id is required'),
    prepped_item_id: z.string().min(1, 'prepped_item_id is required'),
    prepped_item_name: z.string().optional(),
    original_qty: z.coerce.number().positive('original_qty must be > 0'),
    yielded_qty: z.coerce.number().positive('yielded_qty must be > 0'),
    loss_reason: z.string().optional(),
    note: z.string().optional(),
    notes: z.string().optional(),
    unit: z.string().optional(),
    method: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.yielded_qty > data.original_qty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'yielded_qty cannot exceed original_qty',
        path: ['yielded_qty'],
      });
    }
    const lost = data.original_qty - data.yielded_qty;
    if (lost > 0 && !(data.loss_reason && data.loss_reason.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'loss_reason is required when lost weight > 0',
        path: ['loss_reason'],
      });
    }
  });

export type PrePrepDto = z.infer<typeof PrePrepSchema>;
