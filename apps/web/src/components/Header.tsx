'use client';

import { Search, RefreshCw, Wifi, Menu, X, Shield, LogOut } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { navItems } from './Sidebar';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useCameras, useAlerts, useDetections } from '@/hooks/use-api';
import NotificationBell from '@/components/notification-bell';
import { AlertSoundToggle } from '@/components/alert-sound';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [time, setTime] = useState('');
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: cameras = [] } = useCameras();
  const { data: alerts = [] } = useAlerts();
  const { data: detections = [] } = useDetections(50);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth-storage');
      document.cookie = 'auth-token=; path=/; max-age=0';
    }
    router.push('/login');
  };

  const lower = query.toLowerCase();
  const camResults = cameras.filter((c) => c.name.toLowerCase().includes(lower)).slice(0, 3);
  const alertResults = alerts.filter((a) => a.alert_type.toLowerCase().includes(lower)).slice(0, 3);
  const detResults = detections.filter((d) => d.object_type.toLowerCase().includes(lower)).slice(0, 3);
  const hasResults = query.length > 0 && (camResults.length > 0 || alertResults.length > 0 || detResults.length > 0);

  const navigate = (href: string) => {
    setQuery('');
    setShowResults(false);
    router.push(href);
  };

  return (
    <header className="h-14 border-b border-slate-800/60 bg-[#050d1a]/80 backdrop-blur-sm flex items-center gap-4 px-6 flex-shrink-0">
      <button
        className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white"
        onClick={() => setMobileMenuOpen(true)}
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1 max-w-md hidden sm:block" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search cameras, events, faces..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            className="w-full bg-slate-900/60 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-slate-900 transition-all"
          />
          {showResults && hasResults && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#0f172a] border border-slate-800 rounded-lg shadow-xl z-50 overflow-hidden">
              {camResults.length > 0 && (
                <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800/60">Cameras</div>
              )}
              {camResults.map((c) => (
                <button key={c.id} onClick={() => navigate('/cameras')} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800/50 truncate">
                  {c.name}
                </button>
              ))}
              {alertResults.length > 0 && (
                <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800/60 border-t">Alerts</div>
              )}
              {alertResults.map((a) => (
                <button key={a.id} onClick={() => navigate('/alerts')} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800/50 truncate">
                  {a.alert_type.replace(/_/g, ' ')}
                </button>
              ))}
              {detResults.length > 0 && (
                <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800/60 border-t">Detections</div>
              )}
              {detResults.map((d) => (
                <button key={d.id} onClick={() => navigate('/events')} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800/50 truncate">
                  {d.object_type}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
          <Wifi className="w-3.5 h-3.5 text-emerald-500" />
          <span>All systems online</span>
          <span className="mx-1 text-slate-700">·</span>
          <RefreshCw className="w-3 h-3 text-slate-600" />
          <span className="font-mono text-slate-600">{time}</span>
        </div>

        <NotificationBell />
        <AlertSoundToggle />

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="hidden lg:block">
            <p className="text-xs font-medium text-white">{user?.name || 'Admin'}</p>
            <p className="text-[10px] text-slate-500 capitalize">{user?.role?.toLowerCase() || 'admin'}</p>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-slate-800/60 text-slate-400 hover:text-red-400 transition-colors" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative flex flex-col w-64 h-full bg-[#050d1a] border-r border-slate-800/60 p-4 shadow-2xl">
            <button
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/50 rounded-full"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-8 px-2 mt-2">
              <div className="relative flex-shrink-0">
                <Shield className="w-8 h-8 text-blue-500" />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#050d1a]" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white leading-none">Madad Vision</h1>
                <p className="text-[10px] text-blue-400 font-medium uppercase tracking-widest mt-0.5">AI Platform</p>
              </div>
            </div>

            <nav className="flex flex-col gap-1 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                const Icon = item.icon as React.ComponentType<{ className?: string }>;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-150',
                      isActive
                        ? 'bg-blue-600/15 text-blue-400 font-medium'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    )}
                  >
                    <Icon className={cn("w-5 h-5", isActive ? "text-blue-400" : "text-slate-500")} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto pt-4 border-t border-slate-800/60">
              <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all">
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
