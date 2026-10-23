// apps/api/src/modules/waste/waste.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
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
  namespace: '/waste',
  transports: ['websocket'],
})
export class WasteGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WasteGateway.name);

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
      this.logger.log(`Waste connected: ${client.id} (${user.email})`);
      client.emit('connected', { message: 'Waste real-time connected' });
    } catch {
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Waste disconnected: ${client.id}`);
  }

  broadcastWasteRecorded(wasteData: Record<string, any>) {
    this.server.emit('waste_recorded', wasteData);

    if (
      wasteData.severity === 'critical' ||
      Number(wasteData.total_waste_value) > 5000
    ) {
      this.server.emit('critical_waste_alert', {
        id: wasteData.waste_id,
        message: 'CRITICAL WASTE ALERT',
        item: wasteData.item_name,
        quantity: wasteData.quantity_wasted,
        value: wasteData.total_waste_value,
        reason: wasteData.waste_reason,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    if (!client.data.user) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }
    client.join(data.room);
    client.emit('room_joined', { room: data.room });
  }
}