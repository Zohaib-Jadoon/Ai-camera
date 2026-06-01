'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useSettings } from '@/hooks/use-api';

function playAlertTone() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Ignore audio errors
  }
}

interface AlertItem {
  id: string;
  sent_at: string;
  severity?: string;
  status: string;
}

// Module-level mute state shared between component and toggle
let _muted = false;
const _listeners = new Set<(muted: boolean) => void>();

function setMuted(muted: boolean) {
  _muted = muted;
  _listeners.forEach((cb) => cb(muted));
}

function useMuted() {
  const [muted, setLocalMuted] = useState(_muted);
  useEffect(() => {
    const cb = (m: boolean) => setLocalMuted(m);
    _listeners.add(cb);
    return () => { _listeners.delete(cb); };
  }, []);
  return [muted, setMuted] as const;
}

export default function AlertSound() {
  const { data: settings } = useSettings();
  const [muted] = useMuted();
  const lastTimestampRef = useRef<string | null>(null);

  const soundEnabled = settings?.alertSoundEnabled ?? settings?.soundAlerts ?? true;

  useEffect(() => {
    const checkAlerts = async () => {
      if (muted || !soundEnabled) return;
      try {
        const { data } = await api.get<AlertItem[]>('/alerts', {
          params: { status: 'PENDING', severity: 'CRITICAL,HIGH', limit: 1 },
        });
        if (data && data.length > 0) {
          const alert = data[0];
          const currentTs = new Date(alert.sent_at).getTime();
          if (lastTimestampRef.current) {
            const lastTs = new Date(lastTimestampRef.current).getTime();
            if (currentTs > lastTs) {
              playAlertTone();
            }
          }
          lastTimestampRef.current = alert.sent_at;
        }
      } catch {
        // Ignore polling errors
      }
    };

    checkAlerts();
    const interval = setInterval(checkAlerts, 10000);
    return () => clearInterval(interval);
  }, [muted, soundEnabled]);

  return null;
}

export function AlertSoundToggle() {
  const [muted, toggle] = useMuted();

  return (
    <button
      onClick={() => toggle(!muted)}
      className="p-2 rounded-lg hover:bg-slate-800/60 text-slate-400 hover:text-white transition-colors"
      title={muted ? 'Unmute alert sound' : 'Mute alert sound'}
    >
      {muted ? (
        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        </svg>
      ) : (
        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
      )}
    </button>
  );
}
