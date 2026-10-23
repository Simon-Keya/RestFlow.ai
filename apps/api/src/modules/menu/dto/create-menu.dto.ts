// apps/api/src/modules/menu/dto/create-menu.dto.ts
import { z } from 'zod';

export const ComponentTypeEnum = z.enum(['FIXED', 'CHOICE', 'MULTI_CHOICE', 'INVENTORY']);

export const MenuComponentLineSchema = z
  .object({
    component_key: z.string().min(1).optional(),
    component_type: ComponentTypeEnum.default('FIXED'),

    finished_good_id: z.string().min(1).optional(),
    finished_good_name: z.string().optional(),

    finished_good_category_id: z.string().min(1).optional(),
    finished_good_category_code: z.string().min(1).optional(),
    finished_good_category_name: z.string().optional(),

    /**
     * Inventory Select: explicit SKU ids the cashier may pick (no category required).
     */
    option_item_ids: z.array(z.string().min(1)).optional(),
    option_items: z
      .array(
        z.object({
          item_id: z.string().min(1),
          name: z.string().optional(),
          unit: z.string().optional(),
        }),
      )
      .optional(),

    quantity_required: z.number().positive().default(1),
    unit: z.string().min(1).default('pcs'),

    min_select: z.number().int().nonnegative().optional(),
    max_select: z.number().int().positive().optional(),
    allow_repeat: z.boolean().optional(),
  })
  .superRefine((line, ctx) => {
    const type = line.component_type ?? 'FIXED';
    if (type === 'FIXED') {
      if (!line.finished_good_id?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'FIXED line requires finished_good_id',
          path: ['finished_good_id'],
        });
      }
    } else {
      const hasCategory =
        Boolean(line.finished_good_category_id?.trim()) ||
        Boolean(line.finished_good_category_code?.trim());
      const hasOptions =
        (Array.isArray(line.option_item_ids) &&
          line.option_item_ids.length > 0) ||
        (Array.isArray(line.option_items) && line.option_items.length > 0);
      if (!hasCategory && !hasOptions) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'CHOICE requires option_item_ids (Inventory Select) or a finished-good category',
          path: ['option_item_ids'],
        });
      }
    }
  });

export const CreateMenuSchema = z
  .object({
    menu_code: z.string().min(1).optional(),
    name: z.string().min(1, { message: 'Menu name is required' }),
    category: z.string().optional(),
    lines: z.array(MenuComponentLineSchema).optional(),
    finished_good_id: z.string().min(1).optional(),
    finished_good_name: z.string().optional(),
    quantity_required: z.number().positive().optional(),
    unit: z.string().min(1).optional(),
    production_type: z.enum(['recipe', 'stocked']).optional(),
    recipe_id: z.string().min(1).optional(),
    stock_item_id: z.string().min(1).optional(),
    selling_price: z.number().positive({
      message: 'Selling price must be positive',
    }),
    tax_rate: z.number().min(0).max(100).default(16),
    preparation_time_minutes: z.number().int().positive().optional().nullable(),
    image_url: z.string().url().optional().or(z.literal('')),
    is_available: z.boolean().default(true),
    is_visible: z.boolean().default(true),
    notes: z.string().optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    const hasLines = Array.isArray(data.lines) && data.lines.length > 0;
    const hasSingle = Boolean(data.finished_good_id?.trim());
    if (!hasLines && !hasSingle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add at least one menu component line',
        path: ['lines'],
      });
    }
  });

export type CreateMenuDto = z.infer<typeof CreateMenuSchema>;
export type MenuComponentLineDto = z.infer<typeof MenuComponentLineSchema>;
export type ComponentType = z.infer<typeof ComponentTypeEnum>;
