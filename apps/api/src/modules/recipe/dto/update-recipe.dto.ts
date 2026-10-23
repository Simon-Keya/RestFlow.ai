// apps/api/src/modules/recipe/dto/update-recipe.dto.ts
import { z } from 'zod';

const UpdateRecipeIngredientSchema = z.object({
  raw_item_id: z.string().min(1),
  raw_item_name: z.string().min(1),
  quantity_per_unit: z.number().positive(),
  unit: z.string().min(1),
  unit_cost: z.number().min(0).optional(),
  notes: z.string().optional(),
});

const UpdateRecipeOutputSchema = z.object({
  item_id: z.string().min(1),
  item_name: z.string().optional(),
  standard_quantity: z.number().positive().optional(),
  unit: z.string().min(1).default('pcs'),
  unit_weight: z.number().positive().optional(),
  weight_unit: z.string().optional(),
  is_default: z.boolean().optional(),
});

/** Full create-field parity for recipe update (minus immutable recipe id / audit). */
export const UpdateRecipeSchema = z
  .object({
    item_id: z.string().min(1).optional(),
    item_name: z.string().min(1).optional(),
    standard_yield: z.number().positive().optional(),
    unit: z.string().min(1).optional(),
    notes: z.string().optional().nullable(),
    category: z.string().min(1).nullable().optional(),
    recipe_type: z
      .enum([
        'SINGLE_OUTPUT',
        'PORTION_OUTPUT',
        'MULTI_OUTPUT',
        'ASSEMBLY',
        'CONVERSION',
        'CO_PRODUCT',
        'SUB_RECIPE',
      ])
      .optional(),
    yield_quantity: z.number().positive().optional(),
    yield_unit: z.string().min(1).optional(),
    yield_basis: z.enum(['BATCH', 'UNIT']).optional(),
    ingredients: z.array(UpdateRecipeIngredientSchema).optional(),
    outputs: z.array(UpdateRecipeOutputSchema).optional(),
    payload: z.record(z.string(), z.any()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.recipe_type === 'MULTI_OUTPUT') {
      if (data.outputs != null && data.outputs.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'MULTI_OUTPUT requires at least two outputs',
          path: ['outputs'],
        });
      }
      data.outputs?.forEach((o, i) => {
        if (o.unit_weight == null || o.unit_weight <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Each multi-output size needs a fixed unit_weight',
            path: ['outputs', i, 'unit_weight'],
          });
        }
      });
    }
  });

export type UpdateRecipeDto = z.infer<typeof UpdateRecipeSchema>;
