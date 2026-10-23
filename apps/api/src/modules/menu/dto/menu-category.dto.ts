import { z } from 'zod';

export const CreateMenuCategorySchema = z.object({
  category_id: z.string().min(1).optional(),
  name: z.string().min(1),
  /** Menu item IDs (sellable products) belonging to this category */
  menu_item_ids: z.array(z.string().min(1)).default([]),
  shop_id: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateMenuCategoryDto = z.infer<typeof CreateMenuCategorySchema>;

export const CreateComboSchema = z.object({
  combo_id: z.string().min(1).optional(),
  name: z.string().min(1),
  selling_price: z.number().nonnegative(),
  shop_id: z.string().optional(),
  /** Pick N items from each category */
  selection_groups: z
    .array(
      z.object({
        menu_category_id: z.string().min(1),
        menu_category_name: z.string().optional(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  notes: z.string().optional(),
});

export type CreateComboDto = z.infer<typeof CreateComboSchema>;
