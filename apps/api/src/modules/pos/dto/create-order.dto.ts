import { z } from 'zod';

const StockDeductionSchema = z.object({
  item_id: z.string().min(1),
  item_name: z.string().optional(),
  quantity: z.number().positive(),
  unit: z.string().optional(),
  unit_cost: z.number().nonnegative().optional(),
});

export const ComponentSelectionSchema = z.object({
  component_key: z.string().min(1),
  finished_good_id: z.string().min(1),
  finished_good_name: z.string().optional(),
  quantity: z.number().positive(),
});

const PaymentMethodEnum = z.enum(['cash', 'mpesa', 'card', 'split']);

export const PaymentSplitSchema = z.object({
  method: z.enum(['cash', 'mpesa', 'card']),
  amount: z.number().positive(),
  reference: z.string().optional(),
});

export const CreateOrderSchema = z
  .object({
    order_type: z.enum([
      'dine-in',
      'takeaway',
      'delivery',
      'pickup',
      'dine_in',
    ]),

    table_number: z.string().optional(),
    customer_name: z.string().optional(),
    customer_phone: z.string().optional(),
    delivery_address: z.string().optional(),
    loyalty_number: z.string().optional(),
    shop_id: z.string().optional(),

    items: z
      .array(
        z.object({
          /** menu_item (default) | combo */
          line_type: z.enum(['menu_item', 'combo']).optional().default('menu_item'),
          menu_id: z.string().min(1).optional(),
          menu_name: z.string().min(1).optional(),
          /** Required when line_type = combo */
          combo_id: z.string().min(1).optional(),
          quantity: z.number().int().positive(),
          selling_price: z.number().nonnegative().optional(),
          notes: z.string().optional(),
          item_id: z.string().optional(),
          recipe_item_id: z.string().optional(),
          unit_cost: z.number().nonnegative().optional(),
          /** FG component picks (existing menu component lines) */
          selections: z.array(ComponentSelectionSchema).optional(),
          /** Combo category picks: group_index → menu_item_ids */
          combo_selections: z
            .array(
              z.object({
                group_index: z.number().int().nonnegative(),
                menu_item_ids: z.array(z.string().min(1)).min(1),
              }),
            )
            .optional(),
          stock_deductions: z.array(StockDeductionSchema).optional(),
        }),
      )
      .min(1, { message: 'At least one item is required' }),

    total_amount: z.number().positive(),
    tax_amount: z.number().nonnegative().default(0),
    discount_amount: z.number().nonnegative().default(0),

    payment_method: PaymentMethodEnum,
    /** When payment_method is split — must sum to total_amount */
    payment_splits: z.array(PaymentSplitSchema).optional(),
    mpesa_reference: z.string().optional(),
    payment_status: z.enum(['paid', 'pending', 'failed', 'unpaid']).optional(),

    notes: z.string().optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    data.items.forEach((line, idx) => {
      const type = line.line_type ?? 'menu_item';
      if (type === 'combo') {
        if (!line.combo_id?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'combo_id is required for combo lines',
            path: ['items', idx, 'combo_id'],
          });
        }
        if (!line.combo_selections?.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'combo_selections required for combo lines',
            path: ['items', idx, 'combo_selections'],
          });
        }
      } else if (!line.menu_id?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'menu_id is required for menu_item lines',
          path: ['items', idx, 'menu_id'],
        });
      }
    });
    if (data.payment_method === 'split') {
      const splits = data.payment_splits ?? [];
      if (splits.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Split payment needs at least two payment lines',
          path: ['payment_splits'],
        });
        return;
      }
      const sum = splits.reduce((s, p) => s + p.amount, 0);
      if (Math.abs(sum - data.total_amount) > 0.02) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Split amounts (${sum}) must equal total (${data.total_amount})`,
          path: ['payment_splits'],
        });
      }
    }
  });

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;
export type ComponentSelectionDto = z.infer<typeof ComponentSelectionSchema>;
export type PaymentSplitDto = z.infer<typeof PaymentSplitSchema>;
