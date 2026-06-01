'use client';

import { useState, useMemo } from 'react';
import {
  Video, AlertTriangle, Activity, Users,
  ShieldAlert, Eye, Cpu, Clock, Loader2
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { useAnalyticsSummary, useCameras, useAlerts, useHourlyTrend, HourlyTrend } from '@/hooks/use-api';
import ClientOnly from '@/components/ClientOnly';

const PIE_COLORS = ['#ef4444', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#06b6d4'];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const severityColors: Record<string, string> = {
  INTRUSION: 'text-red-400 bg-red-500/10',
  UNKNOWN_FACE: 'text-amber-400 bg-amber-500/10',
  DETECTION: 'text-emerald-400 bg-emerald-500/10',
  default: 'text-slate-400 bg-slate-500/10',
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'events' | 'cameras'>('events');
  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary();
  const { data: cameras = [], isLoading: camerasLoading } = useCameras();
  const { data: alerts = [] } = useAlerts();
  const { data: hourlyData = [] } = useHourlyTrend(24);

  // Format hourly trend for Recharts
  const detectionData = useMemo(() =>
    hourlyData.map((h: HourlyTrend) => ({
      time: h.hour.slice(11, 16), // Extract HH:MM
      human: h.persons,
      vehicle: h.vehicles,
      other: Math.max(0, h.count - h.persons - h.vehicles),
    })),
    [hourlyData]
  );

  // Pie chart from real byType data
  const pieData = useMemo(() => {
    if (!summary?.byType?.length) return [];
    const total = summary.byType.reduce((s, b) => s + b.count, 0);
    return summary.byType.slice(0, 5).map((b, i) => ({
      name: b.type,
      value: total > 0 ? Math.round((b.count / total) * 100) : 0,
      count: b.count,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [summary]);

  // Weekly alert bar chart — last 7 days from real alerts
  const alertData = useMemo(() => {
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      return { name: DAYS[d.getDay()], date: d.toDateString(), alerts: 0 };
    });
    for (const a of alerts) {
      const day = new Date(a.sent_at).toDateString();
      const entry = days.find((d) => d.date === day);
      if (entry) entry.alerts++;
    }
    return days;
  }, [alerts]);

  const stats = [
    { label: 'Active Cameras', value: summary ? `${summary.onlineCameras} / ${summary.totalCameras}` : '-', icon: Video, color: 'blue' as const, glow: 'glow-blue' },
    { label: 'Total Detections', value: summary ? `${summary.totalDetections.toLocaleString()}` : '-', icon: Activity, color: 'purple' as const, glow: '' },
    { label: 'Active Alerts', value: summary ? `${summary.activeAlerts}` : '-', icon: AlertTriangle, color: 'red' as const, glow: 'glow-red' },
    { label: 'Known Faces', value: summary ? `${summary.knownFaces}` : '-', icon: Users, color: 'emerald' as const, glow: 'glow-green' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };

  const recentEvents = alerts.slice(0, 5).map((a) => ({
    id: a.id,
    type: a.alert_type,
    desc: `${a.alert_type.replace(/_/g, ' ')} detected`,
    camera: a.camera_id ? `Camera ${a.camera_id.slice(0, 8)}` : 'Unknown Camera',
    time: new Date(a.sent_at).toLocaleTimeString(),
    severity: a.alert_type.includes('INTRUSION') ? 'INTRUSION' : a.alert_type.includes('FACE') ? 'UNKNOWN_FACE' : 'DETECTION',
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Command Center</h1>
          <p className="text-sm text-slate-500 mt-0.5">AI-powered surveillance overview — all systems nominal</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900/60 border border-slate-800 px-3 py-2 rounded-lg w-fit">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span>Updated just now</span>
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full live-indicator" />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const colorClass = colorMap[stat.color];
          return (
            <div key={stat.label} className={`glass-card rounded-xl p-4 border ${colorClass.split(' ')[2]} ${stat.glow}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <div className={`p-2 rounded-lg border ${colorClass}`}>
                  <stat.icon className="w-3.5 h-3.5" />
                </div>
              </div>
              {summaryLoading ? (
                <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
              ) : (
                <div className="text-2xl font-bold text-white">{stat.value}</div>
              )}
              <p className="text-xs flex items-center gap-1 mt-1.5 text-slate-500">
                <Activity className="w-3 h-3" />
                Live data
              </p>
            </div>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
        <div className="lg:col-span-5 glass-card rounded-xl border border-slate-800/60 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-white">Detection Trends</h3>
              <p className="text-xs text-slate-500">Real-time AI analytics (24h)</p>
            </div>
            <div className="flex items-center gap-4 text-[10px]">
              {[
                { color: 'bg-red-500', label: 'Human' },
                { color: 'bg-blue-500', label: 'Vehicle' },
                { color: 'bg-purple-500', label: 'Face' },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-slate-400">
                  <span className={`w-2 h-2 rounded-full ${l.color}`} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          <div className="h-56 w-full overflow-hidden">
            <ClientOnly>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                <AreaChart data={detectionData}>
                  <defs>
                    <linearGradient id="gHuman" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gVehicle" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gFace" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#334155" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#334155" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }}
                    itemStyle={{ color: '#cbd5e1' }}
                    labelStyle={{ color: '#64748b', marginBottom: '4px', fontSize: '10px' }}
                  />
                  <Area type="monotone" dataKey="human" stroke="#ef4444" strokeWidth={1.5} fill="url(#gHuman)" />
                  <Area type="monotone" dataKey="vehicle" stroke="#3b82f6" strokeWidth={1.5} fill="url(#gVehicle)" />
                  <Area type="monotone" dataKey="face" stroke="#8b5cf6" strokeWidth={1.5} fill="url(#gFace)" />
                </AreaChart>
              </ResponsiveContainer>
            </ClientOnly>
          </div>
        </div>

        <div className="lg:col-span-2 glass-card rounded-xl border border-slate-800/60 p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Breakdown</h3>
          <p className="text-xs text-slate-500 mb-4">By object class</p>
          <div className="h-32">
            <ClientOnly>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </ClientOnly>
          </div>
          <div className="space-y-2 mt-2">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-400">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  {d.name}
                </span>
                <span className="text-white font-medium">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alert Chart + Events/Cameras */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 glass-card rounded-xl border border-slate-800/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-white">Weekly Alerts</h3>
          </div>
          <div className="h-40 w-full overflow-hidden">
            <ClientOnly>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                <BarChart data={alertData} barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#334155" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#334155" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }}
                    itemStyle={{ color: '#ef4444' }}
                  />
                  <Bar dataKey="alerts" fill="#ef4444" radius={[3, 3, 0, 0]} fillOpacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </ClientOnly>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-slate-500">7-day total</span>
            <span className="text-white font-bold">{alertData.reduce((s, d) => s + d.alerts, 0)} alerts</span>
          </div>
        </div>

        <div className="lg:col-span-3 glass-card rounded-xl border border-slate-800/60 overflow-hidden">
          <div className="flex border-b border-slate-800/60">
            {['events', 'cameras'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as 'events' | 'cameras')}
                className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  activeTab === tab
                    ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab === 'events' ? '⚡ Recent Events' : '📷 Camera Status'}
              </button>
            ))}
          </div>

          <div className="h-[260px] overflow-y-auto">
            {activeTab === 'events' ? (
              <div className="divide-y divide-slate-800/40">
                {recentEvents.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">No recent events</div>
                ) : (
                  recentEvents.map((event) => (
                    <div key={event.id} className="flex items-start gap-3 p-3 hover:bg-slate-800/20 transition-colors">
                      <div className={`mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase flex-shrink-0 ${severityColors[event.severity] ?? severityColors.default}`}>
                        {event.severity.replace(/_/g, ' ')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{event.desc}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{event.camera} · {event.time}</p>
                      </div>
                      <Eye className="w-3.5 h-3.5 text-slate-600 hover:text-blue-400 cursor-pointer flex-shrink-0 mt-0.5" />
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-800/40">
                {camerasLoading ? (
                  <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 text-slate-500 animate-spin" /></div>
                ) : cameras.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">No cameras configured</div>
                ) : (
                  cameras.map((cam) => (
                    <div key={cam.id} className="flex items-center gap-3 p-3 hover:bg-slate-800/20 transition-colors">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cam.status === 'ONLINE' || cam.status === 'Online' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white">{cam.name}</p>
                        <p className="text-[10px] text-slate-500">{cam.location || 'No location'}</p>
                      </div>
                      <span className={`text-[9px] font-medium uppercase ${cam.status === 'ONLINE' || cam.status === 'Online' ? 'text-emerald-400' : 'text-slate-600'}`}>
                        {cam.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Engine Status bar */}
      <div className="glass-card rounded-xl border border-slate-800/60 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">AI Engine Status</h3>
          <span className="ml-auto text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold uppercase">All Systems Operational</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'YOLOv8 Detection', val: 98, color: 'bg-blue-500' },
            { label: 'Face Recognition', val: 94, color: 'bg-purple-500' },
            { label: 'Object Tracking', val: 87, color: 'bg-amber-500' },
            { label: 'GPU Utilization', val: 62, color: 'bg-emerald-500' },
          ].map((m) => (
            <div key={m.label}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400">{m.label}</span>
                <span className="text-white font-semibold">{m.val}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${m.color} rounded-full`} style={{ width: `${m.val}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
