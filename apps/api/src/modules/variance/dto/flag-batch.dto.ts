// apps/api/src/modules/variance/dto/flag-batch.dto.ts
import { z } from 'zod';

export const FlagBatchSchema = z.object({
  flagged: z.boolean().default(true),
  note: z.string().optional(),
});

export type FlagBatchDto = z.infer<typeof FlagBatchSchema>;
