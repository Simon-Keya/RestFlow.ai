// apps/api/src/modules/refill/dto/refill-issue.dto.ts
import { z } from 'zod';

export const RefillIssueSchema = z.object({
  request_id: z.string().min(1, { message: 'Request ID is required' }),

  approved_qty: z.number().positive().optional(),
  issued_qty: z.number().positive().optional(),

  /** Unit cost for this inbound lot — drives inventory value */
  unit_cost: z.number().nonnegative().optional(),

  batch_number: z.string().min(1).optional(),

  /** Preferred: YYYY-MM-DD from the issue form */
  expiry_date: z
    .union([
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      z.date(),
      z.string().datetime(),
    ])
    .optional(),

  lost_weight: z.number().nonnegative().optional().default(0),
  variance_reason: z.string().optional(),
  notes: z.string().optional(),
  shop_id: z.string().optional(),
  payload: z.record(z.string(), z.any()).optional(),
});

export type RefillIssueDto = z.infer<typeof RefillIssueSchema>;
