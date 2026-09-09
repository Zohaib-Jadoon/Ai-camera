'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings, Maximize2, Minimize2, Scan,
  ShieldAlert, Info, WifiOff, Volume2, VolumeX,
  RotateCcw, ZoomIn, Camera, Loader2, Download, Eye, Layers,
  LayoutGrid, Grid
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useCameras, useDetections } from '@/hooks/use-api';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket';
import EngineHealthBanner from '@/components/EngineHealthBanner';

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
  visible: { opacity: 1 },
};

function CameraFeed({
  cameraId,
  isOnline,
  refreshTrigger,
  isZoomed,
  fitMode = 'contain',
  onFrameUpdate
}: {
  cameraId: string;
  isOnline: boolean;
  refreshTrigger: number;
  isZoomed: boolean;
  fitMode?: 'contain' | 'cover';
  onFrameUpdate?: (cameraId: string, dataUrl: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [hasFrame, setHasFrame] = useState(false);
  const hasFrameRef = useRef(false);
  const [fps, setFps] = useState<number>(0);
  const [stalled, setStalled] = useState(false);
  const frameCountRef = useRef<number>(0);
  const lastFpsCalcRef = useRef<number>(Date.now());
  const onFrameUpdateRef = useRef(onFrameUpdate);

  useEffect(() => {
    onFrameUpdateRef.current = onFrameUpdate;
  }, [onFrameUpdate]);

  useEffect(() => {
    setHasFrame(false);
    hasFrameRef.current = false;
    setFps(0);
    setStalled(false);
    frameCountRef.current = 0;
    lastFpsCalcRef.current = performance.now();
    if (imgRef.current) imgRef.current.removeAttribute('src');
    if (!isOnline) {
      setHasFrame(false);
      hasFrameRef.current = false;
      return;
    }

    const socket = getSocket();
    let pendingFrame: string | null = null;
    let renderRequest: number | null = null;
    let lastReceivedAt = performance.now();

    const markDisconnected = () => {
      setStalled(true);
      setFps(0);
      pendingFrame = null;
      if (renderRequest !== null) cancelAnimationFrame(renderRequest);
      renderRequest = null;
    };

    const joinRoom = () => {
      socket.emit('join-camera', cameraId);
    };

    if (socket.connected) {
      joinRoom();
    }
    socket.on('connect', joinRoom);
    socket.on('disconnect', markDisconnected);

    const healthTimer = window.setInterval(() => {
      if (performance.now() - lastReceivedAt > 5000) {
        setStalled(true);
        setFps(0);
      }
    }, 1000);

    const renderLatestFrame = () => {
      renderRequest = null;
      if (pendingFrame === null || !imgRef.current) return;
      imgRef.current.src = pendingFrame;
      pendingFrame = null;
      frameCountRef.current += 1;
      if (!hasFrameRef.current) {
        hasFrameRef.current = true;
        setHasFrame(true);
      }
      const now = performance.now();
      const elapsed = now - lastFpsCalcRef.current;
      if (elapsed >= 1000) {
        setFps(Math.round(frameCountRef.current * 1000 / elapsed));
        frameCountRef.current = 0;
        lastFpsCalcRef.current = now;
      }
    };

    const onFrame = (payload: { camera_id: string; data: string }) => {
      if (payload.camera_id !== cameraId) return;
      lastReceivedAt = performance.now();
      setStalled(false);
      pendingFrame = `data:image/jpeg;base64,${payload.data}`;
      if (renderRequest === null) renderRequest = requestAnimationFrame(renderLatestFrame);
    };

    socket.on('frame', onFrame);

    return () => {
      socket.off('connect', joinRoom);
      socket.off('disconnect', markDisconnected);
      socket.off('frame', onFrame);
      socket.emit('leave-camera', cameraId);
      window.clearInterval(healthTimer);
      if (renderRequest !== null) cancelAnimationFrame(renderRequest);
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

  return (
    <>
      {!hasFrame && !stalled && (
        <div className="flex flex-col items-center gap-3 text-slate-400 p-6 text-center absolute inset-0 justify-center z-10">
          <Loader2 className="w-9 h-9 animate-spin text-blue-400/80" />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Connecting Feed...</span>
            <span className="text-[11px] text-slate-500">Waiting for live video frames</span>
          </div>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        alt="Live camera feed"
        className={cn(
          "absolute inset-0 w-full h-full transition-transform duration-300 pointer-events-none select-none",
          fitMode === 'cover' ? "object-cover" : "object-contain",
          isZoomed ? "scale-150 z-20" : "scale-100",
          !hasFrame ? "opacity-0" : "opacity-100"
        )}
      />
      {stalled && (
        <div role="status" aria-live="polite" className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 bg-slate-950/85 px-6 text-center">
          <WifiOff className="h-6 w-6 text-amber-400" />
          <span className="text-sm font-semibold text-amber-200">Live feed interrupted</span>
          <span className="text-xs text-slate-300">{hasFrame ? 'The image behind this notice is an older frame.' : 'No recent frames received.'} Waiting for video to resume.</span>
        </div>
      )}

      {/* Live FPS Badge */}
      {fps > 0 && !stalled && (
        <div className="absolute bottom-3 right-3 z-40 bg-slate-950/80 backdrop-blur-md border border-slate-800 px-2 py-0.5 rounded text-[10px] font-mono font-semibold text-emerald-400 flex items-center gap-1 shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {fps} display updates/s
        </div>
      )}
    </>
  );
}

export default function LiveMonitoring() {
  const router = useRouter();
  const [layout, setLayout] = useState<'auto' | '1x1' | '2x2' | '3x2' | '1+3'>('auto');
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');
  const [selectedCam, setSelectedCam] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [refreshTriggers, setRefreshTriggers] = useState<Record<string, number>>({});
  const [zoomedCams, setZoomedCams] = useState<Record<string, boolean>>({});
  const [showEventSidebar, setShowEventSidebar] = useState(true);
  const qc = useQueryClient();
  const [activeThreats, setActiveThreats] = useState<Record<string, { active: boolean; type: string; message: string }>>({});
  const threatTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const { data: rawCameras = [], isLoading: camsLoading } = useCameras();
  const { data: initialEvents = [] } = useDetections(30);
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [liveCamCounts, setLiveCamCounts] = useState<Record<string, number>>({});

  // Play urgent multi-burst emergency siren
  const playThreatSiren = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      [0, 0.55, 1.1].forEach((startOffset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime + startOffset);
        osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + startOffset + 0.2);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + startOffset + 0.45);
        gain.gain.setValueAtTime(0, ctx.currentTime + startOffset);
        gain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + startOffset + 0.05);
        gain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + startOffset + 0.4);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startOffset + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + startOffset);
        osc.stop(ctx.currentTime + startOffset + 0.5);
      });
    } catch {}
  }, []);

  const clearThreat = useCallback((camId: string) => {
    if (threatTimers.current[camId]) {
      clearTimeout(threatTimers.current[camId]);
      delete threatTimers.current[camId];
    }
    setActiveThreats(prev => ({ ...prev, [camId]: { active: false, type: '', message: '' } }));
  }, []);

  const triggerThreat = useCallback((camId: string, objType: string, threatMsg: string) => {
    if (!camId) return;
    setActiveThreats(prev => ({ ...prev, [camId]: { active: true, type: objType.toUpperCase(), message: threatMsg } }));
    if (!muted) playThreatSiren();
    if (threatTimers.current[camId]) {
      clearTimeout(threatTimers.current[camId]);
    }
    threatTimers.current[camId] = setTimeout(() => {
      clearThreat(camId);
    }, 4500);
  }, [muted, playThreatSiren, clearThreat]);

  useEffect(() => {
    if (initialEvents && initialEvents.length > 0) {
      setLiveEvents(prev => {
        const seen = new Set<string>();
        const merged: any[] = [];
        for (const ev of [...prev, ...initialEvents]) {
          if (ev && ev.id) {
            if (!seen.has(ev.id)) {
              seen.add(ev.id);
              merged.push(ev);
            }
          } else if (ev) {
            merged.push(ev);
          }
        }
        return merged.slice(0, 50);
      });
    }
  }, [initialEvents]);

  // Real-time camera status and threat alert WebSocket listeners
  useEffect(() => {
    const socket = getSocket();

    const statusHandler = (payload: { camera_id: string; status: string }) => {
      qc.setQueryData<import('@/hooks/use-api').Camera[]>(['cameras'], (old) => {
        if (!old) return old;
        return old.map((cam) =>
          cam.id === payload.camera_id ? { ...cam, status: payload.status } : cam
        );
      });
    };

    const alertHandler = (payload: any) => {
      const objType = (payload.object_type || payload.alert_type || '').toUpperCase();
      const isThreat = ['INTRUSION', 'WEAPON', 'KNIFE', 'GUN', 'FIGHT', 'FALL', 'SCISSORS',
        'HANDGUN', 'PISTOL', 'RIFLE', 'FIREARM', 'SWORD', 'AXE', 'BAT', 'BASEBALL BAT',
        'BLADE', 'DAGGER', 'MACHETE', 'FIRE', 'FLAME', 'SMOKE', 'LIGHTER', 'FIRE_DETECTED',
        'CONGESTION', 'TRAFFIC', 'WEAPON_DETECTED', 'FIGHT_DETECTED', 'FALL_DETECTED'
      ].some(t => objType.includes(t));

      if (isThreat && payload.camera_id) {
        triggerThreat(payload.camera_id, objType, payload.message || `⚠️ ${objType} Detected`);
      }
    };

    const threatHandler = (payload: any) => {
      const objType = (payload.object_type || (payload.alert_type === 'FIRE_DETECTED' ? 'FIRE' : 'WEAPON')).toUpperCase();
      const isFire = ['FIRE', 'FLAME', 'SMOKE', 'LIGHTER', 'FIRE_DETECTED'].some(t => objType.includes(t));
      triggerThreat(payload.camera_id, objType, payload.message || (isFire ? `🔥 CRITICAL: FIRE DETECTED` : `⚠️ CRITICAL: ${objType} DETECTED`));
    };

    const congestionHandler = (payload: any) => {
      const level = (payload.level || 'HEAVY').toUpperCase();
      triggerThreat(payload.camera_id, `CONGESTION_${level}`, `⚠️ TRAFFIC CONGESTION: ${payload.zone_name || 'Zone'} (${payload.vehicle_count || 0} vehicles)`);
    };

    const intrusionHandler = (payload: any) => {
      triggerThreat(payload.camera_id, 'INTRUSION', `⚠️ ZONE INTRUSION: ${payload.zone_name || 'Zone'} by ${payload.object_type || 'object'}`);
    };

    const safetyHandler = (payload: any) => {
      const evtType = (payload.event_type || 'SAFETY_VIOLATION').toUpperCase();
      triggerThreat(payload.camera_id, evtType, `⚠️ SAFETY EVENT: ${evtType}`);
    };

    const handleIncomingDetection = (payload: any) => {
      if (!payload) return;
      const camId = payload.camera_id;
      const objType = (payload.object_type || payload.alert_type || 'object').toLowerCase();
      const newEv = {
        id: payload.detection_id || payload.id || `live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        camera_id: camId,
        camera: rawCameras.find(c => c.id === camId) || { name: camId?.slice(0, 8) || 'Camera' },
        object_type: objType,
        confidence: payload.confidence ?? 0.85,
        timestamp: payload.timestamp || new Date().toISOString(),
      };

      setLiveEvents(prev => {
        const filtered = prev.filter(e => e.id !== newEv.id);
        return [newEv, ...filtered].slice(0, 50);
      });
      if (camId) {
        setLiveCamCounts(prev => ({
          ...prev,
          [camId]: (prev[camId] ?? 0) + 1,
        }));
      }
    };

    const onAlert = (payload: any) => {
      alertHandler(payload);
      handleIncomingDetection(payload);
    };

    const onThreatAlert = (payload: any) => {
      threatHandler(payload);
      handleIncomingDetection(payload);
    };

    socket.on('camera_status', statusHandler);
    socket.on('alert', onAlert);
    socket.on('threat_alert', onThreatAlert);
    socket.on('detection', handleIncomingDetection);
    socket.on('congestion', congestionHandler);
    socket.on('intrusion', intrusionHandler);
    socket.on('safety_event', safetyHandler);

    return () => {
      socket.off('camera_status', statusHandler);
      socket.off('alert', onAlert);
      socket.off('threat_alert', onThreatAlert);
      socket.off('detection', handleIncomingDetection);
      socket.off('congestion', congestionHandler);
      socket.off('intrusion', intrusionHandler);
      socket.off('safety_event', safetyHandler);
      Object.values(threatTimers.current).forEach(clearTimeout);
    };
  }, [qc, muted, playThreatSiren, clearThreat, triggerThreat, rawCameras]);

  // IMMUTABLE CAMERA SORTING: Guarantees cameras NEVER swap positions or move when alerts occur
  const cameras = useMemo(() => {
    return [...rawCameras].sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (timeA !== timeB) return timeA - timeB;
      }
      const nameComp = (a.name || '').localeCompare(b.name || '');
      if (nameComp !== 0) return nameComp;
      return (a.id || '').localeCompare(b.id || '');
    });
  }, [rawCameras]);

  // Set default selected camera
  useEffect(() => {
    if (cameras.length > 0 && !selectedCam) {
      setSelectedCam(cameras[0].id);
    }
  }, [cameras, selectedCam]);

  const gridClass = {
    'auto': cameras.length <= 1
      ? 'grid-cols-1'
      : cameras.length === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : cameras.length <= 4
      ? 'grid-cols-1 md:grid-cols-2'
      : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
    '1x1': 'grid-cols-1',
    '2x2': 'grid-cols-1 md:grid-cols-2',
    '3x2': 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
    '1+3': 'grid-cols-1 lg:grid-cols-4',
  };

  const detectionsByCam = useMemo(() => {
    return (initialEvents as any[]).reduce<Record<string, number>>((acc, ev) => {
      if (ev.camera_id) {
        acc[ev.camera_id] = (acc[ev.camera_id] ?? 0) + 1;
      }
      return acc;
    }, {});
  }, [initialEvents]);

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
    const container = document.getElementById(`cam-card-${camId}`);
    const img = container?.querySelector('img') as HTMLImageElement | null;
    const dataUrl = img?.src;
    if (!dataUrl || !dataUrl.startsWith('data:')) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `snapshot-${camName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.jpg`;
    a.click();
  };

  // Double click toggles between single camera focus (1x1) and multi-camera grid
  const handleCardDoubleClick = (camId: string) => {
    if (layout === '1x1') {
      setLayout('auto');
    } else {
      setSelectedCam(camId);
      setLayout('1x1');
    }
  };

  const displayedCameras = useMemo(() => {
    if (layout === '1x1') {
      const found = cameras.find(c => c.id === selectedCam);
      return found ? [found] : (cameras[0] ? [cameras[0]] : []);
    }
    return cameras;
  }, [layout, cameras, selectedCam]);

  return (
    <div className="h-full flex flex-col gap-4">
      <EngineHealthBanner />

      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0 bg-slate-900/40 backdrop-blur-md border border-slate-800/80 p-4 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Live <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400">Monitoring</span>
            </h1>
          </div>
          <p className="text-slate-400 font-medium text-xs sm:text-sm mt-1">
            {camsLoading ? 'Loading cameras...' : `${cameras.filter((c) => c.status === 'ONLINE').length} of ${cameras.length} cameras online`}
            {layout === '1x1' && selectedCam && (
              <span className="ml-2 text-blue-400 font-bold">• Single Focus Mode (Double-click feed to return)</span>
            )}
          </p>
        </div>

        {/* Toolbar controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Layout Switcher */}
          <div className="flex bg-slate-950/90 border border-slate-800/90 rounded-xl p-1 shadow-inner">
            {(['auto', '1x1', '2x2', '3x2', '1+3'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLayout(l)}
                className={cn(
                  'px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 capitalize',
                  layout === l ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                )}
                title={`Switch to ${l} layout`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Aspect Fit/Fill Toggle */}
          <button
            onClick={() => setFitMode(prev => prev === 'contain' ? 'cover' : 'contain')}
            className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800/90 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors shadow-inner flex items-center gap-1.5"
            title={fitMode === 'contain' ? "Fit Mode: Entire image visible (letterboxed). Click to Fill" : "Fill Mode: Crops edges to fill card. Click to Fit"}
          >
            <Scan className="w-3.5 h-3.5 text-blue-400" />
            <span className="capitalize">{fitMode}</span>
          </button>

          {/* Audio Alert Toggle */}
          <button
            onClick={() => setMuted(!muted)}
            className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/90 text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors shadow-inner"
            title={muted ? 'Unmute Audio Alerts' : 'Mute Audio Alerts'}
          >
            {muted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5 text-blue-400" />}
          </button>

          {/* Toggle Sidebar */}
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
        </div>
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
          <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
            {/* 1x1 Quick Switcher Bar */}
            {layout === '1x1' && (
              <div className="flex items-center gap-2 overflow-x-auto py-1 px-2 bg-slate-900/60 backdrop-blur-md rounded-xl border border-slate-800/80 flex-shrink-0">
                <button
                  onClick={() => setLayout('auto')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Return to Grid Layout"
                >
                  <Minimize2 className="w-3.5 h-3.5 text-blue-400" /> Grid View
                </button>
                <div className="h-4 w-[1px] bg-slate-700 mx-1" />
                {cameras.map((cam) => {
                  const isCurrent = (selectedCam || cameras[0]?.id) === cam.id;
                  const threatInfo = activeThreats[cam.id];
                  return (
                    <button
                      key={cam.id}
                      onClick={() => setSelectedCam(cam.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                        threatInfo?.active
                          ? "bg-red-600 text-white animate-pulse shadow-lg shadow-red-600/40"
                          : isCurrent
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                          : "bg-slate-950/70 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60"
                      )}
                    >
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        threatInfo?.active ? "bg-white" : cam.status === 'ONLINE' ? "bg-emerald-400" : "bg-red-500"
                      )} />
                      {cam.name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Grid Container */}
            <div className={cn('flex-1 grid gap-4 overflow-y-auto pr-1 scrollbar-hide', gridClass[layout])}>
              {displayedCameras.map((cam) => {
                const isOnline = cam.status === 'ONLINE';
                const threatInfo = activeThreats[cam.id];
                const isThreatActive = !!threatInfo?.active;
                const detCount = (detectionsByCam[cam.id] ?? 0) + (liveCamCounts[cam.id] ?? 0);
                const isHero = layout === '1+3' && cam.id === (selectedCam || cameras[0]?.id);
                const isSelected = selectedCam === cam.id;

                return (
                  <div
                    key={cam.id}
                    id={`cam-card-${cam.id}`}
                    onClick={() => setSelectedCam(cam.id)}
                    onDoubleClick={() => handleCardDoubleClick(cam.id)}
                    className={cn(
                      'relative rounded-2xl overflow-hidden cursor-pointer group flex flex-col',
                      'border shadow-2xl bg-slate-950 select-none transition-colors duration-200',
                      isThreatActive
                        ? 'border-red-500 ring-4 ring-red-600/80 shadow-[0_0_40px_rgba(239,68,68,0.7)]'
                        : isSelected
                        ? 'border-blue-500/80 ring-2 ring-blue-500/50'
                        : 'border-slate-800/80 hover:border-slate-700',
                      isHero ? 'lg:col-span-3 lg:row-span-3' : '',
                      !isOnline ? 'opacity-75' : ''
                    )}
                  >
                    {/* Video Canvas Container */}
                    <div className={cn(
                      "w-full flex items-center justify-center relative bg-black overflow-hidden",
                      layout === '1x1' ? "flex-1 min-h-[420px] aspect-auto" : "aspect-video"
                    )}>
                      <CameraFeed
                        cameraId={cam.id}
                        isOnline={isOnline}
                        refreshTrigger={refreshTriggers[cam.id] ?? 0}
                        isZoomed={!!zoomedCams[cam.id]}
                        fitMode={fitMode}
                      />

                      {/* Floating Threat Alert Banner at top with dismiss button */}
                      {isThreatActive && (
                        <>
                          <div className="absolute inset-0 pointer-events-none z-20 bg-red-600/15 border-[4px] border-red-600 animate-pulse shadow-[inset_0_0_50px_rgba(239,68,68,0.7)]" />
                          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
                            <div className="bg-red-600/95 text-white font-black text-xs px-3.5 py-1.5 rounded-xl border border-red-400 shadow-2xl flex items-center gap-2.5 backdrop-blur-md">
                              <ShieldAlert className="w-4 h-4 text-white animate-pulse flex-shrink-0" />
                              <span className="tracking-wide uppercase whitespace-nowrap">CRITICAL: {threatInfo?.type || 'THREAT'}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearThreat(cam.id);
                                }}
                                className="ml-1.5 px-2 py-0.5 bg-red-800/90 hover:bg-red-700 text-white rounded text-[10px] font-bold border border-red-400/60 transition-colors shadow flex items-center gap-1"
                                title="Dismiss threat alert"
                              >
                                ✕ Dismiss
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Top Status & Overlay Header */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-40 pointer-events-none">
                      <div className="flex items-center gap-2">
                        {isThreatActive ? (
                          <>
                            <span className="flex items-center gap-1.5 bg-red-600 border border-red-400 text-white text-[10px] font-black px-3 py-1 rounded-md shadow-xl animate-bounce">
                              <ShieldAlert className="w-3.5 h-3.5" /> ⚠ {threatInfo?.type || 'THREAT'}
                            </span>
                            {threatInfo?.message && (
                              <span className="text-[9px] font-bold text-red-100 bg-red-900/80 backdrop-blur-sm border border-red-500/50 px-2 py-0.5 rounded max-w-[160px] truncate">
                                {threatInfo.message}
                              </span>
                            )}
                          </>
                        ) : isOnline ? (
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

                      {/* Interactive Controls bar */}
                      <div className="flex items-center gap-1.5 pointer-events-auto">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCardDoubleClick(cam.id);
                          }}
                          className="w-8 h-8 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-blue-600 transition-all shadow-lg"
                          title={layout === '1x1' ? "Return to Grid (or Double Click)" : "Focus Single Camera (or Double Click)"}
                        >
                          {layout === '1x1' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={(e) => handleFullscreen(e, cam.id)}
                          className="w-8 h-8 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-blue-600 transition-all shadow-lg"
                          title="Full Screen Window"
                        >
                          <Scan className="w-3.5 h-3.5" />
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
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Live Event Sidebar */}
        {showEventSidebar && (
          <div className="w-80 flex flex-col bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-800/80 overflow-hidden flex-shrink-0 shadow-2xl">
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
              {liveEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500 py-12 text-center">
                  <ShieldAlert className="w-8 h-8 opacity-40 text-slate-600" />
                  <p className="text-xs font-medium">No live AI detections yet</p>
                </div>
              ) : (
                liveEvents.map((ev, idx) => {
                  const colorClass = TYPE_COLORS[ev.object_type] ?? 'text-slate-400 bg-slate-800/50 border-slate-700';
                  const camName = ev.camera?.name ?? ev.camera_id?.slice(0, 8) ?? 'Unknown';
                  const ts = new Date(ev.timestamp).toLocaleTimeString();
                  const eventKey = `${ev.id || 'ev'}-${idx}`;
                  return (
                    <div
                      key={eventKey}
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
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
