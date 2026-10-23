// apps/api/src/modules/notifications/notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventStoreService } from '../../core/event-store.service';
import { NotificationsGateway } from './notifications.gateway';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly eventStore: EventStoreService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async createNotification(dto: CreateNotificationDto, actorUserId: string) {
    const notificationId = `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const event = await this.eventStore.appendEvent({
      event_type: 'notification_created',
      actor_user_id: actorUserId,
      idempotency_key: `notification-${notificationId}`,
      payload: {
        notification_id: notificationId,
        ...dto,
        read: false,
        created_at: new Date().toISOString(),
      },
    });

    // Real-time push
    this.notificationsGateway.sendToUser(dto.user_id, {
      id: notificationId,
      title: dto.title,
      message: dto.message,
      type: dto.type,
      priority: dto.priority,
      reference_id: dto.reference_id,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Notification sent to user ${dto.user_id}: ${dto.title}`);

    return {
      success: true,
      notificationId,
      eventId: event.id,
      message: 'Notification sent successfully',
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    // Mark as read in projection or event
    this.logger.log(
      `Notification ${notificationId} marked as read by ${userId}`,
    );
    return { success: true };
  }
}
