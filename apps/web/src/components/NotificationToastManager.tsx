'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  AlertTriangle,
  Bell,
  Eye,
  X,
  UserCheck,
} from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

export type ToastSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface AlertToast {
  id: string;
  title: string;
  message: string;
  severity: ToastSeverity;
  cameraName?: string;
  cameraId?: string;
  objectType?: string;
  timestamp: string;
  confidence?: number;
  autoClose?: boolean;
}

// ── Web Audio API Synthesizer for Graceful Chimes ─────────────────────────────
function playAlertSound(severity: ToastSeverity) {
  if (typeof window === 'undefined') return;
  const isMuted = localStorage.getItem('madad_alert_sound_muted') === 'true';
  if (isMuted) return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (severity === 'CRITICAL') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc2.frequency.setValueAtTime(1174, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime + 0.1);
      osc1.stop(ctx.currentTime + 0.2);
      osc2.stop(ctx.currentTime + 0.5);
    } else if (severity === 'HIGH') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, ctx.currentTime);

      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {
    // Ignore audio context autoplay restrictions gracefully
  }
}

export default function NotificationToastManager() {
  const router = useRouter();
  const [toasts, setToasts] = useState<AlertToast[]>([]);
  const lastAlertTimes = useRef<Record<string, number>>({});
  const qc = useQueryClient();

  const addToast = useCallback((toast: Omit<AlertToast, 'id' | 'timestamp'>) => {
    // Deduplication check — 15s standard, 60s for unknown faces to prevent toast spamming
    const key = `${toast.cameraId || 'global'}-${toast.objectType || toast.title}`;
    const now = Date.now();
    const cooldownMs = (toast.objectType?.includes('UNKNOWN_FACE')) ? 60000 : 15000;
    if (lastAlertTimes.current[key] && now - lastAlertTimes.current[key] < cooldownMs) {
      return; // Skip duplicate toast during cooldown
    }
    lastAlertTimes.current[key] = now;

    const id = `toast-${now}-${Math.random().toString(36).slice(2, 7)}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newToast: AlertToast = { ...toast, id, timestamp };

    setToasts((prev) => {
      const filtered = prev.slice(-2); // Max 3 toasts at once
      return [...filtered, newToast];
    });

    playAlertSound(newToast.severity);

    // Auto dismiss non-critical toasts after 6 seconds
    if (newToast.severity !== 'CRITICAL') {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6000);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleAcknowledge = useCallback(async (id: string) => {
    removeToast(id);
    qc.invalidateQueries({ queryKey: ['alerts'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }, [removeToast, qc]);

  // Listen to WebSocket detection alert streams
  useEffect(() => {
    const socket = getSocket();

    const onAlert = (payload: any) => {
      const objType = (payload.object_type || payload.alert_type || '').toUpperCase();

      // Filter out generic routine object detections (person, car, truck) from triggering floating popups.
      // Floating popups are reserved ONLY for genuine alerts & face recognition matches.
      const isRoutine = ['PERSON', 'CAR', 'TRUCK', 'BUS', 'MOTORCYCLE', 'BICYCLE', 'DOG', 'CAT'].includes(objType)
        && !payload.alert_type?.includes('INTRUSION')
        && !payload.alert_type?.includes('WEAPON');

      if (isRoutine) {
        // Just refresh query cache for background lists
        qc.invalidateQueries({ queryKey: ['alerts'] });
        return;
      }

      let severity: ToastSeverity = 'MEDIUM';
      let title = 'Security Alert';
      let msg = `Triggered on camera ${payload.camera_id?.slice(0, 8) || 'System'}`;

      if (objType.includes('INTRUSION') || objType.includes('WEAPON') || objType.includes('KNIFE') || objType.includes('GUN') || objType.includes('FIRE') || objType.includes('FIGHT') || objType.includes('FALL')) {
        severity = 'CRITICAL';
        title = `CRITICAL: ${objType.replace(/_/g, ' ')}`;
        msg = `Unpermitted security breach detected`;
      } else if (objType.includes('PPE') || objType.includes('SPEED') || objType.includes('WRONG_WAY')) {
        severity = 'HIGH';
        title = `WARNING: ${objType.replace(/_/g, ' ')}`;
        msg = `Safety rule violation detected`;
      } else if (objType.includes('UNKNOWN_FACE')) {
        severity = 'LOW';
        title = `Visitor Detected`;
        msg = `Unenrolled face on camera ${payload.camera_id?.slice(0, 8) || 'feed'}`;
      } else if (objType.includes('KNOWN_FACE')) {
        severity = 'LOW';
        title = `Person Identified: ${payload.person_name || 'Registered Subject'}`;
        msg = `Face recognition match confirmed (${Math.round((payload.confidence || 0.95) * 100)}%)`;
      } else {
        title = `${objType.replace(/_/g, ' ')} Alert`;
        msg = `Security rule trigger active`;
      }

      addToast({
        title,
        message: msg,
        severity,
        cameraId: payload.camera_id,
        objectType: objType,
        confidence: payload.confidence,
      });

      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    };

    const onPersonAlert = (payload: any) => {
      addToast({
        title: `Recognized: ${payload.person_name || 'Registered Subject'}`,
        message: payload.message || `Subject detected on camera feed`,
        severity: 'LOW',
        cameraId: payload.camera_id,
        objectType: 'KNOWN_FACE',
        confidence: payload.confidence,
      });
    };

    socket.on('alert', onAlert);
    socket.on('person_alert', onPersonAlert);

    return () => {
      socket.off('alert', onAlert);
      socket.off('person_alert', onPersonAlert);
    };
  }, [addToast, qc]);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col-reverse gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const isCritical = toast.severity === 'CRITICAL';
          const isHigh = toast.severity === 'HIGH';
          const isLow = toast.severity === 'LOW';

          const cardBorder = isCritical
            ? 'border-red-500/80 shadow-[0_0_25px_rgba(239,68,68,0.4)] bg-slate-950/95'
            : isHigh
            ? 'border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.3)] bg-slate-950/95'
            : isLow
            ? 'border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.2)] bg-slate-950/95'
            : 'border-blue-500/60 shadow-[0_0_15px_rgba(59,130,246,0.2)] bg-slate-950/95';

          const badgeBg = isCritical
            ? 'bg-red-500/20 text-red-400 border-red-500/40'
            : isHigh
            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
            : isLow
            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            : 'bg-blue-500/20 text-blue-400 border-blue-500/40';

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className={`pointer-events-auto rounded-2xl border p-4 backdrop-blur-xl shadow-2xl transition-all duration-200 ${cardBorder}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {isCritical ? (
                    <div className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                  ) : isHigh ? (
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  ) : isLow ? (
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <UserCheck className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      <Bell className="w-5 h-5" />
                    </div>
                  )}

                  <div className="flex flex-col">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border w-fit ${badgeBg}`}>
                      {toast.severity} ALERT
                    </span>
                    <h4 className="text-xs font-black text-white mt-1 leading-tight">{toast.title}</h4>
                  </div>
                </div>

                <button
                  onClick={() => removeToast(toast.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-slate-300 font-medium mt-2 leading-relaxed">{toast.message}</p>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-400 font-mono text-[10px]">{toast.timestamp}</span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      removeToast(toast.id);
                      router.push('/live');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 border border-blue-500/40 text-blue-300 hover:text-white font-bold text-[10px] transition-all"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Watch Feed</span>
                  </button>
                  <button
                    onClick={() => handleAcknowledge(toast.id)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] transition-colors"
                  >
                    Ack
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
