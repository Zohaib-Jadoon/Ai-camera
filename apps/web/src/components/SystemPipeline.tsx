'use client';

import { useState } from 'react';
import { Camera, Cpu, Zap, Siren, ArrowRight, ShieldCheck } from 'lucide-react';

const STAGES = [
  {
    id: 1,
    title: 'RTSP STREAM INGESTION',
    icon: Camera,
    color: '#38bdf8',
    detail: 'Hardware accelerated H.264/H.265 RTSP/WebRTC stream decode across 1,000+ IP cameras simultaneously.',
    metrics: '30+ FPS PER STREAM • 0% FRAME DROP'
  },
  {
    id: 2,
    title: 'TENSORRT GPU INFERENCE',
    icon: Cpu,
    color: '#818cf8',
    detail: 'YOLOv8 & DeepSORT models executed on NVIDIA CUDA cores with FP16 precision for sub-millisecond object detection.',
    metrics: '0.42MS LATENCY • 99.8% PRECISION'
  },
  {
    id: 3,
    title: 'SPATIAL-TEMPORAL REASONING',
    icon: Zap,
    color: '#f59e0b',
    detail: 'Cross-camera re-identification (ReID), vehicle boundary line queue tracking, and fight/behavior analysis.',
    metrics: '128D BIOMETRIC MESH • 50+ VEHICLES/SEC'
  },
  {
    id: 4,
    title: 'ZERO-LATENCY ALERT DISPATCH',
    icon: Siren,
    color: '#ef4444',
    detail: 'Instant red vignette visual alerts, automated SMS/WhatsApp alerts to authorities, and audio alarm triggers.',
    metrics: '0.5MS DISPATCH • WEBHOOK READY'
  }
];

export default function SystemPipeline() {
  const [activeStage, setActiveStage] = useState(0);

  return (
    <div className="w-full font-mono-data">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isActive = activeStage === idx;
          return (
            <button
              key={stage.id}
              onClick={() => setActiveStage(idx)}
              className={`relative text-left p-5 rounded-2xl border transition-all duration-300 glass-card group overflow-hidden ${isActive ? 'border-sky-400 bg-sky-500/10 shadow-xl shadow-sky-500/10' : 'border-white/10 hover:border-white/20 bg-slate-900/40'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-slate-950 shadow-md"
                  style={{ backgroundColor: stage.color }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs text-slate-500 font-bold">STAGE 0{stage.id}</span>
              </div>
              <h3 className="text-sm font-bold text-white tracking-wide mb-1">{stage.title}</h3>
              <p className="text-[11px] text-slate-400 font-sans">{stage.metrics}</p>

              {isActive && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-1"
                  style={{ backgroundColor: stage.color }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Stage Detail Card */}
      <div className="p-6 rounded-2xl glass-panel border border-sky-500/30 flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-900/80">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-white">{STAGES[activeStage].title}</h4>
            <p className="text-xs text-slate-300 font-sans mt-1 max-w-2xl leading-relaxed">{STAGES[activeStage].detail}</p>
          </div>
        </div>

        <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-sky-300 whitespace-nowrap">
          {STAGES[activeStage].metrics}
        </div>
      </div>
    </div>
  );
}
