'use client';

import { useState } from 'react';
import {
  Video,
  Settings,
  Maximize2,
  LayoutGrid,
  Grid3X3,
  ShieldAlert,
  Info
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const mockCameras = [
  { id: '1', name: 'Main Entrance', status: 'Online' },
  { id: '2', name: 'Parking Lot A', status: 'Online' },
  { id: '3', name: 'Server Room', status: 'Online' },
  { id: '4', name: 'Back Alley', status: 'Online' },
];

export default function LiveMonitoring() {
  const [layout, setLayout] = useState<'grid' | 'focus'>('grid');

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Live Monitoring</h2>
          <p className="text-slate-400">Real-time AI processed video streams.</p>
        </div>
        <div className="flex gap-2 bg-slate-900 p-1 rounded-md border border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLayout('grid')}
            className={cn(layout === 'grid' && "bg-slate-800 text-blue-500")}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLayout('focus')}
            className={cn(layout === 'focus' && "bg-slate-800 text-blue-500")}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className={cn(
        "grid gap-4 flex-1",
        layout === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 lg:grid-cols-4"
      )}>
        {mockCameras.map((cam) => (
          <Card
            key={cam.id}
            className={cn(
              "bg-black border-slate-800 relative overflow-hidden group",
              layout === 'focus' && cam.id === '1' ? "lg:col-span-3 lg:row-span-2" : ""
            )}
          >
            <div className="aspect-video bg-slate-950 flex items-center justify-center text-slate-700">
              <Video className="w-12 h-12 opacity-20" />
              {/* Mock AI Bounding Box */}
              <div className="absolute top-1/4 left-1/3 w-20 h-40 border-2 border-red-500 bg-red-500/10 pointer-events-none">
                <span className="absolute -top-6 left-0 bg-red-500 text-white text-[10px] px-1 font-bold">HUMAN 98%</span>
              </div>
            </div>

            <div className="absolute top-3 left-3 flex items-center gap-2">
              <Badge variant="destructive" className="animate-pulse bg-red-600">LIVE</Badge>
              <span className="text-xs text-white font-medium drop-shadow-md">{cam.name}</span>
            </div>

            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <Button size="icon" variant="secondary" className="h-8 w-8 bg-black/50 border-none text-white hover:bg-black/70">
                <Maximize2 className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="secondary" className="h-8 w-8 bg-black/50 border-none text-white hover:bg-black/70">
                <Settings className="w-4 h-4" />
              </Button>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-white">Intrusion Alert</span>
                </div>
                <Button size="sm" variant="link" className="text-xs text-blue-500 h-auto p-0">Details</Button>
              </div>
            </div>
          </Card>
        ))}

        {/* Sidebar for focused layout or Event stream */}
        <div className="space-y-4">
          <Card className="bg-slate-900 border-slate-800 p-4">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500" />
              Real-time Events
            </h3>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="flex gap-3 text-xs border-b border-slate-800 pb-2">
                  <div className="w-12 h-8 bg-slate-800 rounded flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">Car Detected</p>
                    <p className="text-slate-500">Parking Lot A • 12:34:56</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
