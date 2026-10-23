import { z } from 'zod';

export const SubmitReasonSchema = z.object({
  itemId: z.string().min(1),
  reasonCode: z.enum([
    'miscount',
    'theft_suspected',
    'unrecorded_waste',
    'unrecorded_transfer',
    'portioning_drift',
    'other',
  ]),
  note: z.string().max(500).optional(),
});

export type SubmitReasonDto = z.infer<typeof SubmitReasonSchema>;
