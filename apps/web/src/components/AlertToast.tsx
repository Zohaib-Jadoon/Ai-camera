'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  X, ShieldAlert, UserX, AlertTriangle, UserCheck,
  Car, Zap, ArrowLeftRight, PersonStanding, Swords,
  HardHat, ScanLine, Fingerprint,
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

/** Extract JWT from Zustand persisted auth store */
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
  const socketRef = useRef<Socket | null>(null);

  const dismiss = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  useEffect(() => {
    const token = getToken();

    // Connect once per mount — pass JWT so the gateway accepts the connection
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      auth: token ? { token } : undefined,
    });
    socketRef.current = socket;

    const handleAlert = (payload: AlertPayload) => {
      const toastId = payload.alertId ?? payload.id ?? `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const alertType = payload.event_type ?? payload.alertType ?? payload.object_type ?? 'DETECTION';

      const messageMap: Record<string, string> = {
        // Original alerts
        INTRUSION: `🚨 Intrusion detected${camLabel(payload.camera_id)}`,
        UNKNOWN_FACE: `👤 Unknown face detected${camLabel(payload.camera_id)}`,
        KNOWN_FACE: `✅ ${payload.person_name || 'Known person'} arrived`,
        // Traffic alerts
        CONGESTION_WARNING: `🚗 Traffic congestion warning: ${payload.vehicle_count} vehicles in ${payload.zone_name || 'zone'}`,
        CONGESTION_CRITICAL: `🚗 CRITICAL congestion: ${payload.vehicle_count} vehicles in ${payload.zone_name || 'zone'}`,
        SPEED_VIOLATION: `⚡ Speed violation: ${payload.speed_kmh} km/h${camLabel(payload.camera_id)}`,
        WRONG_WAY: `↩️ Wrong-way detected${payload.line_name ? ` at ${payload.line_name}` : ''}${camLabel(payload.camera_id)}`,
        // Safety alerts
        FALL_DETECTED: `🆘 Fall detected${camLabel(payload.camera_id)} — immediate attention required`,
        FIGHT_DETECTED: `⚠️ Fight/aggression detected${camLabel(payload.camera_id)}`,
        PPE_VIOLATION: `🦺 PPE violation: ${(payload.violations || []).join(', ') || 'non-compliant'}${camLabel(payload.camera_id)}`,
        // Informational
        LICENSE_PLATE: `🔤 Plate detected: ${payload.plate_text}${camLabel(payload.camera_id)}`,
        CROSS_CAMERA_MATCH: `🔗 Person ${payload.global_id} also seen on cam ${payload.matched_camera?.slice(0, 8) || '?'}`,
        DEFAULT: `${(payload.object_type ?? 'Object').toUpperCase()} detected${camLabel(payload.camera_id)}`,
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

      setAlerts((prev) => [toast, ...prev].slice(0, 8));

      // Auto-dismiss: critical stays 10s, others 6s
      const criticalTypes = ['FALL_DETECTED', 'FIGHT_DETECTED', 'INTRUSION', 'CONGESTION_CRITICAL'];
      const ttl = criticalTypes.includes(alertType) ? 10000 : 6000;
      setTimeout(() => dismiss(toastId), ttl);
    };

    const handlePlate = (payload: AlertPayload) => {
      handleAlert({ ...payload, object_type: 'LICENSE_PLATE' });
    };

    const handleReID = (payload: AlertPayload) => {
      handleAlert({ ...payload, object_type: 'CROSS_CAMERA_MATCH' });
    };

    socket.on('alert', handleAlert);
    socket.on('detection', handleAlert);
    socket.on('intrusion', handleAlert);
    socket.on('plate_detected', handlePlate);
    socket.on('reid_match', handleReID);

    return () => {
      socket.off('alert', handleAlert);
      socket.off('detection', handleAlert);
      socket.off('intrusion', handleAlert);
      socket.off('plate_detected', handlePlate);
      socket.off('reid_match', handleReID);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [dismiss]);

  if (alerts.length === 0) return null;

  const iconMap: Record<string, React.ReactNode> = {
    INTRUSION: <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />,
    UNKNOWN_FACE: <UserX className="w-4 h-4 text-amber-400 flex-shrink-0" />,
    KNOWN_FACE: <UserCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />,
    CONGESTION_WARNING: <Car className="w-4 h-4 text-yellow-400 flex-shrink-0" />,
    CONGESTION_CRITICAL: <Car className="w-4 h-4 text-red-400 flex-shrink-0" />,
    SPEED_VIOLATION: <Zap className="w-4 h-4 text-orange-400 flex-shrink-0" />,
    WRONG_WAY: <ArrowLeftRight className="w-4 h-4 text-red-400 flex-shrink-0" />,
    FALL_DETECTED: <PersonStanding className="w-4 h-4 text-red-400 flex-shrink-0" />,
    FIGHT_DETECTED: <Swords className="w-4 h-4 text-red-400 flex-shrink-0" />,
    PPE_VIOLATION: <HardHat className="w-4 h-4 text-amber-400 flex-shrink-0" />,
    LICENSE_PLATE: <ScanLine className="w-4 h-4 text-blue-400 flex-shrink-0" />,
    CROSS_CAMERA_MATCH: <Fingerprint className="w-4 h-4 text-purple-400 flex-shrink-0" />,
    DEFAULT: <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />,
  };

  const colorMap: Record<string, string> = {
    INTRUSION: 'border-red-500/40 bg-red-950/50',
    UNKNOWN_FACE: 'border-amber-500/40 bg-amber-950/50',
    KNOWN_FACE: 'border-emerald-500/40 bg-emerald-950/50',
    CONGESTION_WARNING: 'border-yellow-500/40 bg-yellow-950/50',
    CONGESTION_CRITICAL: 'border-red-500/40 bg-red-950/50',
    SPEED_VIOLATION: 'border-orange-500/40 bg-orange-950/50',
    WRONG_WAY: 'border-red-500/40 bg-red-950/50',
    FALL_DETECTED: 'border-red-500/40 bg-red-950/60',
    FIGHT_DETECTED: 'border-red-500/40 bg-red-950/60',
    PPE_VIOLATION: 'border-amber-500/40 bg-amber-950/50',
    LICENSE_PLATE: 'border-blue-500/40 bg-blue-950/50',
    CROSS_CAMERA_MATCH: 'border-purple-500/40 bg-purple-950/50',
    DEFAULT: 'border-orange-500/40 bg-orange-950/50',
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 space-y-2 pointer-events-none">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`glass-card border ${colorMap[alert.type] ?? colorMap.DEFAULT} text-white p-4 rounded-lg shadow-lg pointer-events-auto animate-in slide-in-from-right-5 duration-300`}
        >
          <div className="flex items-start gap-2">
            {iconMap[alert.type] ?? iconMap.DEFAULT}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-white truncate">{alert.message}</p>
              <p className="text-xs text-slate-400 mt-0.5">{alert.time}</p>
            </div>
            <button
              onClick={() => dismiss(alert.id)}
              className="text-slate-500 hover:text-slate-300 transition-colors ml-1 flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
