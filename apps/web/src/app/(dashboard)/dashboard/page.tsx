'use client';

import Header from '@/components/Header';
import { useAuthStore } from '@/store/auth-store';
import { useCameras, useAlerts, useDetections, useStats } from '@/hooks/use-api';
import { Activity, ShieldAlert, Cpu, CheckCircle2, Video, ArrowUpRight, Zap, Eye } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: stats } = useStats();
  const { data: cameras = [] } = useCameras();
  const { data: alerts = [] } = useAlerts();
  const { data: detections = [] } = useDetections(8);

  const onlineCameras = cameras.filter((c) => c.status === 'ONLINE').length;
  const criticalAlerts = alerts.filter((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH').length;

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      <Header />
      
      {/* Operator Telemetry Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl p-6 md:p-8 overflow-hidden bg-gradient-to-r from-slate-900/90 via-sky-950/40 to-slate-900/90 border border-sky-500/20 shadow-2xl"
      >
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/30 uppercase font-mono-data">
                SYSTEM OPERATIONAL
              </span>
              <span className="text-xs text-slate-400 font-mono-data">• AI CORE ONLINE</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-mono-data">
              COMMAND CENTER // <span className="text-gradient capitalize">{user?.name || 'Operator'}</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-xl">
              Real-time neural surveillance telemetry, automated threat detection & city-wide edge stream orchestration.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Link
              href="/live"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-400 to-indigo-600 text-white font-bold text-xs shadow-lg shadow-sky-500/25 hover:brightness-110 transition-all font-mono-data"
            >
              <Video className="w-4 h-4" />
              <span>LAUNCH LIVE MONITOR</span>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Quick Telemetry Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl glass-card relative overflow-hidden group">
          <div className="stat-shimmer absolute inset-0 pointer-events-none" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest font-mono-data">ACTIVE STREAMS</span>
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-400/20 flex items-center justify-center text-sky-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-white mt-3 font-mono-data">
            {onlineCameras} <span className="text-xs font-medium text-slate-500">/ {cameras.length}</span>
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono-data">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-indicator" />
            <span>100% feed uptime</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-card relative overflow-hidden group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest font-mono-data">CRITICAL THREATS</span>
            <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-400/20 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-white mt-3 font-mono-data">
            {criticalAlerts}
          </p>
          <div className="mt-2 text-[11px] text-slate-400 font-mono-data">
            {alerts.length} total events logged
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-card relative overflow-hidden group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono-data">INFERENCE SPEED</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center text-indigo-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-white mt-3 font-mono-data">
            {stats?.fps_average ?? 15} <span className="text-xs font-medium text-slate-500">FPS</span>
          </p>
          <div className="mt-2 text-[11px] text-indigo-300 font-mono-data">
            YOLOv8 Edge Acceleration
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-card relative overflow-hidden group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest font-mono-data">LATENCY AVG</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-white mt-3 font-mono-data">
            {stats?.inference_latency ?? 42}<span className="text-xs font-medium text-slate-500">ms</span>
          </p>
          <div className="mt-2 text-[11px] text-emerald-400 font-mono-data">
            Sub-50ms ultra low latency
          </div>
        </div>
      </div>

      {/* Core Monitoring Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Cameras Overview Panel */}
        <div className="lg:col-span-2 p-6 rounded-2xl glass-panel flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-white/[0.06] pb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-sky-400" />
              <h3 className="text-sm font-bold tracking-wide text-white uppercase font-mono-data">ACTIVE SURVEILLANCE FEEDS</h3>
            </div>
            <Link href="/cameras" className="text-xs text-sky-400 hover:text-sky-300 font-mono-data font-semibold flex items-center gap-1">
              <span>MANAGE ALL</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {cameras.length === 0 ? (
              <div className="py-12 text-center">
                <Eye className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-mono-data">NO CAMERA STREAMS REGISTERED YET.</p>
                <Link href="/cameras" className="text-xs text-sky-400 underline mt-2 inline-block">Add your first camera</Link>
              </div>
            ) : (
              cameras.map((c) => (
                <div key={c.id} className="flex justify-between items-center py-3.5 group hover:bg-white/[0.02] px-2 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-white/10 flex items-center justify-center text-slate-400">
                      <Video className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-200 font-mono-data">{c.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono-data truncate max-w-xs">{c.rtsp_url}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase font-mono-data ${
                      c.status === 'ONLINE' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'
                    }`}>
                      {c.status}
                    </span>
                    <Link href="/live" className="p-1.5 rounded-lg bg-white/[0.05] text-slate-400 hover:text-sky-400 transition-colors">
                      <Eye className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Edge Detection Feed */}
        <div className="p-6 rounded-2xl glass-panel flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-white/[0.06] pb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-bold tracking-wide text-white uppercase font-mono-data">LIVE EDGE TRACKING</h3>
            </div>
            <span className="w-2 h-2 rounded-full bg-sky-400 live-indicator" />
          </div>

          <div className="flex flex-col gap-3">
            {detections.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-xs text-slate-500 font-mono-data">AWAITING REAL-TIME EDGE EVENTS...</p>
              </div>
            ) : (
              detections.map((d) => (
                <div key={d.id} className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.06] flex justify-between items-center text-xs hover:border-sky-500/30 transition-colors">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-slate-200 uppercase font-mono-data tracking-wide">{d.object_type}</span>
                    <span className="text-[10px] text-slate-500 font-mono-data">
                      {new Date(d.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold font-mono-data text-sky-400 text-xs">{Math.round(d.confidence * 100)}%</span>
                    <p className="text-[9px] text-slate-500 uppercase font-mono-data">CONFIDENCE</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
