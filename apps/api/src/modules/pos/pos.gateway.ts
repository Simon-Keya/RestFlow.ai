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

interface PosSocketData {
  user?: {
    email?: string;
    role?: string;
    sub?: string;
    shopId?: string;
    [key: string]: unknown;
  };
  shopId?: string;
}

@WebSocketGateway({
  cors: { origin: wsCorsOrigin(), credentials: true },
  namespace: '/pos',
  transports: ['websocket'],
})
export class PosGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PosGateway.name);

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
      const data = client.data as PosSocketData;
      data.user = user as PosSocketData['user'];
      this.logger.log(`POS connected: ${client.id}`);
      client.emit('connected', {
        message: 'POS real-time connected',
        namespace: '/pos',
      });
    } catch {
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`POS disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_shop')
  async handleJoinShop(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { shopId?: string } | undefined,
  ) {
    const data = client.data as PosSocketData;
    const shopId = String(
      body?.shopId ?? data.shopId ?? data.user?.shopId ?? '1',
    );
    data.shopId = shopId;
    await client.join(`shop:${shopId}`);
    await client.join('kitchen');
    client.emit('room_joined', { room: `shop:${shopId}`, kitchen: true });
  }

  @SubscribeMessage('join_kitchen')
  async handleJoinKitchen(@ConnectedSocket() client: Socket) {
    const data = client.data as PosSocketData;
    const role = String(data.user?.role ?? '').toUpperCase();
    if (['KITCHEN', 'MANAGER', 'ADMIN', 'POS'].includes(role)) {
      await client.join('kitchen');
      client.emit('joined_kitchen', { message: 'Joined kitchen room' });
    } else {
      client.emit('error', { message: 'Unauthorized for kitchen display' });
    }
  }

  /** New order placed (POS) — shop room + kitchen */
  broadcastOrderCreated(
    orderData: Record<string, unknown>,
    shopId: string = '1',
  ) {
    const payload = {
      ...orderData,
      shop_id: orderData.shop_id ?? shopId,
      timestamp: orderData.timestamp ?? new Date().toISOString(),
    };
    this.server.to(`shop:${shopId}`).emit('order_created', payload);
    this.server.to('kitchen').emit('kitchen_new_order', payload);
  }

  broadcastNewOrder(orderData: unknown) {
    const data = (orderData ?? {}) as Record<string, unknown>;
    const shopId = String(data.shop_id ?? data.shopId ?? '1');
    this.broadcastOrderCreated(data, shopId);
  }

  broadcastOrderStatusUpdate(
    orderId: string,
    status: string,
    extra: Record<string, unknown> = {},
  ) {
    const shopId = String(extra.shop_id ?? extra.shopId ?? '1');
    const payload = {
      order_id: orderId,
      status,
      ...extra,
      shop_id: shopId,
      timestamp: new Date().toISOString(),
    };
    this.server.to(`shop:${shopId}`).emit('order_status_updated', payload);
    this.server.emit('order_status_updated', payload);
  }
}
