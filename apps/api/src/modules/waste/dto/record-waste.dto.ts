// apps/api/src/modules/waste/dto/record-waste.dto.ts
import { z } from 'zod';

export const WasteTypeEnum = z.enum([
  'spillage',
  'trimming',
  'testing',
  'adjustment',
  'error',
  'spoilage',
  'damage',
  'quality_reject',
  'shrinkage',
  'theft',
  'packaging',
  'shortage',
  'overage',
  'discount_variance',
]);

export const RootCauseEnum = z.enum([
  'preventable',
  'inherent',
  'external',
  'unknown',
]);

export const SeverityEnum = z.enum(['critical', 'high', 'medium', 'low']);

export const RecordWasteSchema = z.object({
  module_source: z.enum([
    'received',
    'production',
    'refill',
    'finished_goods',
    'pos',
    'inventory',
    'kitchen',
  ]),

  item_id: z.string().min(1),
  item_name: z.string().min(1).optional(),
  batch_number: z.string().optional(),
  /** Optional physical batch target for partial waste/spoilage. */
  batch_id: z.string().uuid().optional(),
  shop_id: z.string().optional(),

  quantity_wasted: z.number().nonnegative(),
  unit_of_measure: z.string().min(1).default('pcs'),

  /** Optional — filled from inventory average when omitted */
  unit_cost: z.number().nonnegative().optional(),
  total_waste_value: z.number().nonnegative().optional(),

  waste_type: WasteTypeEnum.default('spoilage'),
  waste_reason: z
    .string()
    .min(3, { message: 'Waste reason must be descriptive' }),
  root_cause: RootCauseEnum.default('unknown'),
  severity: SeverityEnum.default('medium'),

  photos: z.array(z.string().url()).optional(),
  preventive_action: z.string().optional(),
  discovery_location: z.string().optional(),
  time_to_discovery: z.enum(['immediate', 'hours', 'days', 'weeks']).optional(),

  notes: z.string().optional(),
  payload: z.record(z.string(), z.any()).optional(),
});

export type RecordWasteDto = z.infer<typeof RecordWasteSchema>;
