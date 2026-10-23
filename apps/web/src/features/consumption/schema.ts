import { z } from "zod";

export const consumptionFilterSchema = z.object({
  from: z.string(),
  to: z.string(),
});

export type ConsumptionFilter = z.infer<typeof consumptionFilterSchema>;
