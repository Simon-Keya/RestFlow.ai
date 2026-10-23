import { z } from 'zod';

export const UpdateCatalogItemSchema = z.object({
  name: z.string().min(1).optional(),
  selling_price: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
  recipe_id: z.string().nullable().optional(),
  stock_item_id: z.string().nullable().optional(),
  production_type: z.enum(['recipe', 'stocked']).optional(),
});

export type UpdateCatalogItemDto = z.infer<typeof UpdateCatalogItemSchema>;
