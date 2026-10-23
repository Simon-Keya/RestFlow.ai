// apps/api/src/modules/approvals/dto/approve-approval.dto.ts
import { z } from 'zod';

export const ApproveApprovalSchema = z.object({
  note: z.string().max(500).optional(),
});

export type ApproveApprovalDto = z.infer<typeof ApproveApprovalSchema>;
