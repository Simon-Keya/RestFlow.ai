// apps/api/src/common/websockets/ws-auth.util.ts
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';

export type WsUserPayload = {
  sub: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
};

/**
 * Extract Bearer / auth.token and verify JWT.
 * Attaches payload to client.data.user on success.
 */
export function authenticateWsClient(
  client: Socket,
  jwtService: JwtService,
  configService?: ConfigService,
): WsUserPayload {
  const raw =
    client.handshake.auth?.token ||
    client.handshake.headers?.authorization;

  const token =
    typeof raw === 'string' && raw.startsWith('Bearer ')
      ? raw.slice(7)
      : typeof raw === 'string'
        ? raw
        : null;

  if (!token) {
    throw new UnauthorizedException('No token provided');
  }

  const secret =
    configService?.get<string>('jwt.secret') ||
    configService?.get<string>('JWT_SECRET');

  const payload = secret
    ? (jwtService.verify(token, { secret }) as WsUserPayload)
    : (jwtService.verify(token) as WsUserPayload);

  if (!payload?.sub) {
    throw new UnauthorizedException('Invalid token payload');
  }

  client.data.user = payload;
  return payload;
}

export function wsCorsOrigin(): string[] | boolean {
  const raw = process.env.CORS_ORIGIN;
  if (!raw || raw === '*') return true;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}