// apps/api/src/modules/production/production.gateway.ts
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
  namespace: '/production',
  transports: ['websocket'],
})
export class ProductionGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ProductionGateway.name);

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
      this.logger.log(`Production connected: ${client.id} (${user.email})`);
      client.emit('connected', { message: 'Production real-time connected' });
    } catch {
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Production disconnected: ${client.id}`);
  }

  broadcastProductionStarted(data: unknown) {
    this.server.emit('production_started', data);
  }

  broadcastProductionFinished(data: unknown) {
    this.server.emit('production_finished', data);
  }

  broadcastYieldUpdate(
    productionId: string,
    yieldPercentage: number,
    wasteQuantity: number,
  ) {
    this.server.emit('production_yield_update', {
      production_id: productionId,
      yield_percentage: yieldPercentage,
      waste_quantity: wasteQuantity,
      timestamp: new Date().toISOString(),
    });
  }
}