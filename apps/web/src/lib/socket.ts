/** Shared connection; HTTP and sockets use the same refresh coordinator. */
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth-store';
import { expireSession, isAuthenticationFailure, readSession, refreshSession } from './session';

let socket: Socket | null = null;
let unsubscribe: (() => void) | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export function getSocket(token?: string): Socket {
  if (socket) return socket;
  let attempted = readSession();
  const current = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001', {
    path: '/socket.io',
    auth: (callback) => {
      attempted = readSession();
      const accessToken = attempted?.accessToken ?? token;
      callback(accessToken ? { token: `Bearer ${accessToken}` } : {});
    },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
  });
  socket = current;
  let renewing = false;
  const renew = async () => {
    if (renewing || socket !== current || !attempted) return;
    const previous = attempted;
    current.disconnect();
    if (!readSession()?.refreshToken) {
      expireSession(previous.accessToken);
      return;
    }
    renewing = true;
    try {
      await refreshSession(previous.accessToken, previous.user.id);
      if (socket === current && readSession()) current.connect();
    } catch (error) {
      if (isAuthenticationFailure(error)) {
        expireSession(previous.accessToken);
      } else if (socket === current && readSession()?.user.id === previous.user.id) {
        // A temporary backend/network failure preserves the session and retries.
        retryTimer = setTimeout(() => { retryTimer = null; void renew(); }, 5000);
      }
    } finally { renewing = false; }
  };

  current.on('session_expired', () => { void renew(); });
  current.on('connect_error', (error) => {
    if (error.message === 'Unauthorized') void renew();
  });
  unsubscribe = useAuthStore.subscribe((state, previous) => {
    if (state.token === previous.token || socket !== current) return;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    current.disconnect();
    if (state.token) current.connect();
  });
  // Other tabs persist rotated tokens and logout through the storage event.
  return current;
}

export function disconnectSocket(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  unsubscribe?.();
  unsubscribe = null;
  socket?.disconnect();
  socket = null;
}
