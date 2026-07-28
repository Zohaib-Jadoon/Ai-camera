'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Shield, Eye, EyeOff, ArrowRight, Lock, Mail, User, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuthRegister } from '@/hooks/use-api';
import { useRouter } from 'next/navigation';
import BackgroundParticles from '@/components/BackgroundParticles';

export default function Register() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const registerMutation = useAuthRegister();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await registerMutation.mutateAsync({ name, email, password });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
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
          <h2 className="text-2xl font-bold tracking-tight text-slate-100 font-mono-data lowercase">register</h2>
          <p className="text-xs text-slate-500 mt-1 font-mono-data">join the network as a security operator</p>
        </div>

        <div className="p-8 rounded-2xl glass flex flex-col gap-5 w-full">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl px-4 py-3">
              <Shield className="w-4 h-4 shrink-0" />
              Operator account created. Redirecting to login...
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 font-mono-data">full name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-[#03050a]/40 border border-white/[0.04] focus:border-[#7eb8f7]/30 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none transition-colors"
                />
              </div>
            </div>

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
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 font-mono-data">password</label>
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
              disabled={registerMutation.isPending}
              className="mt-2 w-full py-3 rounded-lg bg-[#7eb8f7] hover:bg-[#4a9fe0] disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-[#03050a] font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(126,184,247,0.15)]"
            >
              {registerMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>Create Account <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-xs text-center text-slate-500 mt-2">
            Already registered?{' '}
            <Link href="/login" className="text-[#7eb8f7] hover:text-[#4a9fe0] transition-colors">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
