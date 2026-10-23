// apps/mobile/src/lib/socket.ts
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './constants';
import { getAuthToken } from './tokenStorage';

const sockets: Record<string, Socket> = {};

/**
 * Sync helper for reconnect hooks — uses cached token when available.
 * Prefer getSocketAsync when opening a new connection.
 */
let cachedToken: string | null = null;

export function setSocketTokenCache(token: string | null) {
  cachedToken = token;
  Object.values(sockets).forEach((socket) => {
    socket.auth = { token };
  });
}

function currentToken(): string | null {
  return cachedToken;
}

/**
 * Get or create a socket for a namespace (e.g. '/pos', '/waste').
 * Call after login via refreshSocketAuth() so auth is attached.
 */
export function getSocket(namespace: string = ''): Socket {
  const key = namespace || 'root';
  const existing = sockets[key];
  const token = currentToken();

  if (existing) {
    existing.auth = { token };
    if (!existing.connected) {
      existing.connect();
    }
    return existing;
  }

  // Don't connect to placeholder hosts
  if (
    !API_BASE_URL ||
    API_BASE_URL.includes('your-api-url') ||
    API_BASE_URL.includes('example.com')
  ) {
    console.warn(
      'Socket skipped: set EXPO_PUBLIC_API_URL to your API host',
      API_BASE_URL,
    );
  }

  const socket = io(`${API_BASE_URL}${namespace}`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    timeout: 20000,
    autoConnect: !!token, // only auto-connect when we have a token
  });

  socket.io.on('reconnect_attempt', () => {
    socket.auth = { token: currentToken() };
  });

  socket.on('connect', () => {
    console.log(`✅ Socket connected: ${namespace || '/'}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`❌ Socket disconnected (${namespace || '/'}):`, reason);
  });

  socket.on('connect_error', (err) => {
    console.warn(`Socket connect error (${namespace || '/'}):`, err.message);
  });

  sockets[key] = socket;
  return socket;
}

export async function getSocketAsync(namespace: string = ''): Promise<Socket> {
  const token = await getAuthToken();
  setSocketTokenCache(token);
  return getSocket(namespace);
}

export function disconnectSocket(namespace?: string) {
  if (namespace !== undefined) {
    const key = namespace || 'root';
    if (sockets[key]) {
      sockets[key].removeAllListeners();
      sockets[key].disconnect();
      delete sockets[key];
    }
    return;
  }
  disconnectAllSockets();
}

export function disconnectAllSockets() {
  Object.keys(sockets).forEach((key) => {
    sockets[key].removeAllListeners();
    sockets[key].disconnect();
    delete sockets[key];
  });
}

/** Call after login / bootstrap so sockets use the latest JWT */
export async function refreshSocketAuth() {
  const token = await getAuthToken();
  setSocketTokenCache(token);
  Object.values(sockets).forEach((socket) => {
    socket.auth = { token };
    if (token && !socket.connected) {
      socket.connect();
    }
    if (!token && socket.connected) {
      socket.disconnect();
    }
  });
}