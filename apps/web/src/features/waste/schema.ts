// apps/web/src/features/waste/schema.ts
import { z } from "zod";

export const recordWasteSchema = z.object({
  item_id: z.string().min(1, "Select an item"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  waste_reason: z.enum([
    "expired",
    "spoiled",
    "prep_error",
    "customer_return",
    "overproduction",
    "other",
  ]),
  notes: z.string().optional(),
  batch_id: z.string().optional(),
  unit_of_measure: z.string().optional(),
});

export type RecordWasteInput = z.infer<typeof recordWasteSchema>;
