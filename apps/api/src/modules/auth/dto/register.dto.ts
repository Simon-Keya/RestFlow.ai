// apps/api/src/modules/auth/dto/register.dto.ts
import { z } from 'zod';

// ──────────────────────────────────────────────
// Reusable Role Enum (aligned with Prisma Role enum)
export const UserRole = z.enum(['KITCHEN', 'POS']); // ADMIN/MANAGER only via Users API

// ──────────────────────────────────────────────
// Zod Schema – Single source of truth for User Registration
export const RegisterSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'Name must be at least 2 characters long' })
    .trim()
    .describe('Full name of the user'),

  email: z
    .string()
    .email({ message: 'Please provide a valid email address' })
    .toLowerCase()
    .trim()
    .describe('User email address'),

  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters long' })
    .describe('User password'),

  role: UserRole.optional().default('KITCHEN').describe('User role in the system'),
});

// Inferred TypeScript type
export type RegisterDto = z.infer<typeof RegisterSchema>;

// ──────────────────────────────────────────────
// Swagger Schema for @ApiBody (clean production version)
export const RegisterSwaggerSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 2,
    },
    email: {
      type: 'string',
      format: 'email',
    },
    password: {
      type: 'string',
      minLength: 6,
    },
    role: {
      type: 'string',
      enum: ['MANAGER', 'KITCHEN', 'POS'],
      default: 'KITCHEN',
    },
  },
  required: ['name', 'email', 'password'],
};
