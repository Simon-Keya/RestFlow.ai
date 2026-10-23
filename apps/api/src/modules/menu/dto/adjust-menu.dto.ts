import { z } from 'zod';

/**
 * Adjust = update parity with CreateMenu domain fields.
 * Immutable / system-only fields stay off this DTO (event ids, derived costs).
 * expected_updated_at is update-only concurrency token.
 */
const adjustLineSchema = z.object({
  component_key: z.string().min(1).optional(),
  component_type: z
    .enum(['FIXED', 'CHOICE', 'MULTI_CHOICE', 'INVENTORY'])
    .default('FIXED'),
  finished_good_id: z.string().optional().nullable(),
  finished_good_name: z.string().optional().nullable(),
  finished_good_category_id: z.string().optional().nullable(),
  finished_good_category_code: z.string().optional().nullable(),
  finished_good_category_name: z.string().optional().nullable(),
  option_item_ids: z.array(z.string().min(1)).optional(),
  quantity_required: z.coerce.number().positive(),
  unit: z.string().min(1).default('pcs'),
  min_select: z.coerce.number().int().nonnegative().optional(),
  max_select: z.coerce.number().int().positive().optional(),
  allow_repeat: z.boolean().optional(),
});

export const AdjustMenuSchema = z.object({
  name: z.string().min(1).optional(),
  /** Optional; treated as mutable POS code when provided */
  menu_code: z.string().min(1).optional().nullable(),
  category: z.string().optional().nullable(),
  selling_price: z.number().nonnegative().optional(),
  tax_rate: z.number().min(0).max(100).optional(),
  is_available: z.boolean().optional(),
  is_visible: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  preparation_time_minutes: z.number().int().positive().optional().nullable(),
  image_url: z.string().url().optional().or(z.literal('')).nullable(),
  /** Full intended component set — replaces previous lines when provided */
  lines: z.array(adjustLineSchema).min(1).optional(),
  /** Optimistic concurrency: ISO timestamp from listMenus createdAt / adjusted marker */
  expected_updated_at: z.string().optional().nullable(),
});

export type AdjustMenuDto = z.infer<typeof AdjustMenuSchema>;
