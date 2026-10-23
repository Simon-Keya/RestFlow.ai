import { z } from 'zod';

export const UpdateComboSchema = z.object({
  name: z.string().min(1).optional(),
  selling_price: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
});

export type UpdateComboDto = z.infer<typeof UpdateComboSchema>;
