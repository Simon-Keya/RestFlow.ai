// apps/api/src/modules/notifications/push.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  async sendPush(to: string[], title: string, body: string, data?: any) {
    try {
      const messages = to.map(token => ({
        to: token,
        sound: 'default',
        title,
        body,
        data: data || {},
      }));

      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        await expo.sendPushNotificationsAsync(chunk);
      }

      this.logger.log(`Push sent to ${to.length} devices`);
    } catch (error) {
      this.logger.error('Push failed', error);
    }
  }
}