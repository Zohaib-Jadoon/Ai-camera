'use client';

import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Camera, ShieldAlert, Maximize2, LayoutGrid } from 'lucide-react';
import { useUIStore } from '@/store';
import { cn } from '@/lib/utils';

export default function LiveMonitoringPage() {
  const [cameras, setCameras] = useState([
    { id: '1', name: 'Main Gate', status: 'ONLINE' },
    { id: '2', name: 'Backyard', status: 'ONLINE' },
    { id: '3', name: 'Warehouse', status: 'OFFLINE' },
    { id: '4', name: 'Parking Lot', status: 'ONLINE' },
  ]);
  const addAlert = useUIStore((state) => state.addAlert);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001');

    socket.on('alert', (alert) => {
      addAlert(alert);
    });

    return () => {
      socket.disconnect();
    };
  }, [addAlert]);

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Live Monitoring</h1>
          <p className="text-zinc-500">Real-time AI surveillance feeds</p>
        </div>
        <div className="flex gap-2">
            <button className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
                <LayoutGrid className="w-5 h-5" />
            </button>
            <button className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm text-blue-600">
                <Maximize2 className="w-5 h-5" />
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cameras.map((camera) => (
          <div key={camera.id} className="group relative bg-black aspect-video rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
            {/* Mock Video Stream */}
            <div className="absolute inset-0 flex items-center justify-center">
              {camera.status === 'ONLINE' ? (
                <div className="w-full h-full bg-zinc-900 flex items-center justify-center relative">
                    <span className="text-zinc-700 text-lg font-mono uppercase tracking-widest">FEED_{camera.id}_CONNECTED</span>
                    {/* Simulated AI Overlays */}
                    <div className="absolute top-1/4 left-1/4 w-32 h-64 border-2 border-green-500 rounded-sm">
                        <span className="absolute -top-6 left-0 bg-green-500 text-white text-[10px] px-1 py-0.5 rounded-t font-bold">HUMAN 92%</span>
                    </div>
                </div>
              ) : (
                <div className="text-zinc-600 flex flex-col items-center gap-2">
                    <Camera className="w-12 h-12 opacity-20" />
                    <span className="text-sm font-medium">CAMERA OFFLINE</span>
                </div>
              )}
            </div>

            {/* Overlay UI */}
            <div className="absolute inset-0 p-4 flex flex-col justify-between bg-gradient-to-t from-black/60 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    camera.status === 'ONLINE' ? "bg-green-500 animate-pulse" : "bg-zinc-500"
                  )} />
                  <span className="text-white font-bold text-sm uppercase tracking-wider">{camera.name}</span>
                </div>
                {camera.status === 'ONLINE' && (
                  <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              <div className="flex justify-end gap-2">
                  <button className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg backdrop-blur-md transition-colors">
                      <ShieldAlert className="w-4 h-4" />
                  </button>
                  <button className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg backdrop-blur-md transition-colors">
                      <Maximize2 className="w-4 h-4" />
                  </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
