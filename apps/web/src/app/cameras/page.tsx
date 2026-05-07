'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, MoreVertical, Search, Filter, Camera as CameraIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CamerasPage() {
  const [cameras, setCameras] = useState([
    { id: '1', name: 'Main Gate', rtsp: 'rtsp://192.168.1.10:554/ch1', location: 'Entrance', status: 'ONLINE', group: 'Exterior' },
    { id: '2', name: 'Backyard', rtsp: 'rtsp://192.168.1.11:554/ch1', location: 'Garden', status: 'ONLINE', group: 'Exterior' },
    { id: '3', name: 'Warehouse', rtsp: 'rtsp://192.168.1.12:554/ch1', location: 'Internal', status: 'OFFLINE', group: 'Interior' },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cameras</h1>
          <p className="text-zinc-500">Manage and monitor your camera fleet</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Camera
        </Button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search cameras..."
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
                <th className="px-6 py-4">Camera Name</th>
                <th className="px-6 py-4">RTSP URL</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Group</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {cameras.map((camera) => (
                <tr key={camera.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4 font-medium flex items-center gap-3">
                    <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                        <CameraIcon className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                    </div>
                    {camera.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500 font-mono">{camera.rtsp}</td>
                  <td className="px-6 py-4 text-sm">{camera.location}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold rounded uppercase">
                      {camera.group}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        camera.status === 'ONLINE' ? "bg-green-500" : "bg-red-500"
                      )} />
                      <span className="text-sm font-medium">{camera.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                      <MoreVertical className="w-4 h-4 text-zinc-400" />
                    </button>
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
