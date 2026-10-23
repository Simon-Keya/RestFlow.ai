import { z } from "zod";
import { REASON_CODES } from "@/types/variance";

export const reasonCodeSchema = z.object({
  itemId: z.string().min(1),
  reasonCode: z.enum(REASON_CODES),
  note: z.string().optional(),
});

export type ReasonCodeInput = z.infer<typeof reasonCodeSchema>;
