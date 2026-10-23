import { z } from 'zod';

const CreateRecipeIngredientSchema = z.object({
  raw_item_id: z.string().min(1),
  raw_item_name: z.string().min(1),
  quantity_per_unit: z.number().positive(),
  unit: z.string().min(1),
  unit_cost: z.number().min(0).optional(),
  notes: z.string().optional(),
});

/**
 * Multi-output sizes: fixed weight per piece only.
 * standard_quantity is optional example mix — never production truth.
 */
const CreateRecipeOutputSchema = z.object({
  item_id: z.string().min(1),
  item_name: z.string().optional(),
  standard_quantity: z.number().positive().optional(),
  unit: z.string().min(1).default('pcs'),
  unit_weight: z.number().positive().optional(),
  weight_unit: z.string().optional(),
  is_default: z.boolean().optional(),
});

export const CreateRecipeSchema = z
  .object({
    item_id: z.string().min(1, { message: 'Finished item ID is required' }),
    item_name: z.string().min(1, { message: 'Finished item name is required' }),
    standard_yield: z
      .number()
      .positive({ message: 'Standard yield must be positive' }),
    unit: z.string().min(1, { message: 'Unit is required' }),
    notes: z.string().optional(),
    /** Free-text operational category (suggestions only on the client) */
    category: z.string().min(1).optional(),
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
      .optional()
      .default('SINGLE_OUTPUT'),
    yield_quantity: z.number().positive().optional(),
    yield_unit: z.string().min(1).optional(),
    yield_basis: z.enum(['BATCH', 'UNIT']).optional().default('BATCH'),
    ingredients: z.array(CreateRecipeIngredientSchema).optional().default([]),
    outputs: z.array(CreateRecipeOutputSchema).optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.recipe_type === 'MULTI_OUTPUT') {
      if (!data.outputs || data.outputs.length < 2) {
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

export type CreateRecipeDto = z.infer<typeof CreateRecipeSchema>;
export type CreateRecipeIngredientDto = z.infer<
  typeof CreateRecipeIngredientSchema
>;
export type CreateRecipeOutputDto = z.infer<typeof CreateRecipeOutputSchema>;
