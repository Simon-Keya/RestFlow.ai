// apps/api/src/modules/production/dto/finish-production.dto.ts
import { z } from 'zod';

const sku = z
  .string()
  .min(1)
  .transform((s) => s.trim().toUpperCase());

const ProductionLineSchema = z.object({
  item_id: sku,
  item_name: z.string().optional(),
  actual_quantity: z.number().finite(),
  unit: z.string().min(1).optional(),
  standard_quantity: z.number().finite().optional(),
  unit_cost: z.number().min(0).optional(),
  /** Piece mass for multi-output (e.g. 400 g per large ball) — required for variance */
  unit_weight: z.number().positive().optional(),
  weight_unit: z.string().optional(),
});

export const FinishProductionSchema = z
  .object({
    production_id: z.string().min(1, { message: 'Production ID is required' }),
    item_id: sku.optional(),
    item_name: z.string().optional(),
    planned_quantity: z.number().positive().optional(),
    /** Primary batch actual, or omit if outputs[] carries every size */
    actual_quantity_produced: z.number().nonnegative().optional(),
    waste_quantity: z.number().nonnegative().optional().default(0),
    waste_reason: z.string().optional(),
    waste_unit: z.string().optional(),
    batch_number: z.string().min(1, { message: 'Batch number is required' }),
    expiry_date: z.union([
      z
        .string()
        .min(1, { message: 'Expiry date is required for produced stock' })
        .regex(/^\d{4}-\d{2}-\d{2}$/, {
          message: 'Expiry date must be YYYY-MM-DD',
        }),
      z.date(),
    ]),
    unit_cost: z.number().min(0).optional(),
    total_cost: z.number().min(0).optional(),
    inputs: z.array(ProductionLineSchema).optional(),
    /** Multi-output: one line per size (e.g. DOUGH-L, DOUGH-M, DOUGH-S) */
    outputs: z.array(ProductionLineSchema).optional(),
    notes: z.string().optional(),
    payload: z.record(z.string(), z.any()).optional(),
  })
  .superRefine((data, ctx) => {
    const hasOutputs =
      Array.isArray(data.outputs) &&
      data.outputs.some((o) => o.actual_quantity > 0);
    const hasPrimary =
      data.actual_quantity_produced != null &&
      data.actual_quantity_produced > 0;
    if (!hasOutputs && !hasPrimary) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Provide actual_quantity_produced and/or outputs[] with quantities',
        path: ['actual_quantity_produced'],
      });
    }
  });

export type FinishProductionDto = z.infer<typeof FinishProductionSchema>;
export type ProductionLineDto = z.infer<typeof ProductionLineSchema>;
