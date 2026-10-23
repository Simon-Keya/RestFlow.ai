// apps/api/src/modules/auth/dto/login.dto.ts
import { z } from 'zod';

// ──────────────────────────────────────────────
// Zod Schema – Single source of truth for Login
export const LoginSchema = z.object({
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
});

// Inferred TypeScript type
export type LoginDto = z.infer<typeof LoginSchema>;

// ──────────────────────────────────────────────
// Swagger Schema for @ApiBody (clean, no excessive examples)
export const LoginSwaggerSchema = {
  type: 'object',
  properties: {
    email: {
      type: 'string',
      format: 'email',
    },
    password: {
      type: 'string',
      minLength: 6,
    },
  },
  required: ['email', 'password'],
};
