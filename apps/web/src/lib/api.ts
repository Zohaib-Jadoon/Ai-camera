import axios, { type InternalAxiosRequestConfig } from 'axios';
import { expireSession, isAuthenticationFailure, readSession, refreshSession, SessionChangedError } from './session';

type SessionRequest = InternalAxiosRequestConfig & { _retried?: boolean; _sessionUserId?: string; _sessionToken?: string };

// Backend global prefix is /api — all REST routes sit under it.
const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api';

export const api = axios.create({
  baseURL: BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

// ─── Request interceptor: attach JWT ────────────────────────────────────────
api.interceptors.request.use((config: SessionRequest) => {
  if (typeof window === 'undefined') return config;

  const session = readSession();
  if (config._retried && (!session || session.user.id !== config._sessionUserId)) {
    throw new SessionChangedError();
  }
  if (session) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
    config._sessionUserId = session.user.id;
    config._sessionToken = session.accessToken;
  }
  return config;
});

// ─── Response interceptor: handle 401 / 403 globally ────────────────────────

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;
    const config = err.config as SessionRequest | undefined;
    // Public authentication failures stay on their form; permission denials do not log users out.
    if (status !== 401 || !config?._sessionToken || !config._sessionUserId || config.url?.startsWith('/auth/')) {
      return Promise.reject(err);
    }
    if (config._retried) {
      expireSession(config._sessionToken);
      return Promise.reject(err);
    }
    const previousToken = config._sessionToken;
    const current = readSession();
    if (!current?.refreshToken) {
      expireSession(previousToken);
      return Promise.reject(err);
    }
    try {
      const session = await refreshSession(previousToken, config._sessionUserId);
      config._retried = true;
      config.headers.Authorization = `Bearer ${session.accessToken}`;
      return api.request(config);
    } catch (refreshError) {
      if (isAuthenticationFailure(refreshError)) expireSession(previousToken);
      return Promise.reject(refreshError);
    }
  },
);
