import axios from 'axios';
import { useAuthStore, type AuthUser } from '../store/auth-store';
import { createSessionRefresher, SessionChangedError } from './session-refresh';

export { SessionChangedError };
export interface BrowserSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export function readSession(): BrowserSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const state = JSON.parse(localStorage.getItem('auth-storage') || 'null')?.state;
    if (typeof state?.token !== 'string' || typeof state?.user?.id !== 'string') return null;
    return { user: state.user, accessToken: state.token, refreshToken: state.refreshToken || '' };
  } catch { return null; }
}

let redirecting = false;
export function expireSession(expectedToken: string): void {
  if (typeof window === 'undefined' || redirecting || readSession()?.accessToken !== expectedToken) return;
  redirecting = true;
  useAuthStore.getState().logout();
  window.location.replace('/login?reason=session_expired');
}

export const refreshSession = createSessionRefresher<BrowserSession>({
  read: readSession,
  async renew(refreshToken) {
    if (!refreshToken) throw new SessionChangedError();
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api';
    // A separate request bypasses the application interceptor and prevents recursion.
    const { data } = await axios.post(`${base}/auth/refresh`, { refresh_token: refreshToken }, { timeout: 15000 });
    if (typeof data?.access_token !== 'string' || typeof data?.refresh_token !== 'string' || typeof data?.user?.id !== 'string') {
      throw new Error('Invalid session response');
    }
    return { user: data.user, accessToken: data.access_token, refreshToken: data.refresh_token };
  },
  save(session) { useAuthStore.getState().setAuth(session.user, session.accessToken, session.refreshToken); },
  async withLock(work) {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return await navigator.locks.request('madad-session-refresh', work);
    }
    return work();
  },
});

export function isAuthenticationFailure(error: unknown): boolean {
  return axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0);
}
