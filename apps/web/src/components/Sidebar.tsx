'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Video, Camera, ShieldAlert, Users, Settings, LogOut, Box
} from 'lucide-react';
import { useAuthStore } from '@/store';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Live Monitoring', href: '/live', icon: Video },
  { name: 'Cameras', href: '/cameras', icon: Camera },
  { name: 'Zones', href: '/zones', icon: Box },
  { name: 'Events', href: '/events', icon: ShieldAlert },
  { name: 'Faces', href: '/faces', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const logout = useAuthStore((state) => state.logout);

  if (pathname === '/login') return null;

  return (
    <div className="w-64 h-screen bg-zinc-900 text-zinc-400 flex flex-col border-r border-zinc-800 shrink-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <ShieldAlert className="text-white w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold text-white">Madad AI</h1>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                active ? "bg-zinc-800 text-white" : "hover:bg-zinc-800 hover:text-white"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <button
          onClick={() => logout()}
          className="flex items-center gap-3 px-3 py-2 w-full text-left hover:bg-zinc-800 hover:text-white rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}
