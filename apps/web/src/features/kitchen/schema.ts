// apps/web/src/features/kitchen/schema.ts
import { z } from "zod";

export const startProductionSchema = z.object({
  recipe_id: z.string().min(1, "Recipe ID is required"),
  batch_size: z.coerce.number().positive("Batch size must be positive"),
});

export type StartProductionInput = z.infer<typeof startProductionSchema>;

export const prePrepSchema = z
  .object({
    raw_item_id: z.string().min(1, "Raw item is required"),
    prepped_item_id: z.string().min(1, "Prepped item is required"),
    prepped_item_name: z.string().optional(),
    original_qty: z.coerce.number().positive("Original quantity must be positive"),
    yielded_qty: z.coerce.number().positive("Yielded quantity must be positive"),
    loss_reason: z
      .enum([
        "thaw_drip",
        "peel",
        "trim",
        "bone_skin",
        "spoiled_on_prep",
        "other",
      ])
      .optional(),
    note: z.string().optional(),
    unit: z.string().optional(),
    method: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.yielded_qty > data.original_qty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Yielded cannot exceed original",
        path: ["yielded_qty"],
      });
    }
    const lost = data.original_qty - data.yielded_qty;
    if (lost > 0 && !data.loss_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Loss reason is required when weight is lost",
        path: ["loss_reason"],
      });
    }
  });

export type PrePrepInput = z.infer<typeof prePrepSchema>;

export const closingStockSubmissionSchema = z.object({
  entries: z
    .array(
      z.object({
        itemId: z.string().min(1),
        countedQuantity: z.number().finite(),
      }),
    )
    .min(1),
  shiftLabel: z.string().optional(),
  notes: z.string().optional(),
});

export type ClosingStockSubmission = z.infer<
  typeof closingStockSubmissionSchema
>;

export const productionLineSchema = z.object({
  itemId: z.string().min(1),
  itemName: z.string().optional(),
  standardQuantity: z.coerce.number().finite().optional(),
  actualQuantity: z.coerce.number().finite(),
  unit: z.string().optional(),
  unitCost: z.coerce.number().min(0).optional(),
});

export const finishProductionSchema = z.object({
  productionId: z.string().min(1),
  actualYield: z.coerce.number().positive("Actual yield must be positive"),
  wasteQuantity: z.coerce.number().nonnegative().optional().default(0),
  wasteReason: z.string().optional(),
  unitCost: z.coerce.number().min(0).optional().default(0),
  batchNumber: z.string().optional(),
  inputs: z.array(productionLineSchema).optional(),
  outputs: z.array(productionLineSchema).optional(),
});

export type FinishProductionInput = z.infer<typeof finishProductionSchema>;
export type ProductionLineInput = z.infer<typeof productionLineSchema>;
