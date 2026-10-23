// apps/api/src/modules/menu/dto/menu-item.dto.ts
import { z } from 'zod';

/**
 * Adds a FIXED component line to an existing menu.
 * Choice lines should be defined on create (CreateMenuSchema.lines).
 */
export const MenuItemSchema = z.object({
  menu_id: z.string().min(1),
  component_key: z.string().min(1).optional(),
  component_type: z.literal('FIXED').default('FIXED'),
  finished_good_id: z.string().min(1, {
    message: 'Finished good ID is required',
  }),
  finished_good_name: z.string().optional(),
  quantity_required: z.number().positive({
    message: 'Quantity required must be positive',
  }),
  unit: z.string().min(1).default('pcs'),
  notes: z.string().optional(),
});

export type MenuItemDto = z.infer<typeof MenuItemSchema>;
