'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  X, ShieldAlert, UserX, AlertTriangle, UserCheck,
  Car, Zap, ArrowLeftRight, PersonStanding, Swords,
  HardHat, ScanLine, Fingerprint, Siren,
} from 'lucide-react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

interface AlertPayload {
  id?: string;
  alertId?: string;
  alertType?: string;
  camera_id?: string;
  object_type?: string;
  event_type?: string;
  timestamp?: string;
  person_name?: string;
  speed_kmh?: number;
  vehicle_count?: number;
  zone_name?: string;
  plate_text?: string;
  violations?: string[];
  global_id?: string;
  matched_camera?: string;
  level?: string;
  line_name?: string;
}

interface ToastAlert {
  id: string;
  type: string;
  message: string;
  cameraId?: string;
  time: string;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

function camLabel(id?: string) {
  return id ? ` on cam ${id.slice(0, 8)}` : '';
}

export default function AlertToast() {
  const [alerts, setAlerts] = useState<ToastAlert[]>([]);
  const [isBlinking, setIsBlinking] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const dismiss = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  useEffect(() => {
    const token = getToken();

    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      auth: token ? { token } : undefined,
    });
    socketRef.current = socket;

    const handleAlert = (payload: AlertPayload) => {
      const toastId = payload.alertId ?? payload.id ?? `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const alertType = payload.event_type ?? payload.alertType ?? payload.object_type ?? 'ALERT';

      const messageMap: Record<string, string> = {
        INTRUSION: `🚨 Intrusion breach detected${camLabel(payload.camera_id)}`,
        UNKNOWN_FACE: `👤 Unregistered face detected${camLabel(payload.camera_id)}`,
        KNOWN_FACE: `✅ ${payload.person_name || 'Known person'} identified`,
        CONGESTION_WARNING: `🚗 Traffic queue warning: ${payload.vehicle_count} vehicles`,
        CONGESTION_CRITICAL: `🚗 CRITICAL Congestion: ${payload.vehicle_count} vehicles stopped`,
        SPEED_VIOLATION: `⚡ Speed violation: ${payload.speed_kmh} km/h${camLabel(payload.camera_id)}`,
        WRONG_WAY: `↩️ Wrong-way violation${payload.line_name ? ` at ${payload.line_name}` : ''}${camLabel(payload.camera_id)}`,
        FALL_DETECTED: `🆘 Emergency: Person fall detected${camLabel(payload.camera_id)}`,
        FIGHT_DETECTED: `👊 Hostility / Violence detected${camLabel(payload.camera_id)}`,
        PPE_VIOLATION: `🦺 PPE Non-compliance: ${(payload.violations || []).join(', ') || 'Violation'}${camLabel(payload.camera_id)}`,
        WEAPON_DETECTED: `⚔️ CRITICAL: Weapon detected${camLabel(payload.camera_id)} — IMMEDIATE ACTION`,
        ACCIDENT_DETECTED: `💥 Vehicle collision / Accident detected${camLabel(payload.camera_id)}`,
        BREAKIN_DETECTED: `🚨 Perimeter breach / Break-in detected${camLabel(payload.camera_id)}`,
        BEHAVIOR_DETECTED: `⚠️ Suspicious loitering detected${camLabel(payload.camera_id)}`,
        LICENSE_PLATE: `🔤 Plate scanned: ${payload.plate_text}${camLabel(payload.camera_id)}`,
        CROSS_CAMERA_MATCH: `🔗 ReID Match: Person seen on cam ${payload.matched_camera?.slice(0, 8) || '?'}`,
        DEFAULT: `Alert triggered [${alertType}]${camLabel(payload.camera_id)}`,
      };

      const toast: ToastAlert = {
        id: toastId,
        type: alertType,
        message: messageMap[alertType] ?? messageMap.DEFAULT,
        cameraId: payload.camera_id,
        time: payload.timestamp
          ? new Date(payload.timestamp).toLocaleTimeString()
          : new Date().toLocaleTimeString(),
      };

      setAlerts((prev) => {
        if (prev.some((a) => a.id === toastId)) return prev;
        return [toast, ...prev].slice(0, 6);
      });

      const criticalTypes = [
        'INTRUSION',
        'FALL_DETECTED',
        'FIGHT_DETECTED',
        'WEAPON_DETECTED',
        'ACCIDENT_DETECTED',
        'BREAKIN_DETECTED',
        'CONGESTION_CRITICAL'
      ];
      if (criticalTypes.includes(alertType)) {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 3500);
      }

      const ttl = criticalTypes.includes(alertType) ? 10000 : 6000;
      setTimeout(() => dismiss(toastId), ttl);
    };

    const handlePlate = (payload: AlertPayload) => {
      handleAlert({ ...payload, event_type: 'LICENSE_PLATE' });
    };

    const handleReID = (payload: AlertPayload) => {
      handleAlert({ ...payload, event_type: 'CROSS_CAMERA_MATCH' });
    };

    socket.on('alert', handleAlert);
    socket.on('intrusion', handleAlert);
    socket.on('plate_detected', handlePlate);
    socket.on('reid_match', handleReID);

    return () => {
      socket.off('alert', handleAlert);
      socket.off('intrusion', handleAlert);
      socket.off('plate_detected', handlePlate);
      socket.off('reid_match', handleReID);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [dismiss]);

  const iconMap: Record<string, React.ReactNode> = {
    INTRUSION: <Siren className="w-5 h-5 text-red-400 flex-shrink-0 animate-bounce" />,
    UNKNOWN_FACE: <UserX className="w-5 h-5 text-amber-400 flex-shrink-0" />,
    KNOWN_FACE: <UserCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />,
    CONGESTION_WARNING: <Car className="w-5 h-5 text-amber-400 flex-shrink-0" />,
    CONGESTION_CRITICAL: <Car className="w-5 h-5 text-red-400 flex-shrink-0 animate-pulse" />,
    SPEED_VIOLATION: <Zap className="w-5 h-5 text-sky-400 flex-shrink-0" />,
    WRONG_WAY: <ArrowLeftRight className="w-5 h-5 text-red-400 flex-shrink-0" />,
    FALL_DETECTED: <PersonStanding className="w-5 h-5 text-red-400 flex-shrink-0 animate-bounce" />,
    FIGHT_DETECTED: <Swords className="w-5 h-5 text-red-400 flex-shrink-0 animate-pulse" />,
    PPE_VIOLATION: <HardHat className="w-5 h-5 text-amber-400 flex-shrink-0" />,
    WEAPON_DETECTED: <Siren className="w-5 h-5 text-red-500 flex-shrink-0 animate-ping" />,
    ACCIDENT_DETECTED: <Car className="w-5 h-5 text-red-400 flex-shrink-0 animate-pulse" />,
    BREAKIN_DETECTED: <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />,
    BEHAVIOR_DETECTED: <UserX className="w-5 h-5 text-amber-400 flex-shrink-0" />,
    LICENSE_PLATE: <ScanLine className="w-5 h-5 text-sky-400 flex-shrink-0" />,
    CROSS_CAMERA_MATCH: <Fingerprint className="w-5 h-5 text-purple-400 flex-shrink-0" />,
    DEFAULT: <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />,
  };

  const colorMap: Record<string, string> = {
    INTRUSION: 'border-red-500/50 bg-red-950/80 shadow-[0_0_20px_rgba(239,68,68,0.3)]',
    WEAPON_DETECTED: 'border-red-500 bg-red-950/90 shadow-[0_0_30px_rgba(239,68,68,0.5)] border-2',
    ACCIDENT_DETECTED: 'border-red-500/60 bg-red-950/80 shadow-[0_0_20px_rgba(239,68,68,0.3)]',
    FIGHT_DETECTED: 'border-red-500/60 bg-red-950/80 shadow-[0_0_20px_rgba(239,68,68,0.3)]',
    UNKNOWN_FACE: 'border-amber-500/40 bg-amber-950/60',
    KNOWN_FACE: 'border-emerald-500/40 bg-emerald-950/60',
    CONGESTION_CRITICAL: 'border-red-500/50 bg-red-950/70',
    SPEED_VIOLATION: 'border-sky-500/40 bg-sky-950/60',
    LICENSE_PLATE: 'border-sky-500/40 bg-sky-950/60',
    CROSS_CAMERA_MATCH: 'border-purple-500/40 bg-purple-950/60',
    DEFAULT: 'border-slate-700/80 bg-slate-900/90',
  };

  return (
    <>
      {/* Full-screen red alert vignette for critical threat events */}
      {isBlinking && (
        <div
          className="fixed inset-0 pointer-events-none z-[9999] border-[14px] border-red-600 shadow-[inset_0_0_120px_rgba(239,68,68,0.85)] animate-pulse"
          style={{ animationDuration: '0.4s' }}
        />
      )}

      {/* Toast Alert Drawer */}
      <div className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 space-y-3 pointer-events-none">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`glass-panel border ${colorMap[alert.type] ?? colorMap.DEFAULT} text-white p-4 rounded-2xl shadow-2xl pointer-events-auto transition-all duration-300 transform translate-y-0`}
          >
            <div className="flex items-start gap-3">
              {iconMap[alert.type] ?? iconMap.DEFAULT}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs tracking-wide text-white font-mono-data uppercase">{alert.type.replace(/_/g, ' ')}</p>
                <p className="text-xs text-slate-200 mt-0.5 leading-snug">{alert.message}</p>
                <p className="text-[10px] text-slate-400 mt-1 font-mono-data">{alert.time}</p>
              </div>
              <button
                onClick={() => dismiss(alert.id)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

