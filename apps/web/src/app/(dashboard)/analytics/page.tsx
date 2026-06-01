'use client';

import { useState } from 'react';
import { Activity, Camera, Users, AlertTriangle, Loader2 } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const pieColors = ['#ef4444', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState<'hourly' | 'daily' | 'weekly'>('hourly');

  const { data: summary, isLoading } = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/summary');
      return data;
    },
  });

  const { data: trendData } = useQuery({
    queryKey: ['analytics', timeframe],
    queryFn: async () => {
      const { data } = await api.get(`/analytics/${timeframe}`);
      return data;
    },
  });

  const { data: cameraActivity } = useQuery({
    queryKey: ['analytics', 'cameras'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/cameras');
      return data;
    },
  });

  const byTypeData = summary?.byType?.map((t: any, i: number) => ({
    name: t.type,
    value: t.count,
    color: pieColors[i % pieColors.length],
  })) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Analytics</h1>
        <p className="text-sm text-slate-500">Deep insights into detection patterns and system activity</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Detections', value: summary?.totalDetections ?? 0, icon: Activity, color: 'blue' },
          { label: 'Active Alerts', value: summary?.activeAlerts ?? 0, icon: AlertTriangle, color: 'red' },
          { label: 'Cameras Online', value: `${summary?.onlineCameras ?? 0}/${summary?.totalCameras ?? 0}`, icon: Camera, color: 'emerald' },
          { label: 'Known Faces', value: summary?.knownFaces ?? 0, icon: Users, color: 'purple' },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-xl border border-slate-800/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <stat.icon className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl border border-slate-800/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Detection Trend</h3>
            <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg">
              {['hourly', 'daily', 'weekly'].map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf as 'hourly' | 'daily' | 'weekly')}
                  className={`px-3 py-1 text-[10px] rounded-md font-medium uppercase tracking-wider transition-colors ${
                    timeframe === tf ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
              <AreaChart data={trendData || []}>
                <defs>
                  <linearGradient id="gCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey={timeframe === 'hourly' ? 'hour' : timeframe === 'daily' ? 'day' : 'week'} stroke="#334155" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#334155" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }}
                  itemStyle={{ color: '#cbd5e1' }}
                />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={1.5} fill="url(#gCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card rounded-xl border border-slate-800/60 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Detection by Type</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
              <PieChart>
                <Pie data={byTypeData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {byTypeData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {byTypeData.map((d: any) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-400">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}
                </span>
                <span className="text-white font-medium">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl border border-slate-800/60 p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Camera Activity</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
            <BarChart data={cameraActivity || []} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="camera_name" stroke="#334155" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#334155" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }}
                itemStyle={{ color: '#cbd5e1' }}
              />
              <Bar dataKey="detections" fill="#3b82f6" radius={[3, 3, 0, 0]} fillOpacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
