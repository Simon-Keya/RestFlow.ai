import { z } from 'zod';

export const RecipeOutputSchema = z.object({
  recipe_id: z.string().min(1),
  item_id: z.string().min(1),
  item_name: z.string().optional(),
  /** Optional example only */
  standard_quantity: z.number().positive().optional(),
  unit: z.string().min(1).default('pcs'),
  unit_weight: z.number().positive().optional(),
  weight_unit: z.string().optional(),
  is_default: z.boolean().optional().default(false),
});

export type RecipeOutputDto = z.infer<typeof RecipeOutputSchema>;
