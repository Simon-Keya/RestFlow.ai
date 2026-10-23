// apps/api/src/modules/finished-goods/finished-goods.gateway.ts
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
  namespace: '/finished-goods',
  transports: ['websocket'],
})
export class FinishedGoodsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(FinishedGoodsGateway.name);

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
      this.logger.log(`FinishedGoods connected: ${client.id} (${user.email})`);
      client.emit('connected', { message: 'Finished goods real-time connected' });
    } catch {
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`FinishedGoods disconnected: ${client.id}`);
  }

  broadcastStockUpdate(
    itemId: string,
    change: number,
    batchNumber?: string,
  ) {
    this.server.emit('stock_updated', {
      item_id: itemId,
      batch_number: batchNumber,
      change,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastLowStockAlert(
    itemId: string,
    itemName: string,
    currentStock: number,
  ) {
    this.server.emit('low_stock_alert', {
      item_id: itemId,
      item_name: itemName,
      current_stock: currentStock,
      message: `Low stock alert for ${itemName} (${currentStock} left)`,
      timestamp: new Date().toISOString(),
    });
  }
}