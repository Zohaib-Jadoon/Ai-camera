'use client';

import { useState } from 'react';
import { Filter, Search, Eye, Camera, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDetections, Detection } from '@/hooks/use-api';
import DetectionDetailModal from '@/components/DetectionDetailModal';

const typeColors: Record<string, string> = {
  person: 'text-red-400 bg-red-500/10 border-red-500/20',
  car: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  motorcycle: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  face: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  animal: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  bird: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  truck: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  bus: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

export default function EventsPage() {
  const { data: detections = [], isLoading } = useDetections(100);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);

  const allTypes = ['All', ...Array.from(new Set(detections.map((d: Detection) => d.object_type)))];
  const filtered = detections.filter(
    (e: Detection) =>
      (filter === 'All' || e.object_type === filter) &&
      (e.object_type?.toLowerCase().includes(search.toLowerCase()) ||
        e.camera?.name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Event Center</h1>
        <p className="text-sm text-slate-500">Detection history and AI-captured events</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
            className="w-full bg-slate-900/60 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div className="flex flex-wrap bg-slate-900 border border-slate-800 rounded-lg p-0.5 gap-0.5">
          {allTypes.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-2.5 py-1.5 text-[10px] font-medium rounded-md transition-all capitalize',
                filter === f ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-xl border border-slate-800/60 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-3 border-b border-slate-800/60 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
          <span>Event</span>
          <span>Camera</span>
          <span>Confidence</span>
          <span>Timestamp</span>
          <span></span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-slate-800/30">
            {filtered.map((ev: Detection) => (
              <div
                key={ev.id}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-3 hover:bg-slate-800/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-7 bg-slate-800 rounded flex-shrink-0 flex items-center justify-center">
                    <Camera className="w-3 h-3 text-slate-600" />
                  </div>
                  <div>
                    <span
                      className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded border capitalize',
                        typeColors[ev.object_type] || 'text-slate-400 bg-slate-500/10 border-slate-500/20'
                      )}
                    >
                      {ev.object_type}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-slate-300">{ev.camera?.name || 'Unknown'}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.min(ev.confidence * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {Math.round(ev.confidence * 100)}%
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(ev.timestamp).toLocaleString()}
                </span>
                <button
                  onClick={() => setSelectedDetection(ev)}
                  className="p-1.5 rounded-md hover:bg-slate-700 text-slate-500 hover:text-blue-400"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-xs">No events found</div>
            )}
          </div>
        )}
      </div>

      <DetectionDetailModal
        detection={selectedDetection}
        open={!!selectedDetection}
        onClose={() => setSelectedDetection(null)}
      />
    </div>
  );
}
