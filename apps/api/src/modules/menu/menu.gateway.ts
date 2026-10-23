// apps/api/src/modules/menu/menu.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
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
  namespace: '/menu',
  transports: ['websocket'],
})
export class MenuGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MenuGateway.name);

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
      this.logger.log(`Menu connected: ${client.id} (${user.email})`);
      client.emit('connected', { message: 'Menu real-time connected' });
    } catch {
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Menu disconnected: ${client.id}`);
  }

  broadcastAvailabilityUpdate(
    menuId: string,
    availableQuantity: number,
    isAvailable: boolean,
  ) {
    this.server.emit('menu_availability_updated', {
      menu_id: menuId,
      available_quantity: availableQuantity,
      is_available: isAvailable,
      timestamp: new Date().toISOString(),
    });
  }
}