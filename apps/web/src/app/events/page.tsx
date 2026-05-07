'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Search, Filter, Play, Download, Trash2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EventsPage() {
  const [events, setEvents] = useState([
    { id: '1', type: 'HUMAN', camera: 'Main Gate', time: '2023-10-27 14:30:05', confidence: 0.98, thumbnail: 'https://picsum.photos/seed/1/200/120' },
    { id: '2', type: 'CAR', camera: 'Parking Lot', time: '2023-10-27 14:28:12', confidence: 0.92, thumbnail: 'https://picsum.photos/seed/2/200/120' },
    { id: '3', type: 'INTRUSION', camera: 'Backyard', time: '2023-10-27 14:25:45', confidence: 0.88, thumbnail: 'https://picsum.photos/seed/3/200/120' },
    { id: '4', type: 'FACE', camera: 'Entrance', time: '2023-10-27 14:20:01', confidence: 0.95, thumbnail: 'https://picsum.photos/seed/4/200/120' },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Event Center</h1>
          <p className="text-zinc-500">History of all detected AI events and security incidents</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Date Range
            </Button>
            <Button variant="outline" className="flex items-center gap-2 text-red-500 hover:text-red-600">
                <Trash2 className="w-4 h-4" /> Clear All
            </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search events by camera or type..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filter
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Event Snapshot</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Camera</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Confidence</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="w-32 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden relative">
                        <img src={event.thumbnail} alt="Event" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-8 h-8 text-white fill-current" />
                        </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                        "px-2 py-1 text-[10px] font-bold rounded uppercase",
                        event.type === 'INTRUSION' ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"
                    )}>
                        {event.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">{event.camera}</td>
                  <td className="px-6 py-4 text-sm text-zinc-500 font-mono">{event.time}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${event.confidence * 100}%` }} />
                        </div>
                        <span className="text-xs font-bold">{(event.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                        <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                            <Download className="w-4 h-4 text-zinc-500" />
                        </button>
                        <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
