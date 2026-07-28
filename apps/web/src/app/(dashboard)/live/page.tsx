'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings, Maximize2,
  ShieldAlert, Info, WifiOff, Volume2, VolumeX,
  RotateCcw, ZoomIn, Camera, Loader2, Download, Eye, Layers
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
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 24 } },
};

function CameraFeed({
  cameraId,
  isOnline,
  refreshTrigger,
  isZoomed,
  onFrameUpdate
}: {
  cameraId: string;
  isOnline: boolean;
  refreshTrigger: number;
  isZoomed: boolean;
  onFrameUpdate?: (cameraId: string, dataUrl: string) => void;
}) {
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [hasFrame, setHasFrame] = useState(false);
  const [fps, setFps] = useState<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastFpsCalcRef = useRef<number>(Date.now());
  const onFrameUpdateRef = useRef(onFrameUpdate);

  useEffect(() => {
    onFrameUpdateRef.current = onFrameUpdate;
  }, [onFrameUpdate]);

  useEffect(() => {
    if (!isOnline) {
      setFrameSrc(null);
      setHasFrame(false);
      return;
    }

    const socket = getSocket();
    setHasFrame(false);

    const joinRoom = () => {
      socket.emit('join-camera', cameraId);
    };

    if (socket.connected) {
      joinRoom();
    }
    socket.on('connect', joinRoom);

    const onFrame = (payload: { camera_id: string; data: string }) => {
      if (payload.camera_id !== cameraId) return;
      const dataUrl = `data:image/jpeg;base64,${payload.data}`;
      setFrameSrc(dataUrl);
      setHasFrame(true);
      if (onFrameUpdateRef.current) {
        onFrameUpdateRef.current(cameraId, dataUrl);
      }

      // Calculate live FPS
      frameCountRef.current += 1;
      const now = Date.now();
      if (now - lastFpsCalcRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsCalcRef.current = now;
      }
    };

    socket.on('frame', onFrame);

    return () => {
      socket.off('connect', joinRoom);
      socket.off('frame', onFrame);
      socket.emit('leave-camera', cameraId);
    };
  }, [cameraId, isOnline, refreshTrigger]);

  if (!isOnline) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-900/90 flex items-center justify-center border border-slate-800 shadow-inner">
          <WifiOff className="w-7 h-7 text-red-400/70" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Stream Offline</span>
          <span className="text-[11px] text-slate-600">Camera disconnected from AI Engine</span>
        </div>
      </div>
    );
  }

  if (!hasFrame) {
    return (
      <div className="flex flex-col items-center gap-3 text-slate-400 p-6 text-center">
        <Loader2 className="w-9 h-9 animate-spin text-blue-400/80" />
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Connecting Feed...</span>
          <span className="text-[11px] text-slate-500">Waiting for live video frames</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={frameSrc!}
        alt="Live camera feed"
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-transform duration-300",
          isZoomed ? "scale-150 z-20" : "scale-100"
        )}
      />
      {/* Subtle scan line effect */}
      <div className="scan-line absolute inset-0 pointer-events-none z-30 opacity-40" />

      {/* Live FPS Badge */}
      {fps > 0 && (
        <div className="absolute bottom-3 right-3 z-40 bg-slate-950/80 backdrop-blur-md border border-slate-800 px-2 py-0.5 rounded text-[10px] font-mono font-semibold text-emerald-400 flex items-center gap-1 shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {fps} FPS
        </div>
      )}
    </>
  );
}

export default function LiveMonitoring() {
  const router = useRouter();
  const [layout, setLayout] = useState<'2x2' | '3x2' | '1+3'>('2x2');
  const [selectedCam, setSelectedCam] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [refreshTriggers, setRefreshTriggers] = useState<Record<string, number>>({});
  const [zoomedCams, setZoomedCams] = useState<Record<string, boolean>>({});
  const [showEventSidebar, setShowEventSidebar] = useState(true);
  const [lastFrameData, setLastFrameData] = useState<Record<string, string>>({});
  const qc = useQueryClient();

  const handleFrameUpdate = useCallback((camId: string, dataUrl: string) => {
    setLastFrameData(prev => ({ ...prev, [camId]: dataUrl }));
  }, []);

  // Real-time camera status updates via WebSocket
  useEffect(() => {
    const socket = getSocket();
    const handler = (payload: { camera_id: string; status: string }) => {
      qc.setQueryData<import('@/hooks/use-api').Camera[]>(['cameras'], (old) => {
        if (!old) return old;
        return old.map((cam) =>
          cam.id === payload.camera_id ? { ...cam, status: payload.status } : cam
        );
      });
      qc.invalidateQueries({ queryKey: ['cameras'] });
    };
    socket.on('camera_status', handler);
    return () => { socket.off('camera_status', handler); };
  }, [qc]);

  const { data: cameras = [], isLoading: camsLoading } = useCameras();
  const { data: events = [] } = useDetections(30);

  const gridClass = {
    '2x2': 'grid-cols-1 md:grid-cols-2',
    '3x2': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    '1+3': 'grid-cols-1 lg:grid-cols-4',
  };

  const detectionsByCam = events.reduce<Record<string, number>>((acc, ev) => {
    if (ev.camera_id) {
      acc[ev.camera_id] = (acc[ev.camera_id] ?? 0) + 1;
    }
    return acc;
  }, {});

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

  const handleSnapshot = (e: React.MouseEvent, camId: string, camName: string) => {
    e.stopPropagation();
    const dataUrl = lastFrameData[camId];
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `snapshot-${camName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.jpg`;
    a.click();
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="h-full flex flex-col gap-5">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0 bg-slate-900/40 backdrop-blur-md border border-slate-800/80 p-4 rounded-2xl shadow-xl">
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Live <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400">Monitoring</span>
            </h1>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> SYSTEM ACTIVE
            </span>
          </div>
          <p className="text-slate-400 font-medium text-xs sm:text-sm mt-1">
            {camsLoading ? 'Loading cameras...' : `${cameras.filter((c) => c.status === 'ONLINE').length} of ${cameras.length} cameras online`}
          </p>
        </motion.div>

        {/* Toolbar controls */}
        <motion.div variants={itemVariants} className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-slate-950/90 border border-slate-800/90 rounded-xl p-1 shadow-inner">
            {(['2x2', '3x2', '1+3'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLayout(l)}
                className={cn(
                  'px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200',
                  layout === l ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                )}
              >
                {l}
              </button>
            ))}
          </div>

          <button
            onClick={() => setMuted(!muted)}
            className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/90 text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors shadow-inner"
            title={muted ? 'Unmute Audio Alerts' : 'Mute Audio Alerts'}
          >
            {muted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5 text-blue-400" />}
          </button>

          <button
            onClick={() => setShowEventSidebar(!showEventSidebar)}
            className={cn(
              "p-2.5 rounded-xl border transition-colors shadow-inner flex items-center gap-2 text-xs font-bold",
              showEventSidebar
                ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                : "bg-slate-950/90 border-slate-800/90 text-slate-400 hover:text-white hover:bg-slate-800/60"
            )}
            title="Toggle Live Event Panel"
          >
            <Layers className="w-4.5 h-4.5" />
            <span className="hidden sm:inline">Events</span>
          </button>
        </motion.div>
      </div>

      {/* Main Monitoring Body */}
      <div className="flex-1 flex gap-5 min-h-0 overflow-hidden">
        {/* Camera Grid Section */}
        {camsLoading ? (
          <div className="flex-1 flex items-center justify-center gap-3 text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800/60">
            <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
            <span className="text-sm font-medium">Initializing camera grid...</span>
          </div>
        ) : cameras.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800/60 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-900/90 flex items-center justify-center border border-slate-800 shadow-xl">
              <Camera className="w-8 h-8 text-slate-600" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-bold text-white">No Cameras Connected</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Add IP or RTSP camera endpoints in the Cameras section to launch real-time AI computer vision monitoring.
              </p>
            </div>
            <button
              onClick={() => router.push('/cameras')}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-colors"
            >
              Add Camera
            </button>
          </div>
        ) : (
          <div className={cn('flex-1 grid gap-4 transition-all duration-300 overflow-y-auto pr-1 scrollbar-hide auto-rows-max', gridClass[layout])}>
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
                      'relative rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 flex flex-col',
                      'border border-slate-800/80 shadow-2xl bg-slate-950',
                      layout === '1+3' && cam.id === cameras[0]?.id ? 'lg:col-span-3 lg:row-span-2' : '',
                      selectedCam === cam.id ? 'ring-2 ring-blue-500 shadow-blue-500/20' : 'hover:border-slate-700',
                      !isOnline ? 'opacity-70' : ''
                    )}
                  >
                    {/* Widescreen 16:9 Video Canvas Container */}
                    <div className="w-full aspect-video flex items-center justify-center relative bg-[#020617] overflow-hidden">
                      <CameraFeed
                        cameraId={cam.id}
                        isOnline={isOnline}
                        refreshTrigger={refreshTriggers[cam.id] ?? 0}
                        isZoomed={!!zoomedCams[cam.id]}
                        onFrameUpdate={handleFrameUpdate}
                      />
                    </div>

                    {/* Top Status & Overlay Header */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-40 pointer-events-none">
                      <div className="flex items-center gap-2">
                        {isOnline ? (
                          <span className="flex items-center gap-1.5 bg-red-600/90 backdrop-blur-md border border-red-500/50 text-white text-[10px] font-black px-2.5 py-1 rounded-md shadow-lg shadow-red-600/30">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" /> LIVE
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 text-slate-400 text-[10px] font-bold px-2.5 py-1 rounded-md shadow-lg">
                            OFFLINE
                          </span>
                        )}
                        <span className="text-xs text-white font-extrabold tracking-wide bg-slate-950/85 backdrop-blur-md border border-slate-800/90 px-2.5 py-1 rounded-md shadow-lg">
                          {cam.name}
                        </span>
                      </div>

                      {/* Hover controls bar */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1.5 pointer-events-auto">
                        <button
                          onClick={(e) => handleFullscreen(e, cam.id)}
                          className="w-8 h-8 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-blue-600 transition-all shadow-lg"
                          title="Fullscreen Mode"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleZoomToggle(e, cam.id)}
                          className={cn(
                            "w-8 h-8 backdrop-blur-md border rounded-lg flex items-center justify-center transition-all shadow-lg",
                            zoomedCams[cam.id]
                              ? "bg-blue-600 border-blue-500 text-white"
                              : "bg-slate-950/90 border-slate-800 text-slate-300 hover:text-white hover:bg-blue-600"
                          )}
                          title="Digital Zoom"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleSnapshot(e, cam.id, cam.name)}
                          className="w-8 h-8 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-blue-600 transition-all shadow-lg"
                          title="Capture Snapshot"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleRefresh(e, cam.id)}
                          className="w-8 h-8 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-blue-600 transition-all shadow-lg"
                          title="Reconnect Stream"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Metadata Bar */}
                    <div className="p-3 bg-slate-900/80 backdrop-blur-md border-t border-slate-800/80 flex items-center justify-between z-10 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 px-2 py-1 rounded text-[11px] font-bold text-slate-300">
                          <Eye className="w-3.5 h-3.5 text-blue-400" /> {detCount} Detections
                        </span>
                      </div>
                      <span className="text-slate-400 font-mono font-bold text-[10px] truncate max-w-[140px]">
                        {cam.location || 'Default Zone'}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Live Event Sidebar */}
        {showEventSidebar && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-80 flex flex-col bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-800/80 overflow-hidden flex-shrink-0 shadow-2xl"
          >
            <div className="p-4 border-b border-slate-800/80 flex items-center gap-3 bg-slate-950/60">
              <div className="p-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30">
                <Info className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-xs font-black text-white uppercase tracking-wider">AI Detections</h3>
                <span className="text-[10px] text-slate-400 font-medium">Real-time object log</span>
              </div>
              <span className="ml-auto w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500 py-12 text-center">
                  <ShieldAlert className="w-8 h-8 opacity-40 text-slate-600" />
                  <p className="text-xs font-medium">No live AI detections yet</p>
                </div>
              ) : (
                events.map((ev) => {
                  const colorClass = TYPE_COLORS[ev.object_type] ?? 'text-slate-400 bg-slate-800/50 border-slate-700';
                  const camName = ev.camera?.name ?? ev.camera_id?.slice(0, 8) ?? 'Unknown';
                  const ts = new Date(ev.timestamp).toLocaleTimeString();
                  return (
                    <motion.div
                      initial={{ opacity: 0, x: 15 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={ev.id}
                      className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/60 hover:bg-slate-800/60 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border capitalize', colorClass)}>
                          {ev.object_type}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono font-bold">{ts}</span>
                      </div>
                      <p className="text-xs text-slate-200 font-bold group-hover:text-blue-400 transition-colors truncate">{camName}</p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" style={{ width: `${Math.min(100, (ev.confidence ?? 0.8) * 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-blue-400 font-mono font-extrabold">{((ev.confidence ?? 0.8) * 100).toFixed(0)}%</span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
