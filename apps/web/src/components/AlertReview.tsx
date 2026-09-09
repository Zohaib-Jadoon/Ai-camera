'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

export default function AlertReview({ id, status = 'PENDING' }: { id: string; status?: string }) {
  const [note, setNote] = useState('');
  const user = useAuthStore(s => s.user);
  const queries = useQueryClient();
  const review = useMutation({
    mutationFn: (verdict: 'CONFIRMED' | 'DISMISSED') => api.post(`/alerts/${id}/review`, { verdict, note }),
    onSuccess: () => queries.invalidateQueries({ queryKey: ['alerts'] }),
  });
  if (status !== 'PENDING') return <p className="text-xs text-slate-400">Human review: {status.toLowerCase()}</p>;
  if (!user || !['ADMIN', 'SECURITY_OPERATOR'].includes(user.role)) return <p className="text-xs text-amber-400">Awaiting operator review</p>;
  return <div className="mt-3 space-y-2 border-t border-slate-700 pt-3">
    <p className="text-xs text-amber-300">AI suggestion—not a verified incident. Review footage before confirming.</p>
    <label className="block text-xs text-slate-300">Review explanation
      <input value={note} onChange={e => setNote(e.target.value)} maxLength={1000}
        className="mt-1 block w-full rounded border border-slate-600 bg-slate-900 p-2" />
    </label>
    <div className="flex gap-3 text-xs">
      <button disabled={review.isPending || note.trim().length < 3} onClick={() => review.mutate('CONFIRMED')} className="rounded bg-emerald-800 px-3 py-2 disabled:opacity-40">Confirm incident</button>
      <button disabled={review.isPending || note.trim().length < 3} onClick={() => review.mutate('DISMISSED')} className="rounded bg-slate-700 px-3 py-2 disabled:opacity-40">Mark false alarm</button>
    </div>
    {review.isError && <p role="alert" className="text-xs text-red-400">Review could not be saved. Refresh to check whether another operator reviewed it.</p>}
  </div>;
}
