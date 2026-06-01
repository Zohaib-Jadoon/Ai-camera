'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'ADMIN' | 'SECURITY_OPERATOR' | 'VIEWER';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  setAuth: (user: AuthUser, token: string, refreshToken?: string) => void;
  logout: () => void;
  // Role helpers
  isAdmin: () => boolean;
  isOperator: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,

      setAuth: (user, token, refreshToken) => {
        set({ user, token, refreshToken: refreshToken ?? null });
        // Set cookie so the Next.js middleware allows access to dashboard routes
        if (typeof document !== 'undefined') {
          document.cookie = `auth-token=${token}; path=/; max-age=86400; SameSite=Lax`;
        }
      },

      logout: () => {
        set({ user: null, token: null, refreshToken: null });
        if (typeof document !== 'undefined') {
          document.cookie = 'auth-token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }
      },

      isAdmin: () => get().user?.role === 'ADMIN',
      isOperator: () =>
        get().user?.role === 'ADMIN' || get().user?.role === 'SECURITY_OPERATOR',
    }),
    { name: 'auth-storage' }
  )
);
