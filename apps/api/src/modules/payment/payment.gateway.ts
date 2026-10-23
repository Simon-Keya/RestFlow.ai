// apps/api/src/modules/payment/payment.gateway.ts
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
  namespace: '/payment',
  transports: ['websocket'],
})
export class PaymentGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(PaymentGateway.name);

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
      this.logger.log(`Payment connected: ${client.id} (${user.email})`);
      client.emit('connected', { message: 'Payment real-time connected' });
    } catch {
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Payment disconnected: ${client.id}`);
  }

  broadcastPaymentStatus(paymentData: {
    order_id?: string;
    status: string;
    amount?: number;
    method?: string;
    [key: string]: unknown;
  }) {
    this.server.emit('payment_status_updated', {
      ...paymentData,
      timestamp: new Date().toISOString(),
    });
  }
}