// apps/api/src/modules/inventory/inventory.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
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

export type StockUpdatePayload = {
  item_id: string;
  item_name?: string;
  available_stock: number;
  total_value?: number;
  expired_stock?: number;
  damaged_stock?: number;
  days_to_expiry_min?: number | null;
  next_expiry_date?: Date | string | null;
  batch_number?: string;
  shop_id?: string;
};

export type LowStockAlertPayload = {
  item_id: string;
  item_name: string;
  current_stock: number;
  total_value?: number;
  threshold?: number;
  shop_id?: string;
};

export type DashboardAlertPayload = {
  id: string;
  type: 'low_stock' | 'near_expiry' | 'variance' | 'approval' | 'cost';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  href?: string;
  shop_id: string;
  item_id?: string;
  createdAt?: string;
};

/** Typed shape of data we attach to every authenticated socket */
interface InventorySocketData {
  user: {
    email?: string;
    sub?: string;
    [key: string]: unknown;
  };
  shopId: string;
}

@WebSocketGateway({
  cors: { origin: wsCorsOrigin(), credentials: true },
  namespace: '/inventory',
  transports: ['websocket'],
})
export class InventoryGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(InventoryGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const user = authenticateWsClient(
        client,
        this.jwtService,
        this.configService,
      );

      const shopId =
        (client.handshake.query?.shopId as string) ||
        (client.handshake.auth?.shopId as string) ||
        '1';

      const data = client.data as InventorySocketData;
      data.user = user;
      data.shopId = shopId;

      void client.join(`shop:${shopId}`);

      this.logger.log(
        `Inventory connected: ${client.id} (${user.email}) shop:${shopId}`,
      );
      client.emit('connected', {
        message: 'Inventory real-time connected',
        shopId,
      });
    } catch {
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Inventory disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_shop')
  async handleJoinShop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { shopId?: string | number | null } | undefined,
  ) {
    const socketData = client.data as InventorySocketData | undefined;
    const shopId = String(data?.shopId ?? socketData?.shopId ?? '1');

    await client.join(`shop:${shopId}`);
    client.emit('room_joined', { room: `shop:${shopId}` });
  }

  /**
   * Broadcast a stock update to the shop room.
   */
  broadcastStockUpdate(data: StockUpdatePayload, shopId: string = '1'): void {
    const roomShopId = data.shop_id || shopId;
    const payload = {
      ...data,
      shop_id: roomShopId,
      timestamp: new Date().toISOString(),
    };

    this.server.to(`shop:${roomShopId}`).emit('stock_updated', payload);
    this.server.to(`shop:${roomShopId}`).emit('inventory_updated', payload);
  }

  /**
   * Broadcast a low-stock alert (backward compatible).
   */
  broadcastLowStockAlert(
    data: LowStockAlertPayload,
    shopId: string = '1',
  ): void {
    const roomShopId = data.shop_id || shopId;
    this.server.to(`shop:${roomShopId}`).emit('low_stock_alert', {
      ...data,
      shop_id: roomShopId,
      message: `Low stock: ${data.item_name} (${data.current_stock} left)`,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast any dashboard-style alert (low stock, near expiry, approval, etc.)
   */
  broadcastDashboardAlert(data: DashboardAlertPayload, shopId?: string): void {
    const roomShopId = data.shop_id || shopId || '1';
    const payload = {
      ...data,
      shop_id: roomShopId,
      createdAt: data.createdAt || new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };

    this.server.to(`shop:${roomShopId}`).emit('dashboard_alert', payload);
  }
}
