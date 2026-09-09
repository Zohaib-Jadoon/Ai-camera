'use client';
import { runUiAction } from '@/lib/ui-action';

/**
 * Zone Editor — Frigate-inspired canvas-based zone drawing on the live feed.
 *
 * Workflow:
 *  1. Select a camera from the left panel → live feed appears.
 *  2. Press "Draw Zone" → canvas enters draw mode (crosshair cursor).
 *  3. Click polygon vertices on the live frame.
 *  4. Click the first point (glows cyan) to close and save.
 *  5. The zone is persisted via the API → AI Engine picks it up on next sync.
 *  6. Existing zones are drawn as dashed overlays. Vertices are draggable.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Map, Plus, Trash2, Camera, Loader2, Pencil, X,
  ShieldAlert, Activity, RefreshCw, Eye, EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useZones, useCreateZone, useDeleteZone, useUpdateZone, useCameras } from '@/hooks/use-api';
import { getSocket } from '@/lib/socket';
import { colorForRule, type Point, type ZonePolygon } from '@/components/zones/ZoneCanvas';

// Dynamically import the Konva canvas — avoids SSR window errors
const ZoneCanvas = dynamic(() => import('@/components/zones/ZoneCanvas'), { ssr: false });

// ── rule types ────────────────────────────────────────────────────────────────

const RULE_TYPES = [
  { value: 'intrusion',     label: 'Intrusion',      desc: 'Alert when object enters the zone' },
  { value: 'loitering',     label: 'Loitering',      desc: 'Alert when object stays > threshold' },
  { value: 'line_crossing', label: 'Line Crossing',  desc: 'Alert on direction-aware boundary cross' },
  { value: 'perimeter',     label: 'Perimeter',      desc: 'Outer security boundary' },
];

// ── main component ────────────────────────────────────────────────────────────

export default function ZonesPage() {
  const { data: zones = [], isLoading } = useZones();
  const { data: cameras = [] } = useCameras();
  const createZone = useCreateZone();
  const deleteZone = useDeleteZone();
  const updateZone = useUpdateZone?.();          // may not exist yet — graceful fallback

  // Selected camera for the live canvas
  const [selectedCamId, setSelectedCamId] = useState<string | null>(null);
  const selectedCam = cameras.find((c) => c.id === selectedCamId) ?? null;

  // Live frame from AI Engine via Socket.IO
  const [frameSrc, setFrameSrc] = useState<string | null>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [newRuleType, setNewRuleType] = useState('intrusion');
  const [newZoneName, setNewZoneName] = useState('');
  const [showZones, setShowZones] = useState(true);
  const [pendingPoints, setPendingPoints] = useState<Point[] | null>(null);

  // Join / leave camera Socket.IO room when selection changes
  useEffect(() => {
    setFrameSrc(null);
    if (!selectedCamId) return;

    const socket = getSocket();
    socket.emit('join-camera', selectedCamId);

    const onFrame = (payload: { camera_id: string; data: string }) => {
      if (payload.camera_id !== selectedCamId) return;
      setFrameSrc(`data:image/jpeg;base64,${payload.data}`);
    };

    socket.on('frame', onFrame);
    return () => {
      socket.off('frame', onFrame);
      socket.emit('leave-camera', selectedCamId);
    };
  }, [selectedCamId]);

  // Build ZonePolygon overlay list for the canvas
  const camZones: ZonePolygon[] = zones
    .filter((z) => z.camera_id === selectedCamId && showZones)
    .map((z) => ({
      id: z.id,
      name: z.name ?? z.rule_type,
      rule_type: z.rule_type,
      // polygon_points is stored as [[x,y],…] normalised
      points: (z.polygon_points as Point[]) ?? [],
      color: colorForRule(z.rule_type),
    }));

  // Called by ZoneCanvas when user closes a polygon
  const handleZoneComplete = useCallback(
    (points: Point[]) => {
      setPendingPoints(points);
      setIsDrawing(false);
    },
    [],
  );

  // Save pending zone
  const handleSaveZone = async () => {
    if (!pendingPoints || !selectedCamId) return;
    await createZone.mutateAsync({
      camera_id: selectedCamId,
      rule_type: newRuleType,
      name: newZoneName || undefined,
      polygon_points: pendingPoints,
    });
    setPendingPoints(null);
    setNewZoneName('');
  };

  // Vertex drag — update zone polygon
  const handleZoneUpdate = useCallback(
    async (zoneId: string, points: Point[]) => {
      if (!updateZone) return;
      updateZone.mutate({ id: zoneId, polygon_points: points });
    },
    [updateZone],
  );

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Zone <span className="text-gradient">Editor</span>
          </h1>
          <p className="text-slate-400 text-sm font-medium mt-0.5">
            Draw intrusion zones directly on the live camera feed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">
            {zones.length} zone{zones.length !== 1 ? 's' : ''} total
          </span>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* ── Left panel: camera list ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-64 flex-shrink-0 flex flex-col gap-3"
        >
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
            Select Camera
          </p>
          <div className="flex flex-col gap-1.5 overflow-y-auto">
            {cameras.map((cam) => {
              const zoneCount = zones.filter((z) => z.camera_id === cam.id).length;
              const isSelected = cam.id === selectedCamId;
              return (
                <button
                  key={cam.id}
                  onClick={() => { setSelectedCamId(cam.id); setIsDrawing(false); setPendingPoints(null); }}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500/50 ring-1 ring-blue-500/30'
                      : 'bg-slate-900/60 border-slate-800/60 hover:border-slate-700',
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    cam.status === 'ONLINE' ? 'bg-emerald-500/20' : 'bg-slate-800',
                  )}>
                    <Camera className={cn('w-4 h-4', cam.status === 'ONLINE' ? 'text-emerald-400' : 'text-slate-600')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{cam.name}</p>
                    <p className="text-xs text-slate-500 truncate">{cam.location ?? '—'}</p>
                  </div>
                  {zoneCount > 0 && (
                    <span className="text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-md">
                      {zoneCount}
                    </span>
                  )}
                </button>
              );
            })}
            {cameras.length === 0 && (
              <p className="text-xs text-slate-600 p-3">No cameras configured</p>
            )}
          </div>

          {/* Zone list for selected camera */}
          {selectedCamId && (
            <div className="mt-2 flex flex-col gap-1">
              <div className="flex items-center justify-between px-1 mb-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Zones</p>
                <button
                  onClick={() => setShowZones((v) => !v)}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                  title={showZones ? 'Hide overlays' : 'Show overlays'}
                >
                  {showZones ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>
              {zones.filter((z) => z.camera_id === selectedCamId).map((zone) => (
                <div
                  key={zone.id}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: colorForRule(zone.rule_type) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{zone.name ?? zone.rule_type}</p>
                    <p className="text-[10px] text-slate-500 capitalize">{zone.rule_type}</p>
                  </div>
                  <button
                    onClick={() => deleteZone.mutate(zone.id)}
                    disabled={deleteZone.isPending}
                    className="text-slate-600 hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {zones.filter((z) => z.camera_id === selectedCamId).length === 0 && (
                <p className="text-[11px] text-slate-600 px-1">No zones on this camera</p>
              )}
            </div>
          )}
        </motion.div>

        {/* ── Main canvas area ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 flex flex-col gap-3 min-w-0"
        >
          {!selectedCamId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 glass-card rounded-2xl border border-slate-800/60">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center border border-slate-800">
                <Map className="w-8 h-8 text-slate-700" />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold">Select a Camera</p>
                <p className="text-slate-500 text-sm mt-1">Choose a camera from the left to start drawing zones</p>
              </div>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {/* Rule type selector */}
                <div className="flex bg-slate-900/80 border border-slate-800/60 rounded-xl p-1 gap-1">
                  {RULE_TYPES.map((rt) => (
                    <button
                      key={rt.value}
                      onClick={() => setNewRuleType(rt.value)}
                      title={rt.desc}
                      className={cn(
                        'px-3 py-1.5 text-xs font-bold rounded-lg transition-all',
                        newRuleType === rt.value
                          ? 'text-white shadow-md'
                          : 'text-slate-500 hover:text-white',
                      )}
                      style={newRuleType === rt.value ? { background: colorForRule(rt.value) } : {}}
                    >
                      {rt.label}
                    </button>
                  ))}
                </div>

                {/* Zone name */}
                <input
                  type="text"
                  placeholder="Zone name (optional)"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-900/80 border border-slate-800/60 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 w-44"
                />

                <div className="ml-auto flex items-center gap-2">
                  {isDrawing ? (
                    <button
                      onClick={() => { setIsDrawing(false); }}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  ) : (
                    <button
                      onClick={() => { setPendingPoints(null); setIsDrawing(true); }}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg shadow-blue-600/20"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Draw Zone
                    </button>
                  )}
                </div>
              </div>

              {/* Pending zone save bar */}
              <AnimatePresence>
                {pendingPoints && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10"
                  >
                    <Activity className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <p className="text-xs text-emerald-300 flex-1">
                      Zone drawn with <strong>{pendingPoints.length} vertices</strong>.
                      Give it a name and save, or draw again.
                    </p>
                    <button
                      onClick={() => runUiAction(handleSaveZone)}
                      disabled={createZone.isPending}
                      className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-60"
                    >
                      {createZone.isPending ? 'Saving…' : 'Save Zone'}
                    </button>
                    <button
                      onClick={() => setPendingPoints(null)}
                      className="text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Live canvas */}
              <div className="flex-1 relative rounded-2xl overflow-hidden border border-slate-800/60 bg-slate-950 min-h-[320px]">
                {/* Status badges */}
                <div className="absolute top-3 left-3 z-20 flex items-center gap-2 pointer-events-none">
                  {selectedCam?.status === 'ONLINE' ? (
                    <span className="flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm border border-red-500/50 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-md">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/50 text-slate-400 text-[10px] font-extrabold px-2.5 py-1 rounded-md">
                      OFFLINE
                    </span>
                  )}
                  {isDrawing && (
                    <span className="flex items-center gap-1.5 bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 text-[10px] font-extrabold px-2.5 py-1 rounded-md backdrop-blur-sm">
                      <Pencil className="w-3 h-3" /> DRAWING
                    </span>
                  )}
                </div>

                {/* Canvas */}
                {frameSrc ? (
                  <ZoneCanvas
                    frameSrc={frameSrc}
                    existingZones={camZones}
                    isDrawing={isDrawing}
                    onZoneComplete={handleZoneComplete}
                    onZoneUpdate={handleZoneUpdate}
                    drawColor={colorForRule(newRuleType)}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    {selectedCam?.status === 'ONLINE' ? (
                      <>
                        <Loader2 className="w-8 h-8 text-blue-500/50 animate-spin" />
                        <p className="text-xs text-slate-500">Waiting for live frame…</p>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-10 h-10 text-slate-700" />
                        <p className="text-sm text-slate-500">Camera is offline</p>
                        <p className="text-xs text-slate-600">Zone drawing is available when camera is online</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
