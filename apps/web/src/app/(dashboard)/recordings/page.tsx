'use client';

import { useState } from 'react';
import { Video, Download, Clock, Calendar, Loader2, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRecordings, useDownloadRecording } from '@/hooks/use-api';

function formatBytes(bytes: number | null) {
  if (!bytes) return '-';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDuration(sec: number | null) {
  if (!sec) return '-';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function RecordingsPage() {
  const { data: recordings = [], isLoading } = useRecordings();
  const download = useDownloadRecording();
  const [filter, setFilter] = useState('all');

  const triggers = ['all', ...new Set(recordings.map((r) => r.trigger))];
  const filtered = filter === 'all' ? recordings : recordings.filter((r) => r.trigger === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Event Recordings</h1>
          <p className="text-sm text-slate-500">{recordings.length} recordings available</p>
        </div>
      </div>

      <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 w-fit flex-wrap gap-1">
        {triggers.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all',
              filter === t ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((rec) => (
            <div
              key={rec.id}
              className="glass-card rounded-xl border border-slate-800/60 p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                    <Video className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white capitalize">{rec.trigger}</p>
                    <p className="text-[10px] text-slate-500">
                      {rec.camera?.name || rec.camera_id}
                    </p>
                  </div>
                </div>
                {rec.ended_at ? (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Complete
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Recording
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(rec.duration_sec)}
                </div>
                <div className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  {formatBytes(rec.size_bytes)}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(rec.started_at).toLocaleDateString()}
                </div>
              </div>

              <button
                onClick={() => download.mutate(rec.id)}
                disabled={download.isPending || !rec.ended_at}
                className={cn(
                  'w-full flex items-center justify-center gap-2 text-xs font-medium px-3 py-2 rounded-lg transition-all',
                  rec.ended_at
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                )}
              >
                {download.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {rec.ended_at ? 'Download MP4' : 'Processing...'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
