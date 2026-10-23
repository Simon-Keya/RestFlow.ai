// apps/api/src/modules/notifications/dto/create-notification.dto.ts
import { z } from 'zod';

export const CreateNotificationSchema = z.object({
  user_id: z.string().min(1, { message: 'User ID is required' }),

  title: z.string().min(1, { message: 'Title is required' }),
  message: z.string().min(5, { message: 'Message must be descriptive' }),

  type: z.enum(['info', 'warning', 'critical', 'success']),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),

  module_source: z.string().optional(),
  reference_id: z.string().optional(),

  expires_at: z.date().optional(),
  payload: z.record(z.string(), z.any()).optional(),
});

export type CreateNotificationDto = z.infer<typeof CreateNotificationSchema>;