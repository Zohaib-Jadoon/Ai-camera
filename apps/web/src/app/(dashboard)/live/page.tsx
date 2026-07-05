'use client';

import { useState, useEffect } from 'react';
import {
  Settings, Maximize2,
  ShieldAlert, Info, WifiOff, Volume2, VolumeX,
  RotateCcw, ZoomIn, Camera, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useCameras, useDetections } from '@/hooks/use-api';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket';

const TYPE_COLORS: Record<string, string> = {
  person: 'text-red-400 bg-red-400/20 border-red-400/30',
  car: 'text-blue-400 bg-blue-400/20 border-blue-400/30',
  truck: 'text-cyan-400 bg-cyan-400/20 border-cyan-400/30',
  face: 'text-purple-400 bg-purple-400/20 border-purple-400/30',
  intrusion: 'text-amber-400 bg-amber-400/20 border-amber-400/30',
  motorcycle: 'text-pink-400 bg-pink-400/20 border-pink-400/30',
  animal: 'text-emerald-400 bg-emerald-400/20 border-emerald-400/30',
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

/**
 * CameraFeed — receives live JPEG frames from the AI Engine via Socket.IO.
 *
 * Flow:
 *   1. On mount, joins the camera's Socket.IO room ("join-camera" event).
 *   2. AI Engine → backend → web: "frame" events carry base64-encoded JPEG.
 *   3. Each frame is rendered instantly as a data-URL on an <img> element.
 *   4. On unmount, leaves the room to stop receiving frames.
 */
function CameraFeed({ cameraId, isOnline, refreshTrigger, isZoomed }: { cameraId: string; isOnline: boolean; refreshTrigger: number; isZoomed: boolean }) {
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [hasFrame, setHasFrame] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setFrameSrc(null);
      setHasFrame(false);
      return;
    }

    const socket = getSocket();

    // Reset frame state on manual refresh
    setHasFrame(false);

    // Join the camera room so the backend delivers frames only to us
    socket.emit('join-camera', cameraId);

    const onFrame = (payload: { camera_id: string; data: string }) => {
      if (payload.camera_id !== cameraId) return;
      setFrameSrc(`data:image/jpeg;base64,${payload.data}`);
      setHasFrame(true);
    };

    socket.on('frame', onFrame);

    return () => {
      socket.off('frame', onFrame);
      socket.emit('leave-camera', cameraId);
    };
  }, [cameraId, isOnline, refreshTrigger]);

  if (!isOnline) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800/80">
          <WifiOff className="w-8 h-8 text-slate-600" />
        </div>
        <span className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Camera Offline</span>
      </div>
    );
  }

  if (!hasFrame) {
    return (
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500/50" />
        <span className="text-xs font-semibold uppercase tracking-widest">Connecting feed...</span>
      </div>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={frameSrc!}
        alt="Live camera feed"
        width={1280}
        height={720}
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-transform duration-300",
          isZoomed ? "scale-150 z-20 pointer-events-none" : "scale-100"
        )}
      />
      {/* Scan line overlay */}
      <div className="scan-line absolute inset-0 pointer-events-none z-30" />
    </>
  );
}


export default function LiveMonitoring() {
  const [layout, setLayout] = useState<'2x2' | '3x2' | '1+3'>('2x2');
  const [selectedCam, setSelectedCam] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [refreshTriggers, setRefreshTriggers] = useState<Record<string, number>>({});
  const [zoomedCams, setZoomedCams] = useState<Record<string, boolean>>({});
  const qc = useQueryClient();

  // Real-time camera status updates via WebSocket
  useEffect(() => {
    const socket = getSocket();
    const handler = (payload: { camera_id: string; status: string }) => {
      // Instantly patch the in-memory cache so the UI flips ONLINE/OFFLINE
      // immediately — no network round-trip needed for a simple status field.
      qc.setQueryData<import('@/hooks/use-api').Camera[]>(['cameras'], (old) => {
        if (!old) return old;
        return old.map((cam) =>
          cam.id === payload.camera_id ? { ...cam, status: payload.status } : cam
        );
      });
      // Also invalidate so any other stale fields (last_seen etc.) refresh soon
      qc.invalidateQueries({ queryKey: ['cameras'] });
    };
    socket.on('camera_status', handler);
    return () => { socket.off('camera_status', handler); };
  }, [qc]);

  const { data: cameras = [], isLoading: camsLoading } = useCameras();
  const { data: events = [] } = useDetections(20);

  const gridClass = {
    '2x2': 'grid-cols-1 md:grid-cols-2',
    '3x2': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    '1+3': 'grid-cols-1 lg:grid-cols-4',
  };

  // Group detections by camera for badge counts
  const detectionsByCam = events.reduce<Record<string, number>>((acc, ev) => {
    acc[ev.camera_id] = (acc[ev.camera_id] ?? 0) + 1;
    return acc;
  }, {});

  // Interactive Hover Button Handlers
  const handleFullscreen = (e: React.MouseEvent, camId: string) => {
    e.stopPropagation();
    const el = document.getElementById(`cam-card-${camId}`);
    if (el) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        el.requestFullscreen().catch((err) => {
          console.error(`Error entering fullscreen: ${err}`);
        });
      }
    }
  };

  const handleZoomToggle = (e: React.MouseEvent, camId: string) => {
    e.stopPropagation();
    setZoomedCams(prev => ({ ...prev, [camId]: !prev[camId] }));
  };

  const handleRefresh = (e: React.MouseEvent, camId: string) => {
    e.stopPropagation();
    qc.invalidateQueries({ queryKey: ['cameras'] });
    setRefreshTriggers(prev => ({ ...prev, [camId]: (prev[camId] ?? 0) + 1 }));
  };

  const handleSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = '/cameras';
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
        <motion.div variants={itemVariants}>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Live <span className="text-gradient">Monitoring</span></h1>
          <p className="text-slate-400 font-medium text-sm">
            {camsLoading ? 'Loading cameras...' : `${cameras.filter((c) => c.status === 'ONLINE').length} of ${cameras.length} cameras online`}
          </p>
        </motion.div>
        <motion.div variants={itemVariants} className="flex items-center gap-3">
          <div className="flex bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-1 shadow-lg overflow-x-auto scrollbar-hide">
            {(['2x2', '3x2', '1+3'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLayout(l)}
                className={cn(
                  'px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all whitespace-nowrap',
                  layout === l ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-white hover:bg-slate-800'
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            onClick={() => setMuted(!muted)}
            className="p-2.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shadow-lg"
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 text-blue-400" />}
          </button>
        </motion.div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Camera grid */}
        {camsLoading ? (
          <div className="flex-1 flex items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Loading cameras...</span>
          </div>
        ) : cameras.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Camera className="w-16 h-16 text-slate-800" />
            <p className="text-sm text-center">No cameras configured.<br />Add cameras in the Cameras section to see live feeds.</p>
          </div>
        ) : (
          <div className={cn('flex-1 grid gap-4 transition-all duration-500 content-start', gridClass[layout])}>
            <AnimatePresence mode="popLayout">
              {cameras.map((cam) => {
                const isOnline = cam.status === 'ONLINE';
                const detCount = detectionsByCam[cam.id] ?? 0;
                return (
                  <motion.div
                    layout
                    variants={itemVariants}
                    key={cam.id}
                    id={`cam-card-${cam.id}`}
                    onClick={() => setSelectedCam(cam.id)}
                    className={cn(
                      'relative rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300',
                      'border border-slate-800/60 shadow-xl bg-slate-950',
                      layout === '1+3' && cam.id === cameras[0]?.id ? 'lg:col-span-3 lg:row-span-2' : '',
                      selectedCam === cam.id ? 'ring-2 ring-blue-500 glow-blue' : 'hover:border-slate-700/80',
                      !isOnline ? 'opacity-60 grayscale-[50%]' : ''
                    )}
                  >
                    {/* Video / snapshot area */}
                    <div className="w-full h-full min-h-[200px] flex items-center justify-center relative bg-[#020617]">
                      <CameraFeed
                        cameraId={cam.id}
                        isOnline={isOnline}
                        refreshTrigger={refreshTriggers[cam.id] ?? 0}
                        isZoomed={!!zoomedCams[cam.id]}
                      />
                    </div>

                    {/* Top overlay */}
                    <div className="absolute top-3 left-3 flex items-center gap-2 z-40">
                      {isOnline && (
                        <span className="flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm border border-red-500/50 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-md shadow-lg shadow-red-600/20 live-indicator">
                          <span className="w-1.5 h-1.5 bg-white rounded-full" /> LIVE
                        </span>
                      )}
                      <span className="text-xs text-white font-bold tracking-wide bg-slate-900/80 backdrop-blur-md border border-slate-700/50 px-2.5 py-1 rounded-md shadow-lg">
                        {cam.name}
                      </span>
                    </div>

                    {/* Hover controls */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex gap-2 z-40">
                      <button
                        onClick={(e) => handleFullscreen(e, cam.id)}
                        className="w-8 h-8 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-blue-600/90 hover:border-blue-500 transition-all shadow-lg hover:-translate-y-0.5"
                        title="Fullscreen"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleZoomToggle(e, cam.id)}
                        className={cn(
                          "w-8 h-8 backdrop-blur-md border rounded-lg flex items-center justify-center transition-all shadow-lg hover:-translate-y-0.5",
                          zoomedCams[cam.id]
                            ? "bg-blue-600 border-blue-500 text-white"
                            : "bg-slate-900/80 border-slate-700/50 text-slate-300 hover:text-white hover:bg-blue-600/90 hover:border-blue-500"
                        )}
                        title="Zoom Feed"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleRefresh(e, cam.id)}
                        className="w-8 h-8 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-blue-600/90 hover:border-blue-500 transition-all shadow-lg hover:-translate-y-0.5"
                        title="Refresh Connection"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleSettings}
                        className="w-8 h-8 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-blue-600/90 hover:border-blue-500 transition-all shadow-lg hover:-translate-y-0.5"
                        title="Camera Settings"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Bottom stats */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#020617] via-[#020617]/80 to-transparent z-10">
                      <div className="flex items-center justify-between text-xs mt-6">
                        <div className="flex items-center gap-4 text-slate-300 font-medium">
                          <span className="flex items-center gap-1.5 bg-slate-800/80 backdrop-blur-sm px-2 py-1 rounded-md border border-slate-700/50">
                            <Camera className="w-3.5 h-3.5 text-blue-400" /> {detCount} det.
                          </span>
                          {!isOnline && (
                            <span className="text-red-400 flex items-center gap-1.5 bg-red-400/10 backdrop-blur-sm px-2 py-1 rounded-md border border-red-400/20">
                              <WifiOff className="w-3.5 h-3.5" /> Offline
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 font-mono font-bold tracking-wider text-[10px]">
                          {cam.location ?? '—'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Live event sidebar */}
        <motion.div variants={itemVariants} className="hidden xl:flex flex-col w-80 glass-card rounded-2xl border border-slate-800/60 overflow-hidden flex-shrink-0 shadow-2xl">
          <div className="p-4 border-b border-slate-800/60 flex items-center gap-3 bg-slate-900/50">
            <div className="p-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30">
              <Info className="w-4 h-4 text-blue-400" />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Live Feed</h3>
            <span className="ml-auto w-2.5 h-2.5 bg-emerald-400 rounded-full live-indicator shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600 py-8">
                <ShieldAlert className="w-8 h-8 opacity-30" />
                <p className="text-xs text-center">No recent events</p>
              </div>
            ) : (
              events.map((ev) => {
                const colorClass = TYPE_COLORS[ev.object_type] ?? 'text-slate-400 bg-slate-800/50 border-slate-700';
                const camName = ev.camera?.name ?? ev.camera_id.slice(0, 8);
                const ts = new Date(ev.timestamp).toLocaleTimeString();
                return (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={ev.id}
                    className="p-3 rounded-xl border border-slate-800/40 bg-slate-900/30 hover:bg-slate-800/80 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border capitalize', colorClass)}>
                        {ev.object_type}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono font-semibold">{ts}</span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium group-hover:text-white transition-colors">{camName}</p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" style={{ width: `${ev.confidence * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-blue-400 font-mono font-bold">{(ev.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
