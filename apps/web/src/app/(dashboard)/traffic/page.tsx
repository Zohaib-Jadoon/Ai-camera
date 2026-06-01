'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Car, Zap, ArrowLeftRight, TrendingUp, TrendingDown,
  Minus, AlertTriangle, Gauge, Timer, MapPin,
} from 'lucide-react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    return JSON.parse(raw)?.state?.token ?? null;
  } catch { return null; }
}

interface TrafficEvent {
  id: string;
  type: 'congestion' | 'speed' | 'wrong_way' | 'plate';
  camera_id: string;
  timestamp: string;
  data: Record<string, any>;
}

export default function TrafficPage() {
  const [events, setEvents] = useState<TrafficEvent[]>([]);
  const [stats, setStats] = useState({ congestion: 0, speed: 0, wrongWay: 0, plates: 0 });
  const socketRef = useRef<Socket | null>(null);

  const addEvent = useCallback((type: TrafficEvent['type'], payload: any) => {
    const evt: TrafficEvent = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      camera_id: payload.camera_id || '',
      timestamp: payload.timestamp || new Date().toISOString(),
      data: payload,
    };
    setEvents(prev => [evt, ...prev].slice(0, 100));
    setStats(prev => ({
      ...prev,
      congestion: prev.congestion + (type === 'congestion' ? 1 : 0),
      speed: prev.speed + (type === 'speed' ? 1 : 0),
      wrongWay: prev.wrongWay + (type === 'wrong_way' ? 1 : 0),
      plates: prev.plates + (type === 'plate' ? 1 : 0),
    }));
  }, []);

  useEffect(() => {
    const token = getToken();
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : undefined,
    });
    socketRef.current = socket;

    socket.on('alert', (p: any) => {
      const t = (p.object_type || p.alertType || '').toUpperCase();
      if (t.includes('CONGESTION')) addEvent('congestion', p);
      else if (t.includes('SPEED')) addEvent('speed', p);
      else if (t.includes('WRONG_WAY')) addEvent('wrong_way', p);
    });
    socket.on('plate_detected', (p: any) => addEvent('plate', p));

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [addEvent]);

  const typeConfig: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
    congestion: { icon: <Car className="w-4 h-4" />, label: 'Congestion', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
    speed: { icon: <Zap className="w-4 h-4" />, label: 'Speed Violation', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
    wrong_way: { icon: <ArrowLeftRight className="w-4 h-4" />, label: 'Wrong Way', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
    plate: { icon: <Gauge className="w-4 h-4" />, label: 'Plate Read', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Traffic Analytics</h1>
        <p className="text-sm text-slate-400 mt-1">Real-time traffic monitoring, speed enforcement, LPR, and wrong-way detection</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Congestion Alerts', value: stats.congestion, icon: <Car className="w-5 h-5 text-yellow-400" />, color: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/20' },
          { label: 'Speed Violations', value: stats.speed, icon: <Zap className="w-5 h-5 text-orange-400" />, color: 'from-orange-500/20 to-orange-500/5 border-orange-500/20' },
          { label: 'Wrong-Way Events', value: stats.wrongWay, icon: <ArrowLeftRight className="w-5 h-5 text-red-400" />, color: 'from-red-500/20 to-red-500/5 border-red-500/20' },
          { label: 'Plates Detected', value: stats.plates, icon: <Gauge className="w-5 h-5 text-blue-400" />, color: 'from-blue-500/20 to-blue-500/5 border-blue-500/20' },
        ].map((s) => (
          <div key={s.label} className={`bg-gradient-to-br ${s.color} border rounded-xl p-5`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{s.label}</p>
                <p className="text-3xl font-bold text-white mt-1">{s.value}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">{s.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Live Event Feed */}
      <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Live Traffic Events</h2>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs text-slate-400">Real-time</span>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Car className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No traffic events yet</p>
            <p className="text-xs text-slate-600 mt-1">Events will appear here as they are detected by the AI engine</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/40 max-h-[500px] overflow-y-auto">
            {events.map((evt) => {
              const cfg = typeConfig[evt.type] || typeConfig.congestion;
              return (
                <div key={evt.id} className="px-5 py-3 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${cfg.bg} border flex items-center justify-center ${cfg.color}`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
                        {evt.data.plate_text && (
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs font-mono">
                            {evt.data.plate_text}
                          </span>
                        )}
                        {evt.data.speed_kmh && (
                          <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded text-xs font-mono">
                            {evt.data.speed_kmh} km/h
                          </span>
                        )}
                        {evt.data.vehicle_count && (
                          <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded text-xs">
                            {evt.data.vehicle_count} vehicles
                          </span>
                        )}
                        {evt.data.level && (
                          <span className={`px-2 py-0.5 rounded text-xs ${evt.data.level === 'CRITICAL' ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                            {evt.data.level}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Camera {evt.camera_id.slice(0, 8)}
                        {evt.data.zone_name && <> · Zone: {evt.data.zone_name}</>}
                        {evt.data.line_name && <> · Line: {evt.data.line_name}</>}
                      </p>
                    </div>
                    <span className="text-xs text-slate-600 whitespace-nowrap">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
