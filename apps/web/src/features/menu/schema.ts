import { z } from "zod";

const fixedLineSchema = z.object({
  component_type: z.literal("FIXED").default("FIXED"),
  component_key: z.string().optional(),
  finished_good_id: z.string().min(1, "Select a finished good"),
  finished_good_name: z.string().optional(),
  quantity_required: z.coerce.number().positive("Qty must be > 0"),
  unit: z.string().min(1).default("pcs"),
});

const choiceLineSchema = z
  .object({
    component_type: z.enum(["CHOICE", "MULTI_CHOICE"]),
    component_key: z.string().optional(),
    finished_good_category_id: z.string().optional(),
    finished_good_category_code: z.string().optional(),
    finished_good_category_name: z.string().optional(),
    /** Explicit SKUs — Inventory Select (no category required) */
    option_item_ids: z.array(z.string().min(1)).optional(),
    quantity_required: z.coerce.number().positive("Qty must be > 0"),
    unit: z.string().min(1).default("pcs"),
    min_select: z.coerce.number().int().nonnegative().optional(),
    max_select: z.coerce.number().int().positive().optional(),
    allow_repeat: z.boolean().optional(),
  })
  .superRefine((line, ctx) => {
    const hasCategory = Boolean(line.finished_good_category_id?.trim());
    const hasOptions =
      Array.isArray(line.option_item_ids) && line.option_item_ids.length > 0;
    if (!hasCategory && !hasOptions) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CHOICE requires a category pool or at least one inventory SKU",
        path: ["option_item_ids"],
      });
    }
  });

export const menuComponentLineSchema = z.union([
  fixedLineSchema,
  choiceLineSchema,
]);

export const createMenuSchema = z.object({
  name: z.string().min(1, "Name is required"),
  menu_code: z.string().optional(),
  category: z.string().optional(),
  lines: z
    .array(menuComponentLineSchema)
    .min(1, "Add at least one component line"),
  selling_price: z.coerce.number().positive("Price must be positive"),
  tax_rate: z.coerce.number().min(0).max(100).default(16),
  notes: z.string().optional(),
});

export type CreateMenuInput = z.infer<typeof createMenuSchema>;
export type MenuComponentLineInput = z.infer<typeof menuComponentLineSchema>;
