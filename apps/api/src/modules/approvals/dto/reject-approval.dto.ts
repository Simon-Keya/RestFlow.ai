// apps/api/src/modules/approvals/dto/reject-approval.dto.ts
import { z } from 'zod';

export const RejectApprovalSchema = z.object({
  reason: z.string().min(1).max(500),
});

export type RejectApprovalDto = z.infer<typeof RejectApprovalSchema>;
