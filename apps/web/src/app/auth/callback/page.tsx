'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { Shield } from 'lucide-react';

/**
 * /auth/callback
 *
 * The backend redirects here after a successful Google OAuth flow with:
 *   ?access_token=...&refresh_token=...&user=<JSON>
 *
 * This page reads those params, stores them in Zustand + cookie,
 * then redirects to /dashboard.
 */
function OAuthCallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    const userRaw = params.get('user');

    if (!access_token || !userRaw) {
      router.replace('/login?reason=oauth_failed');
      return;
    }

    try {
      const user = JSON.parse(userRaw);
      setAuth(user, access_token, refresh_token ?? undefined);
      router.replace('/dashboard');
    } catch {
      router.replace('/login?reason=oauth_failed');
    }
  }, [params, router, setAuth]);

  return (
    <div className="min-h-screen bg-[#020817] flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center">
        <Shield className="w-7 h-7 text-blue-400" />
      </div>
      <p className="text-slate-400 text-sm animate-pulse">Completing sign-in…</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#020817] flex items-center justify-center">
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      }
    >
      <OAuthCallbackHandler />
    </Suspense>
  );
}
