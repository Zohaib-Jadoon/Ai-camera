'use client';

import { useEffect, useState } from 'react';
import { Play, Pause, ShieldAlert, Cpu, Activity, Video, Eye, Filter, Zap, Target } from 'lucide-react';

interface BoundingBox {
  id: string;
  label: string;
  confidence: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  category: 'weapon' | 'vehicle' | 'person' | 'face';
}

export default function AIVideoDemo() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [selectedModel, setSelectedModel] = useState<'yolo' | 'reid' | 'traffic'>('yolo');
  const [activeFilter, setActiveFilter] = useState<'all' | 'weapon' | 'vehicle' | 'face'>('all');
  const [fps, setFps] = useState(30);
  const [isThreatSimulated, setIsThreatSimulated] = useState(false);

  const defaultBoxes: BoundingBox[] = [
    { id: '1', label: 'PERSON [ID: #8492]', confidence: 0.98, x: 20, y: 25, w: 22, h: 55, color: '#38bdf8', category: 'person' },
    { id: '2', label: 'FACIAL EMBEDDING 128D', confidence: 0.96, x: 24, y: 28, w: 14, h: 18, color: '#818cf8', category: 'face' },
    { id: '3', label: 'VEHICLE [SPEED: 48KM/H]', confidence: 0.94, x: 54, y: 38, w: 34, h: 42, color: '#f59e0b', category: 'vehicle' },
  ];

  const threatBox: BoundingBox = {
    id: 'threat',
    label: '⚠️ WEAPON DETECTED [GUN]',
    confidence: 0.99,
    x: 26,
    y: 42,
    w: 12,
    h: 14,
    color: '#ef4444',
    category: 'weapon'
  };

  const [boxes, setBoxes] = useState<BoundingBox[]>(defaultBoxes);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setBoxes((prev) =>
        prev.map((box) => ({
          ...box,
          x: Math.max(8, Math.min(68, box.x + (Math.random() - 0.5) * 1.2)),
          y: Math.max(12, Math.min(48, box.y + (Math.random() - 0.5) * 0.8)),
          confidence: Math.min(0.99, Math.max(0.92, box.confidence + (Math.random() - 0.5) * 0.015)),
        }))
      );
      setFps(29 + Math.floor(Math.random() * 4));
    }, 220);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const toggleThreatSimulation = () => {
    if (isThreatSimulated) {
      setIsThreatSimulated(false);
      setBoxes((prev) => prev.filter((b) => b.id !== 'threat'));
    } else {
      setIsThreatSimulated(true);
      setBoxes((prev) => [...prev, threatBox]);
    }
  };

  const filteredBoxes = boxes.filter((box) => {
    if (activeFilter === 'all') return true;
    return box.category === activeFilter;
  });

  return (
    <div className={`relative rounded-2xl glass-panel p-4 border transition-all duration-500 shadow-2xl overflow-hidden group ${isThreatSimulated ? 'border-red-500/80 shadow-red-500/20' : 'border-sky-500/30'}`}>
      
      {/* Red Flash Vignette on Threat Simulation */}
      {isThreatSimulated && (
        <div className="absolute inset-0 bg-red-600/10 pointer-events-none z-20 animate-pulse border-4 border-red-500/60 rounded-2xl" />
      )}

      {/* Model Selection Tabs Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 font-mono-data">
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-white/10 text-xs">
          <button
            onClick={() => setSelectedModel('yolo')}
            className={`px-3 py-1.5 rounded-lg transition-all font-bold ${selectedModel === 'yolo' ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/30' : 'text-slate-400 hover:text-white'}`}
          >
            YOLOv8 THREAT CORE
          </button>
          <button
            onClick={() => setSelectedModel('reid')}
            className={`px-3 py-1.5 rounded-lg transition-all font-bold ${selectedModel === 'reid' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' : 'text-slate-400 hover:text-white'}`}
          >
            BIOMETRIC REID
          </button>
          <button
            onClick={() => setSelectedModel('traffic')}
            className={`px-3 py-1.5 rounded-lg transition-all font-bold ${selectedModel === 'traffic' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30' : 'text-slate-400 hover:text-white'}`}
          >
            TRAFFIC BOUNDARY
          </button>
        </div>

        {/* Threat Test Trigger */}
        <button
          onClick={toggleThreatSimulation}
          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${isThreatSimulated ? 'bg-red-500 text-white border-red-400 animate-pulse' : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'}`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>{isThreatSimulated ? 'THREAT DETECTED' : 'TEST WEAPON TRIGGER'}</span>
        </button>
      </div>

      {/* Video Simulation Canvas */}
      <div className="relative aspect-video rounded-xl bg-slate-950 overflow-hidden border border-white/10 flex items-center justify-center">
        {/* Background Radial Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:20px_20px] opacity-15" />
        
        {/* Simulated Camera Feed Backdrop Label */}
        <div className="absolute inset-0 flex items-center justify-center opacity-30">
          <div className="text-center">
            <Video className="w-14 h-14 text-sky-400 mx-auto mb-2 animate-pulse" />
            <p className="text-xs text-sky-300 font-mono-data tracking-widest uppercase">CAM-04 • ISLAMABAD EXECUTIVE CORRIDOR</p>
          </div>
        </div>

        {/* Animated Bounding Box Overlays */}
        {filteredBoxes.map((box) => (
          <div
            key={box.id}
            className="absolute transition-all duration-300 pointer-events-none rounded-lg"
            style={{
              left: `${box.x}%`,
              top: `${box.y}%`,
              width: `${box.w}%`,
              height: `${box.h}%`,
              borderColor: box.color,
              borderWidth: box.id === 'threat' ? '3px' : '2px',
              borderStyle: 'solid',
              boxShadow: `0 0 20px ${box.color}60, inset 0 0 14px ${box.color}25`,
            }}
          >
            {/* Box Label Pill */}
            <div
              className="absolute -top-7 left-0 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono-data text-slate-950 shadow-lg flex items-center gap-1.5 whitespace-nowrap"
              style={{ backgroundColor: box.color }}
            >
              <span>{box.label}</span>
              <span className="opacity-80">{(box.confidence * 100).toFixed(0)}%</span>
            </div>

            {/* Target Reticle Crosshairs */}
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-white" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-white" />
            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-white" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-white" />
          </div>
        ))}

        {/* Live Status Overlay Badges */}
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-emerald-500/40 text-[10px] font-bold text-emerald-400 font-mono-data flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 live-indicator" />
          <span>RTSP STREAM LIVE</span>
        </div>

        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-sky-500/40 text-[10px] font-bold text-sky-400 font-mono-data flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-sky-400" />
          <span>TENSORRT • {fps} FPS</span>
        </div>
      </div>

      {/* Bottom Control & Class Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3 px-1 pt-1 font-mono-data">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <span className="text-xs text-slate-300 font-semibold">TENSOR CORE LATENCY: 0.42MS</span>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
          {(['all', 'weapon', 'vehicle', 'face'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-2 py-0.5 rounded capitalize transition-all ${activeFilter === filter ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40' : 'hover:text-slate-200'}`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
