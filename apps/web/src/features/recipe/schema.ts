import { z } from "zod";

export const recipeIngredientSchema = z.object({
  rawItemId: z.string().min(1, "Raw item ID is required"),
  rawItemName: z.string().min(1, "Raw item name is required"),
  quantityPerUnit: z.coerce.number().positive("Quantity must be positive"),
  unit: z.string().min(1, "Unit is required"),
  unitCost: z.coerce
    .number()
    .nonnegative("Unit cost cannot be negative")
    .optional()
    .nullable(),
});

export const recipeOutputSchema = z.object({
  itemId: z.string().min(1),
  itemName: z.string().optional(),
  /** Optional example mix only */
  standardQuantity: z.coerce.number().positive().optional().nullable(),
  unit: z.string().min(1),
  unitWeight: z.coerce.number().positive("Weight per piece is required"),
  weightUnit: z.string().min(1).default("g"),
  isDefault: z.boolean().optional(),
});

export const createRecipeSchema = z
  .object({
    itemId: z.string().min(1, "Finished item ID is required"),
    itemName: z.string().min(1, "Finished item name is required"),
    standardYield: z.coerce
      .number()
      .positive("Yield must be a positive number"),
    unit: z.string().min(1, "Unit is required"),
    notes: z.string().optional(),
    category: z.string().min(1).optional(),
    recipeType: z
      .enum([
        "SINGLE_OUTPUT",
        "PORTION_OUTPUT",
        "MULTI_OUTPUT",
        "ASSEMBLY",
        "CONVERSION",
        "CO_PRODUCT",
        "SUB_RECIPE",
      ])
      .optional()
      .default("SINGLE_OUTPUT"),
    yieldQuantity: z.coerce.number().positive().optional(),
    yieldUnit: z.string().optional(),
    yieldBasis: z.enum(["BATCH", "UNIT"]).optional().default("BATCH"),
    ingredients: z
      .array(recipeIngredientSchema)
      .min(1, "Add at least one ingredient"),
    outputs: z.array(recipeOutputSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.recipeType === "MULTI_OUTPUT") {
      if (!data.outputs || data.outputs.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Multi-output needs at least two sizes with weights",
          path: ["outputs"],
        });
      }
      data.outputs?.forEach((o, i) => {
        if (!o.unitWeight || o.unitWeight <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Each size needs a positive weight per piece",
            path: ["outputs", i, "unitWeight"],
          });
        }
      });
    }
  });

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;
export type RecipeIngredientInput = z.infer<typeof recipeIngredientSchema>;
export type RecipeOutputInput = z.infer<typeof recipeOutputSchema>;

export const updateRecipeSchema = z
  .object({
    itemId: z.string().min(1, "Finished item ID is required").optional(),
    itemName: z.string().min(1, "Finished item name is required").optional(),
    standardYield: z.coerce
      .number()
      .positive("Yield must be a positive number")
      .optional(),
    unit: z.string().min(1, "Unit is required").optional(),
    notes: z.string().optional().nullable(),
    category: z.string().min(1).nullable().optional(),
    recipeType: z
      .enum([
        "SINGLE_OUTPUT",
        "PORTION_OUTPUT",
        "MULTI_OUTPUT",
        "ASSEMBLY",
        "CONVERSION",
        "CO_PRODUCT",
        "SUB_RECIPE",
      ])
      .optional(),
    yieldQuantity: z.coerce.number().positive().optional(),
    yieldUnit: z.string().optional(),
    yieldBasis: z.enum(["BATCH", "UNIT"]).optional(),
    ingredients: z.array(recipeIngredientSchema).optional(),
    outputs: z.array(recipeOutputSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.recipeType === "MULTI_OUTPUT") {
      if (data.outputs != null && data.outputs.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Multi-output needs at least two sizes with weights",
          path: ["outputs"],
        });
      }
    }
  });

export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;