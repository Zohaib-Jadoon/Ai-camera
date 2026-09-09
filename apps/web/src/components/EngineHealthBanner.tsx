'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

interface EngineHealth {
  status: 'OFFLINE' | 'UNKNOWN' | 'READY' | 'DEGRADED';
  engines: { id: string; objectDetection: string; faceRecognition: string; stale: boolean }[];
}

export default function EngineHealthBanner() {
  const { data, isError } = useQuery({
    queryKey: ['engine-health'],
    queryFn: async () => (await api.get<EngineHealth>('/system/ai-status')).data,
    refetchInterval: 15000,
  });
  const status = isError ? 'UNKNOWN' : data?.status ?? 'UNKNOWN';
  const ready = status === 'READY';
  const descriptions = {
    READY: 'Detection and face models report loaded. Camera video availability is shown separately.',
    OFFLINE: 'No AI engine is connected. Automated detection is unavailable.',
    UNKNOWN: 'AI readiness has not been confirmed. Do not assume automated detection is active.',
    DEGRADED: 'One or more AI models are unavailable or reported an inference error.',
  };
  const Icon = ready ? Activity : AlertTriangle;
  return (
    <div role="status" aria-live="polite" className={`rounded-xl border p-4 flex items-start gap-3 ${ready ? 'border-emerald-800 bg-emerald-950/30 text-emerald-100' : 'border-amber-800 bg-amber-950/30 text-amber-100'}`}>
      <Icon className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold">AI {status.toLowerCase()}</p>
        <p className="text-xs mt-1 opacity-90">{descriptions[status]}</p>
        {status === 'DEGRADED' && data?.engines.map((engine, index) => (
          <p key={engine.id} className="text-xs mt-2">Engine {index + 1}: objects {engine.objectDetection.toLowerCase()}, faces {engine.faceRecognition.toLowerCase()}</p>
        ))}
      </div>
    </div>
  );
}
