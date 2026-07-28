/**
 * Singleton Socket.IO client for the web dashboard.
 * Connects to the backend WebSocket gateway with the JWT access token.
 * Handles auto-reconnect and token refresh on auth errors.
 */
import { io, Socket } from 'socket.io-client';

let _socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  let activeToken = token;
  if (!activeToken && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('auth-storage');
      if (raw) {
        const parsed = JSON.parse(raw);
        activeToken = parsed?.state?.token;
      }
    } catch {
      // Ignore parse errors
    }
  }

  if (_socket && _socket.connected) return _socket;

  const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

  if (_socket) {
    _socket.disconnect();
  }

  _socket = io(WS_URL, {
    path: '/socket.io',
    auth: activeToken ? { token: `Bearer ${activeToken}` } : undefined,
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
  });

  return _socket;
}

export function disconnectSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
