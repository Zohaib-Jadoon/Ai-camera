'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RefreshCw, ShieldAlert, Cpu, Activity, Video } from 'lucide-react';

interface BoundingBox {
  id: string;
  label: string;
  confidence: number;
  x: number; // percentage
  y: number;
  w: number;
  h: number;
  color: string;
}

export default function AIVideoDemo() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [fps, setFps] = useState(30);
  const [boxes, setBoxes] = useState<BoundingBox[]>([
    { id: '1', label: 'PERSON [IDENTIFIED]', confidence: 0.98, x: 22, y: 30, w: 18, h: 48, color: '#38bdf8' },
    { id: '2', label: 'VEHICLE [SPEED: 42KM/H]', confidence: 0.95, x: 55, y: 40, w: 32, h: 36, color: '#818cf8' },
  ]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      // Simulate subtle bounding box jitter & movement
      setBoxes((prev) =>
        prev.map((box) => ({
          ...box,
          x: Math.max(10, Math.min(70, box.x + (Math.random() - 0.5) * 1.5)),
          y: Math.max(15, Math.min(50, box.y + (Math.random() - 0.5) * 1.0)),
          confidence: Math.min(0.99, Math.max(0.91, box.confidence + (Math.random() - 0.5) * 0.02)),
        }))
      );
      setFps(28 + Math.floor(Math.random() * 5));
    }, 200);
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="relative rounded-2xl glass-panel p-3 border border-sky-500/30 shadow-2xl overflow-hidden group">
      {/* Video Simulation Canvas Header */}
      <div className="relative aspect-video rounded-xl bg-slate-950 overflow-hidden border border-white/10 flex items-center justify-center">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
        
        {/* Simulated Camera Feed Backdrop */}
        <div className="absolute inset-0 flex items-center justify-center opacity-40">
          <div className="text-center">
            <Video className="w-12 h-12 text-sky-400 mx-auto mb-2 animate-pulse" />
            <p className="text-xs text-sky-300 font-mono-data uppercase">LIVE CAM #01 • MAIN PLAZA STREAM</p>
          </div>
        </div>

        {/* Animated Bounding Box Overlays */}
        {boxes.map((box) => (
          <div
            key={box.id}
            className="absolute transition-all duration-300 pointer-events-none rounded-lg"
            style={{
              left: `${box.x}%`,
              top: `${box.y}%`,
              width: `${box.w}%`,
              height: `${box.h}%`,
              borderColor: box.color,
              borderWidth: '2px',
              borderStyle: 'solid',
              boxShadow: `0 0 16px ${box.color}40, inset 0 0 12px ${box.color}20`,
            }}
          >
            {/* Box Label Pill */}
            <div
              className="absolute -top-6 left-0 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono-data text-slate-950 shadow-md flex items-center gap-1.5 whitespace-nowrap"
              style={{ backgroundColor: box.color }}
            >
              <span>{box.label}</span>
              <span className="opacity-80">{(box.confidence * 100).toFixed(0)}%</span>
            </div>
            {/* Corner Crosshairs */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-white" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-white" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-white" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-white" />
          </div>
        ))}

        {/* Live HUD Overlay Badges */}
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-emerald-500/40 text-[10px] font-bold text-emerald-400 font-mono-data flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 live-indicator" />
          <span>RTSP LIVE FEED</span>
        </div>

        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-sky-500/40 text-[10px] font-bold text-sky-400 font-mono-data flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5" />
          <span>YOLOv8 • {fps} FPS</span>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex items-center justify-between mt-3 px-2 py-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <span className="text-[11px] text-slate-400 font-mono-data">AI EDGE ENGINE: ACTIVE</span>
        </div>
        <div className="text-[10px] text-sky-400 font-mono-data flex items-center gap-1">
          <Activity className="w-3.5 h-3.5" />
          <span>LATENCY: 42MS</span>
        </div>
      </div>
    </div>
  );
}
