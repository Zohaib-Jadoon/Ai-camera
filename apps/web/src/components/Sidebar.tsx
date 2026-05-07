'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Video,
  Settings,
  Bell,
  History,
  Users,
  LogOut,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Live Monitoring', href: '/live', icon: Video },
  { name: 'Cameras', href: '/cameras', icon: Settings },
  { name: 'Events', href: '/events', icon: History },
  { name: 'Faces', href: '/faces', icon: Users },
  { name: 'Alerts', href: '/alerts', icon: Bell },
];

export default function Sidebar() {
  const pathname = usePathname();
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="w-64 bg-slate-950 border-r border-slate-800 text-slate-200 min-h-screen p-4 flex flex-col">
      <div className="flex items-center gap-2 px-2 mb-8">
        <Shield className="w-8 h-8 text-blue-500" />
        <h1 className="text-xl font-bold tracking-tight">Madad Vision AI</h1>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
              pathname === item.href
                ? "bg-blue-600/10 text-blue-500 font-medium"
                : "hover:bg-slate-900 text-slate-400 hover:text-slate-200"
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </Link>
        ))}
      </nav>

      <div className="mt-auto pt-4 border-t border-slate-800">
        <Button
          variant="ghost"
          className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-400/10"
          onClick={logout}
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </Button>
        <p className="text-[10px] text-slate-600 mt-4 px-3 uppercase tracking-widest font-semibold">
          v0.1.0-alpha
        </p>
      </div>
    </div>
  );
}
