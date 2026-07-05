import axios from 'axios';

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
api.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config;

  try {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      const token: string | undefined = parsed?.state?.token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch {
    // Ignore parse errors — stale or corrupted storage
  }
  return config;
});

// ─── Response interceptor: handle 401 / 403 globally ────────────────────────
let redirecting = false; // Prevent redirect storm

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    // 401 = expired/invalid token  |  403 = token valid but role too low
    // In both cases clear stale auth and force a fresh login so the user
    // gets a token that reflects their current DB role.
    if ((status === 401 || status === 403) && typeof window !== 'undefined' && !redirecting) {
      redirecting = true;
      localStorage.removeItem('auth-storage');
      document.cookie = 'auth-token=; path=/; max-age=0';
      window.location.href = '/login?reason=session_expired';
    }
    return Promise.reject(err);
  },
);
