// apps/api/src/modules/recipe/dto/recipe-ingredient.dto.ts
import { z } from 'zod';

export const RecipeIngredientSchema = z.object({
  recipe_id: z.string().min(1, { message: 'Recipe ID is required' }),
  raw_item_id: z
    .string()
    .min(1, { message: 'Raw material item ID is required' }),
  raw_item_name: z
    .string()
    .min(1, { message: 'Raw material name is required' }),
  quantity_per_unit: z
    .number()
    .positive({ message: 'Quantity per unit must be positive' }),
  unit: z.string().min(1, { message: 'Unit is required (KG, L, pcs, etc.)' }),
  unit_cost: z
    .number()
    .min(0, { message: 'Unit cost cannot be negative' })
    .optional(),
  notes: z.string().optional(),
});

export type RecipeIngredientDto = z.infer<typeof RecipeIngredientSchema>;
