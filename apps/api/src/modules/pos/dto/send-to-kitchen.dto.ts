import { z } from 'zod';

export const SendToKitchenSchema = z.object({
  shop_id: z.string().optional(),
  notes: z.string().optional(),
});

export type SendToKitchenDto = z.infer<typeof SendToKitchenSchema>;
