import { z } from 'zod';

export const StripePaymentSchema = z.object({
  order_id: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default('kes'),
  payment_method_id: z.string().optional(),
  customer_email: z.string().email().optional(),
});

export type StripePaymentDto = z.infer<typeof StripePaymentSchema>;