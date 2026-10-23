import { z } from 'zod';

export const UpdatePaymentSchema = z.object({
  payment_status: z.enum(['paid', 'pending', 'failed', 'unpaid']),
  payment_method: z.enum(['cash', 'mpesa', 'card', 'split']).optional(),
  mpesa_reference: z.string().optional(),
  shop_id: z.string().optional(),
  notes: z.string().optional(),
});

export type UpdatePaymentDto = z.infer<typeof UpdatePaymentSchema>;
