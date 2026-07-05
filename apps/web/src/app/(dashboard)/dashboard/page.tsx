'use client';

import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useAuthStore } from '@/store/auth-store';
import { useCameras, useAlerts, useDetections, useStats } from '@/hooks/use-api';
import { Activity, ShieldAlert, Cpu, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: stats } = useStats();
  const { data: cameras = [] } = useCameras();
  const { data: alerts = [] } = useAlerts();
  const { data: detections = [] } = useDetections(5);

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <div className="flex-1 flex flex-col md:flex-row">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto max-w-7xl mx-auto w-full">
            {/* Welcoming operator header */}
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold tracking-tight text-slate-100 font-mono-data lowercase">
                operator: {user?.name || 'anonymous'}
              </h2>
              <p className="text-xs text-slate-500 font-mono-data">
                surveillance network operational control panel
              </p>
            </div>

            {/* Quick stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] backdrop-blur-sm relative overflow-hidden">
                <div className="stat-shimmer absolute inset-0 pointer-events-none" />
                <Activity className="w-5 h-5 text-[#7eb8f7]" />
                <p className="text-2xl font-bold text-slate-200 mt-2 font-mono-data">
                  {stats?.online_cameras_count ?? cameras.filter((c) => c.status === 'ONLINE').length}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono-data">online cameras</p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] backdrop-blur-sm relative overflow-hidden">
                <ShieldAlert className="w-5 h-5 text-red-400" />
                <p className="text-2xl font-bold text-slate-200 mt-2 font-mono-data">
                  {stats?.today_alerts_count ?? alerts.length}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono-data">active alerts</p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] backdrop-blur-sm relative overflow-hidden">
                <Cpu className="w-5 h-5 text-emerald-400" />
                <p className="text-2xl font-bold text-slate-200 mt-2 font-mono-data">
                  {stats?.fps_average ?? 15} FPS
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono-data">ai frame rate</p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] backdrop-blur-sm relative overflow-hidden">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <p className="text-2xl font-bold text-slate-200 mt-2 font-mono-data">
                  {stats?.inference_latency ?? 42}ms
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono-data">latency avg</p>
              </div>
            </div>

            {/* Core monitoring panels */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Cameras widget */}
              <div className="md:col-span-2 p-6 rounded-2xl glass flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold font-mono-data lowercase">active streams</h3>
                  <Link href="/cameras" className="text-xs text-[#7eb8f7] hover:underline">
                    View all
                  </Link>
                </div>
                <div className="divide-y divide-white/[0.03]">
                  {cameras.length === 0 ? (
                    <p className="text-xs text-slate-600 py-4 font-mono-data">no camera streams registered.</p>
                  ) : (
                    cameras.map((c) => (
                      <div key={c.id} className="flex justify-between items-center py-3">
                        <span className="text-sm font-mono-data text-slate-300 lowercase">{c.name}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider ${
                          c.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {c.status.toLowerCase()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Detections sidebar */}
              <div className="p-6 rounded-2xl glass flex flex-col gap-4">
                <h3 className="text-sm font-bold font-mono-data lowercase">live tracking</h3>
                <div className="flex flex-col gap-3">
                  {detections.length === 0 ? (
                    <p className="text-xs text-slate-600 py-4 font-mono-data">waiting for edge frame events...</p>
                  ) : (
                    detections.map((d) => (
                      <div key={d.id} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.03] flex justify-between items-center text-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-slate-300 capitalize">{d.object_type}</span>
                          <span className="text-[10px] text-slate-500 font-mono-data">
                            {new Date(d.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <span className="font-mono-data text-[#7eb8f7]">{Math.round(d.confidence * 100)}%</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
