import { z } from 'zod';

export const AssignableRoles = z.enum(['ADMIN', 'MANAGER', 'KITCHEN', 'POS']);
export type AssignableRole = z.infer<typeof AssignableRoles>;

export const ChangeRoleSchema = z.object({
  role: AssignableRoles,
});

export type ChangeRoleDto = z.infer<typeof ChangeRoleSchema>;
