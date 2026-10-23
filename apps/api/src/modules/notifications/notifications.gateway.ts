// apps/api/src/modules/notifications/notifications.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import {
  authenticateWsClient,
  wsCorsOrigin,
} from '../../common/websockets/ws-auth.util';

@WebSocketGateway({
  cors: { origin: wsCorsOrigin(), credentials: true },
  namespace: '/notifications',
  transports: ['websocket'],
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const user = authenticateWsClient(
        client,
        this.jwtService,
        this.configService,
      );
      client.join(`user-${user.sub}`);
      this.logger.log(`Notifications connected: ${client.id} (${user.email})`);
      client.emit('connected', {
        message: 'Notifications real-time connected',
      });
    } catch {
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Notifications disconnected: ${client.id}`);
  }

  sendToUser(userId: string, notification: unknown) {
    this.server.to(`user-${userId}`).emit('notification', notification);
  }

  broadcastToAll(notification: unknown) {
    this.server.emit('notification', notification);
  }

  @SubscribeMessage('join_user_room')
  handleJoinUserRoom(@ConnectedSocket() client: Socket) {
    const userId = client.data.user?.sub as string | undefined;
    if (userId) {
      client.join(`user-${userId}`);
      client.emit('joined_user_room', { userId });
    }
  }
}