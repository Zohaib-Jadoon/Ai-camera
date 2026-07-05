'use client';

import Link from 'next/link';
import { useState, Suspense } from 'react';
import { Shield, Eye, EyeOff, ArrowRight, Lock, Mail, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuthLogin } from '@/hooks/use-api';
import { useAuthStore } from '@/store/auth-store';
import { useRouter, useSearchParams } from 'next/navigation';
import BackgroundParticles from '@/components/BackgroundParticles';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get('reason') === 'session_expired';
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = useAuthLogin();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await loginMutation.mutateAsync({ email, password });
      setAuth(res.user as any, res.access_token, (res as any).refresh_token);
      const next = searchParams.get('next');
      const destination = next && next.startsWith('/') ? next : '/dashboard';
      router.replace(destination);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials');
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`;
  };

  return (
    <div className="relative z-10 w-full max-w-md mx-4">
      {sessionExpired && (
        <div className="mb-4 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Your session has expired or your permissions changed. Please log in again.
        </div>
      )}
      
      <div className="flex flex-col items-center mb-8">
        <Link href="/" className="relative mb-4 group block">
          <div className="w-14 h-14 bg-[#7eb8f7]/5 border border-[#7eb8f7]/20 hover:border-[#7eb8f7]/40 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-[0_0_20px_rgba(126,184,247,0.1)] group-hover:scale-105">
            <Shield className="w-7 h-7 text-[#7eb8f7]" />
          </div>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-slate-100 font-mono-data lowercase">sign in</h2>
        <p className="text-xs text-slate-500 mt-1 font-mono-data">access your security control room</p>
      </div>

      <div className="p-8 rounded-2xl glass flex flex-col gap-5 w-full">
        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 font-mono-data">email address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@company.com"
                className="w-full bg-[#03050a]/40 border border-white/[0.04] focus:border-[#7eb8f7]/30 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none transition-colors font-mono-data"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono-data">password</label>
              <Link href="/forgot-password" className="text-xs text-[#7eb8f7] hover:text-[#4a9fe0] transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#03050a]/40 border border-white/[0.04] focus:border-[#7eb8f7]/30 rounded-lg pl-10 pr-10 py-2.5 text-sm text-slate-200 focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="mt-2 w-full py-3 rounded-lg bg-[#7eb8f7] hover:bg-[#4a9fe0] disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-[#03050a] font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(126,184,247,0.15)]"
          >
            {loginMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>Sign In <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>

        <div className="relative my-2 flex items-center">
          <div className="flex-grow border-t border-white/[0.04]" />
          <span className="flex-shrink mx-4 text-[10px] text-slate-600 uppercase tracking-widest font-mono-data">or</span>
          <div className="flex-grow border-t border-white/[0.04]" />
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 text-sm font-semibold flex items-center justify-center gap-2 transition-all"
        >
          Sign in with Google
        </button>

        <p className="text-xs text-center text-slate-500 mt-2">
          New operator?{' '}
          <Link href="/register" className="text-[#7eb8f7] hover:text-[#4a9fe0] transition-colors">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen bg-[#03050a] flex items-center justify-center">
      <BackgroundParticles />
      <Suspense fallback={
        <div className="text-slate-500 font-mono-data text-xs animate-pulse">loading form components...</div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
