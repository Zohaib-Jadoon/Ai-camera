'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Shield, Eye, EyeOff, ArrowRight, Lock, Mail, User, Building } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthRegister } from '@/hooks/use-api';
import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const registerMutation = useAuthRegister();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await registerMutation.mutateAsync({ name, email, password });
      setAuth(res.user as any, res.access_token, (res as any).refresh_token);
      router.push('/dashboard');

    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen bg-[#020817] flex items-center justify-center relative py-12">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-purple-600/8 rounded-full blur-3xl" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.02]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="relative mb-4 group block">
            <div className="w-14 h-14 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center group-hover:bg-blue-600/30 transition-colors">
              <Shield className="w-7 h-7 text-blue-400" />
            </div>
            <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-md" />
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight">Request Access</h1>
          <p className="text-sm text-slate-500 mt-1">Register your organization for Madad Vision AI</p>
        </div>

        <div className="glass-card rounded-2xl border border-slate-800/80 p-8">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="John Doe"
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/70 focus:bg-slate-900 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@company.com"
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

            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white font-semibold py-2.5 rounded-lg text-sm transition-all duration-200 mt-6"
            >
              {registerMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Submit Request <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/60 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-700 mt-6">
          By registering, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}
