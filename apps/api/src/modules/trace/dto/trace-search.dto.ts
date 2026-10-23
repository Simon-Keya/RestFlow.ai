// apps/api/src/modules/trace/dto/trace-search.dto.ts
import { z } from 'zod';

export const TraceSearchSchema = z.object({
  q: z.string().min(1).optional(),
  shopId: z.string().optional(),
  shop_id: z.string().optional(),
  itemId: z.string().optional(),
  batchNumber: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type TraceSearchDto = z.infer<typeof TraceSearchSchema>;
