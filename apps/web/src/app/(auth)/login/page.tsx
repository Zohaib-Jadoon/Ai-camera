'use client';

import Link from 'next/link';
import { useState, Suspense } from 'react';
import { Shield, Eye, EyeOff, ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuthLogin } from '@/hooks/use-api';
import { useAuthStore } from '@/store/auth-store';
import { useRouter, useSearchParams } from 'next/navigation';

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
    // Redirect to backend Google OAuth route — backend handles the rest
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`;
  };

  return (
    <div className="relative z-10 w-full max-w-sm mx-4">
      {sessionExpired && (
        <div className="mb-4 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Your session has expired or your permissions changed. Please log in again.
        </div>
      )}
      <div className="flex flex-col items-center mb-8">
        <Link href="/" className="relative mb-4 group block">
          <div className="w-14 h-14 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center group-hover:bg-blue-600/30 transition-colors">
            <Shield className="w-7 h-7 text-blue-400" />
          </div>
          <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-md" />
        </Link>
        <h1 className="text-2xl font-bold text-white tracking-tight">Madad Vision AI</h1>
        <p className="text-sm text-slate-500 mt-1">Enterprise Surveillance Platform</p>
      </div>

      <div className="glass-card rounded-2xl border border-slate-800/80 p-8">
        <h2 className="text-lg font-semibold text-white mb-1">Sign in to your account</h2>
        <p className="text-xs text-slate-500 mb-6">Secure access to your surveillance dashboard</p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Email address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@example.com"
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/70 focus:bg-slate-900 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/70 focus:bg-slate-900 transition-all"
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

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" className="w-3.5 h-3.5 accent-blue-500" />
              Remember me
            </label>
            <Link href="/forgot-password" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white font-semibold py-2.5 rounded-lg text-sm transition-all duration-200 mt-2"
          >
            {loginMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>Sign In <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>

        {/* Google OAuth divider */}
        <div className="mt-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-800" />
          <span className="text-[10px] text-slate-600 uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>

        <button
          onClick={handleGoogleLogin}
          className="mt-3 w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-slate-700/60 text-white py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="mt-6 pt-5 border-t border-slate-800/60 text-center">
          <p className="text-xs text-slate-500">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Request access
            </Link>
          </p>
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-700 mt-6">
        Protected by enterprise-grade security · v1.0.0
      </p>
    </div>
  );
}


export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#020817] flex items-center justify-center relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-purple-600/8 rounded-full blur-3xl" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.02]" />

      <Suspense fallback={<div className="text-slate-500 text-sm">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
