'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, Lock, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { useResetPassword } from '@/hooks/use-api';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const resetPassword = useResetPassword();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (!token) {
      setError('Invalid or expired reset link.');
      return;
    }
    try {
      await resetPassword.mutateAsync({ token, password });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    }
  };

  if (!token) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-red-400 mb-4">Invalid or expired reset link.</p>
        <Link href="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300">
          Request a new link
        </Link>
      </div>
    );
  }

  return submitted ? (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
      <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
      <h2 className="text-lg font-semibold text-white mb-2">Password updated</h2>
      <p className="text-sm text-slate-400 mb-6">Your password has been reset successfully.</p>
      <Link href="/login" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to login
      </Link>
    </motion.div>
  ) : (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-slate-400">Enter your new password below.</p>
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400">{error}</div>
      )}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">New Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-slate-900/60 border border-slate-800 rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Confirm Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-slate-900/60 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={resetPassword.isPending}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {resetPassword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset Password'}
      </button>
      <div className="text-center">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to login
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] relative overflow-hidden px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(59,130,246,0.08),_transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(139,92,246,0.06),_transparent_50%)]" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="glass-card rounded-2xl border border-slate-800/60 p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">New Password</h1>
              <p className="text-xs text-slate-500">Madad Vision AI</p>
            </div>
          </div>
          <Suspense fallback={<div className="text-center py-8 text-slate-500 text-sm">Loading...</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </motion.div>
    </div>
  );
}
