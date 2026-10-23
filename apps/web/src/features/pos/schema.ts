import { z } from "zod";

export const orderFiltersSchema = z.object({
  status: z.string().optional(),
  orderType: z.string().optional(),
});

export type OrderFilters = z.infer<typeof orderFiltersSchema>;
