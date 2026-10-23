// apps/api/src/modules/refill/refill.gateway.ts
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
  namespace: '/refill',
  transports: ['websocket'],
})
export class RefillGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RefillGateway.name);

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
      this.logger.log(`Refill connected: ${client.id} (${user.email})`);
      client.emit('connected', { message: 'Refill real-time connected' });
    } catch {
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Refill disconnected: ${client.id}`);
  }

  broadcastRefillRequest(requestData: unknown) {
    this.server.emit('refill_requested', requestData);
  }

  broadcastRefillIssued(issueData: unknown) {
    this.server.emit('refill_issued', issueData);
  }
}