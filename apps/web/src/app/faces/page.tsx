'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, Search, ShieldCheck, MoreHorizontal, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FacesPage() {
  const [persons, setPersons] = useState([
    { id: '1', name: 'John Doe', tag: 'EMPLOYEE', status: 'Known', lastSeen: '2 mins ago', image: 'https://i.pravatar.cc/150?u=1' },
    { id: '2', name: 'Sarah Connor', tag: 'VIP', status: 'Known', lastSeen: '1 hour ago', image: 'https://i.pravatar.cc/150?u=2' },
    { id: '3', name: 'Unknown #482', tag: 'VISITOR', status: 'Unknown', lastSeen: '10 mins ago', image: 'https://i.pravatar.cc/150?u=3' },
    { id: '4', name: 'Mark Vance', tag: 'BLACKLISTED', status: 'Alert', lastSeen: 'Yesterday', image: 'https://i.pravatar.cc/150?u=4' },
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Face Recognition</h1>
          <p className="text-zinc-500">Manage identity watchlists and recognition events</p>
        </div>
        <div className="flex gap-3">
            <Button variant="outline" className="flex items-center gap-2">
                <Upload className="w-4 h-4" /> Bulk Upload
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Register Person
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {persons.map((person) => (
          <div key={person.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden group hover:border-blue-500/50 transition-all hover:shadow-lg">
            <div className="aspect-square relative overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                <img src={person.image} alt={person.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                <div className="absolute top-3 right-3">
                    <button className="p-1.5 bg-black/50 backdrop-blur-md rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </div>
                <div className="absolute bottom-3 left-3">
                    <span className={cn(
                        "px-2 py-1 text-[10px] font-black rounded uppercase tracking-wider shadow-sm",
                        person.tag === 'BLACKLISTED' ? "bg-red-600 text-white" :
                        person.tag === 'VIP' ? "bg-purple-600 text-white" :
                        "bg-blue-600 text-white"
                    )}>
                        {person.tag}
                    </span>
                </div>
            </div>
            <div className="p-4">
                <h3 className="font-bold text-zinc-900 dark:text-white">{person.name}</h3>
                <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-zinc-500">Last seen: {person.lastSeen}</span>
                    {person.status === 'Known' && <ShieldCheck className="w-4 h-4 text-green-500" />}
                </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-zinc-50 dark:bg-zinc-900/50 p-8 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold mb-2">Identify Anyone</h2>
          <p className="text-zinc-500 max-w-sm mx-auto mb-6">
              Search through historical footage using face recognition to find specific people across all camera feeds.
          </p>
          <Button variant="outline" className="rounded-full px-8">Start Global Search</Button>
      </div>
    </div>
  );
}
