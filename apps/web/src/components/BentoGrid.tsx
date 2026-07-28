'use client';

import { Shield, Eye, Car, Siren, Fingerprint, Flame, Activity, Lock, Users, Radio, Crosshair, Check } from 'lucide-react';

const BENTO_ITEMS = [
  {
    title: 'INSTANT WEAPON RECOGNITION',
    subtitle: '0.5ms Shadow & Silhouette Trigger',
    icon: Siren,
    color: 'from-red-500/20 to-red-950/40 border-red-500/30',
    iconColor: 'text-red-400',
    description: 'Detects handguns, rifles, knives, and metallic reflections in 0.5ms with full-screen red alert vignettes.',
    span: 'col-span-1 md:col-span-2'
  },
  {
    title: 'SMART BOUNDARY CONGESTION',
    subtitle: 'Polygon Threshold Queue Analysis',
    icon: Car,
    color: 'from-amber-500/20 to-amber-950/40 border-amber-500/30',
    iconColor: 'text-amber-400',
    description: 'Custom polygon line thresholds across city roads with vehicle counters and speed telemetry.',
    span: 'col-span-1'
  },
  {
    title: '128-D BIOMETRIC FACIAL REID',
    subtitle: 'Cross-Camera Identity Sync',
    icon: Fingerprint,
    color: 'from-indigo-500/20 to-indigo-950/40 border-indigo-500/30',
    iconColor: 'text-indigo-400',
    description: 'Deep 128-d facial embeddings map individual movement trajectories across multi-camera subnets.',
    span: 'col-span-1'
  },
  {
    title: 'BEHAVIOR & FIGHT DETECTION',
    subtitle: 'Physical Altercation & Fall Detection',
    icon: Flame,
    color: 'from-orange-500/20 to-orange-950/40 border-orange-500/30',
    iconColor: 'text-orange-400',
    description: 'Neural pose estimation flags fist fights, sudden slips, falls, and chaotic crowd movements.',
    span: 'col-span-1 md:col-span-2'
  },
  {
    title: 'ANPR LICENSE PLATE OCR',
    subtitle: 'High-Speed Vehicle Registration',
    icon: Crosshair,
    color: 'from-sky-500/20 to-sky-950/40 border-sky-500/30',
    iconColor: 'text-sky-400',
    description: 'Reads license plates up to 140km/h under rain, fog, or night conditions.',
    span: 'col-span-1'
  },
  {
    title: 'ENCRYPTED RTSP GATEWAY',
    subtitle: 'AES-256 Multi-Stream Security',
    icon: Lock,
    color: 'from-emerald-500/20 to-emerald-950/40 border-emerald-500/30',
    iconColor: 'text-emerald-400',
    description: 'Zero-exposure encrypted RTSP/WebRTC stream ingestion with edge GPU acceleration.',
    span: 'col-span-1 md:col-span-2'
  }
];

export default function BentoGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 font-mono-data">
      {BENTO_ITEMS.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className={`group relative p-6 rounded-2xl border glass-panel bg-gradient-to-br transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl overflow-hidden ${item.color} ${item.span}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl bg-slate-900/80 border border-white/10 ${item.iconColor}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">MODULE #{idx + 1}</span>
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight">{item.title}</h3>
            <p className="text-xs text-sky-400 font-semibold mb-2">{item.subtitle}</p>
            <p className="text-xs text-slate-300 font-sans leading-relaxed">{item.description}</p>
          </div>
        );
      })}
    </div>
  );
}
