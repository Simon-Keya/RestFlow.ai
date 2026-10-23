// apps/web/src/features/inventory/schema.ts
import { z } from "zod";
import { INGREDIENT_CATEGORIES } from "@/lib/catalog/ingredient-categories";

const optionalNonNegNumber = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  });

export const receiveGoodsSchema = z.object({
  item_id: z.string().min(1, "Item ID / SKU is required"),
  item_name: z.string().min(1, "Item name is required"),
  units: z.string().min(1, "Units are required"),
  category: z
    .string()
    .min(1, "Category is required")
    .refine(
      (v) =>
        INGREDIENT_CATEGORIES.some(
          (c) => c.toLowerCase() === v.trim().toLowerCase(),
        ),
      "Pick a category from the standard list",
    ),

  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  quantity_approved: optionalNonNegNumber,
  quantity_rejected: optionalNonNegNumber,

  date_received: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date received is required (YYYY-MM-DD)"),
  expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date is required (YYYY-MM-DD)"),

  unit_cost: z.coerce.number().positive("Unit cost (KES) is required and must be greater than 0"),
  total_cost: optionalNonNegNumber,

  batch_number: z.string().min(1, "Batch number is required"),

  supplier_name: z.string().optional(),
  supplier_number: z.string().optional(),
  supplier_id: z.string().optional(),
  approved_by: z.string().optional(),
});

export type ReceiveGoodsInput = z.infer<typeof receiveGoodsSchema>;
