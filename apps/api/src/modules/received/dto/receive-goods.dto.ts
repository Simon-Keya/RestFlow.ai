// apps/api/src/modules/received/dto/receive-goods.dto.ts
import { z } from 'zod';
import {
  isAllowedIngredientCategory,
  normalizeIngredientCategory,
} from '../../../common/constants/ingredient-categories';

const dateOnly = z
  .string()
  .min(1, { message: 'Date is required' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date must be in YYYY-MM-DD format',
  });

const emptyToUndefined = (v: unknown) =>
  v === '' || v === null ? undefined : v;

export const ReceiveGoodsSchema = z
  .object({
    item_id: z.string().min(1, { message: 'Item ID is required' }),
    item_name: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    units: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    category: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .min(1, { message: 'Category is required' })
        .refine((v) => isAllowedIngredientCategory(v), {
          message:
            'Category must be a valid inventory category (e.g. Meat & Poultry, Dairy & Eggs)',
        })
        .optional(),
    ),

    quantity: z.coerce
      .number({ message: 'Quantity must be a number' })
      .positive({ message: 'Quantity must be positive' }),

    quantity_approved: z.preprocess(
      emptyToUndefined,
      z.coerce.number().nonnegative().optional(),
    ),
    quantity_rejected: z.preprocess(
      emptyToUndefined,
      z.coerce.number().nonnegative().optional(),
    ),

    date_received: z.preprocess(emptyToUndefined, dateOnly.optional()),
    expiry_date: z.preprocess(emptyToUndefined, dateOnly.optional()),

    unit_cost: z.coerce
      .number({ message: 'Unit cost must be a number' })
      .positive({ message: 'Unit cost (KES) is required and must be greater than 0 — needed for inventory value' }),

    total_cost: z.preprocess(
      emptyToUndefined,
      z.coerce.number().min(0).optional(),
    ),

    supplier_name: z.preprocess(emptyToUndefined, z.string().optional()),
    supplier_number: z.preprocess(emptyToUndefined, z.string().optional()),
    supplier_id: z.preprocess(emptyToUndefined, z.string().optional()),
    approved_by: z.preprocess(emptyToUndefined, z.string().optional()),

    batch_number: z
      .string()
      .min(1, { message: 'Batch number is required for traceability' }),

    reference: z.preprocess(emptyToUndefined, z.string().optional()),
    waste_reason: z.preprocess(emptyToUndefined, z.string().optional()),
    waste_photo_url: z.preprocess(emptyToUndefined, z.string().optional()),

    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .transform((data) => {
    const approved =
      data.quantity_approved !== undefined
        ? data.quantity_approved
        : data.quantity;
    const rejected = data.quantity_rejected ?? 0;
    const today = new Date().toISOString().slice(0, 10);
    const category =
      normalizeIngredientCategory(data.category) ?? data.category?.trim();

    return {
      ...data,
      item_name: data.item_name?.trim() || data.item_id,
      units: data.units?.trim() || 'units',
      category,
      date_received: data.date_received || today,
      quantity_approved: approved,
      quantity_rejected: rejected,
      total_cost:
        data.total_cost !== undefined
          ? data.total_cost
          : approved * data.unit_cost,
    };
  });

export type ReceiveGoodsDto = z.infer<typeof ReceiveGoodsSchema>;
