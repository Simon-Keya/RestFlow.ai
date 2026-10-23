import { z } from 'zod';

export const MpesaPaymentSchema = z.object({
  order_id: z.string().min(1),
  phone_number: z.string().regex(/^254[0-9]{9}$/, 'Phone must be in 254XXXXXXXXX format'),
  amount: z.number().positive(),
  account_reference: z.string().optional(),
  transaction_desc: z.string().optional().default('RestFlow Order Payment'),
});

export type MpesaPaymentDto = z.infer<typeof MpesaPaymentSchema>;