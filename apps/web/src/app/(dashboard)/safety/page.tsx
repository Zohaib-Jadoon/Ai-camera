'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  PersonStanding, Swords, HardHat, ShieldAlert, AlertTriangle,
  Activity, HeartPulse, Eye,
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

interface SafetyEvent {
  id: string;
  type: 'fall' | 'fight' | 'ppe';
  camera_id: string;
  timestamp: string;
  data: Record<string, any>;
}

export default function SafetyPage() {
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [stats, setStats] = useState({ falls: 0, fights: 0, ppe: 0 });
  const socketRef = useRef<Socket | null>(null);

  const addEvent = useCallback((type: SafetyEvent['type'], payload: any) => {
    const evt: SafetyEvent = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      camera_id: payload.camera_id || '',
      timestamp: payload.timestamp || new Date().toISOString(),
      data: payload,
    };
    setEvents(prev => [evt, ...prev].slice(0, 100));
    setStats(prev => ({
      ...prev,
      falls: prev.falls + (type === 'fall' ? 1 : 0),
      fights: prev.fights + (type === 'fight' ? 1 : 0),
      ppe: prev.ppe + (type === 'ppe' ? 1 : 0),
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
      const t = (p.event_type || p.alertType || p.object_type || '').toUpperCase();
      if (t.includes('FALL')) addEvent('fall', p);
      else if (t.includes('FIGHT')) addEvent('fight', p);
      else if (t.includes('PPE')) addEvent('ppe', p);
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [addEvent]);

  const severityBadge = (type: string) => {
    if (type === 'fall') return <span className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded text-[10px] font-bold uppercase tracking-wider">Critical</span>;
    if (type === 'fight') return <span className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded text-[10px] font-bold uppercase tracking-wider">Critical</span>;
    return <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px] font-bold uppercase tracking-wider">High</span>;
  };

  const typeConfig: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string; desc: string }> = {
    fall: { icon: <PersonStanding className="w-4 h-4" />, label: 'Fall Detected', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', desc: 'Person collapsed — immediate response required' },
    fight: { icon: <Swords className="w-4 h-4" />, label: 'Fight / Aggression', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', desc: 'Physical altercation detected between individuals' },
    ppe: { icon: <HardHat className="w-4 h-4" />, label: 'PPE Violation', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', desc: 'Missing or non-compliant safety equipment' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Safety Compliance</h1>
        <p className="text-sm text-slate-400 mt-1">Fall detection, fight/aggression monitoring, and PPE compliance tracking</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Fall Alerts', value: stats.falls, icon: <PersonStanding className="w-5 h-5 text-red-400" />, color: 'from-red-500/20 to-red-500/5 border-red-500/20', note: 'Uses YOLOv8-Pose keypoints' },
          { label: 'Fight / Aggression', value: stats.fights, icon: <Swords className="w-5 h-5 text-red-400" />, color: 'from-red-500/20 to-red-500/5 border-red-500/20', note: 'Proximity + wrist velocity' },
          { label: 'PPE Violations', value: stats.ppe, icon: <HardHat className="w-5 h-5 text-amber-400" />, color: 'from-amber-500/20 to-amber-500/5 border-amber-500/20', note: 'HSV color analysis on head/torso' },
        ].map((s) => (
          <div key={s.label} className={`bg-gradient-to-br ${s.color} border rounded-xl p-5`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{s.label}</p>
                <p className="text-3xl font-bold text-white mt-1">{s.value}</p>
                <p className="text-[10px] text-slate-500 mt-1">{s.note}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">{s.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Live Events */}
      <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-red-400" />
            Safety Event Feed
          </h2>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
            <span className="text-xs text-slate-400">Monitoring</span>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <ShieldAlert className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No safety events detected</p>
            <p className="text-xs text-slate-600 mt-1">Falls, fights, and PPE violations will appear here in real-time</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/40 max-h-[500px] overflow-y-auto">
            {events.map((evt) => {
              const cfg = typeConfig[evt.type] || typeConfig.fall;
              return (
                <div key={evt.id} className="px-5 py-4 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg ${cfg.bg} border flex items-center justify-center ${cfg.color} flex-shrink-0 mt-0.5`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                        {severityBadge(evt.type)}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{cfg.desc}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span>Camera {evt.camera_id.slice(0, 8)}</span>
                        {evt.data.violations && (
                          <span className="text-amber-400">Missing: {evt.data.violations.join(', ')}</span>
                        )}
                        {evt.data.confidence && (
                          <span>Confidence: {(evt.data.confidence * 100).toFixed(0)}%</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-600 whitespace-nowrap flex-shrink-0">
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
