'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Shield, ArrowLeft, Mail, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAuthForgotPassword } from '@/hooks/use-api';
import BackgroundParticles from '@/components/BackgroundParticles';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const forgotMutation = useAuthForgotPassword();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await forgotMutation.mutateAsync({ email });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Password reset request failed');
    }
  };

  return (
    <div className="relative min-h-screen bg-[#03050a] flex items-center justify-center">
      <BackgroundParticles />

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="relative mb-4 group block">
            <div className="w-14 h-14 bg-[#7eb8f7]/5 border border-[#7eb8f7]/20 hover:border-[#7eb8f7]/40 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-[0_0_20px_rgba(126,184,247,0.1)] group-hover:scale-105">
              <Shield className="w-7 h-7 text-[#7eb8f7]" />
            </div>
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100 font-mono-data lowercase">forgot password</h2>
          <p className="text-xs text-slate-500 mt-1 font-mono-data">recover your operator access credentials</p>
        </div>

        <div className="p-8 rounded-2xl glass flex flex-col gap-5 w-full">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {success ? (
            <div className="flex flex-col gap-4 text-center items-center py-4">
              <div className="p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold font-mono-data lowercase">check your email</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                We've sent a password reset link to <strong className="text-slate-300 font-mono-data">{email}</strong> if it is registered in our network.
              </p>
              <Link href="/login" className="mt-2 text-xs text-[#7eb8f7] hover:underline font-mono-data">
                Return to Login
              </Link>
            </div>
          ) : (
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

              <button
                type="submit"
                disabled={forgotMutation.isPending}
                className="mt-2 w-full py-3 rounded-lg bg-[#7eb8f7] hover:bg-[#4a9fe0] disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-[#03050a] font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(126,184,247,0.15)]"
              >
                {forgotMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>Send Reset Link</>
                )}
              </button>

              <Link
                href="/login"
                className="mt-2 text-xs text-slate-500 hover:text-slate-300 flex items-center justify-center gap-2 transition-colors font-mono-data"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> return to login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
