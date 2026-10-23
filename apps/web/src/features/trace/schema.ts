import { z } from "zod";

export const traceSearchSchema = z.object({
  itemId: z.string().optional(),
  batchNumber: z.string().optional(),
  eventType: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type TraceSearchInput = z.infer<typeof traceSearchSchema>;
