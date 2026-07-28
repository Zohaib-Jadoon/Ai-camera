'use client';

import { Search, RefreshCw, Wifi, Menu, X, Shield, LogOut, Sparkles } from 'lucide-react';
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
    <header className="h-16 border-b border-white/[0.07] bg-[#060913]/85 backdrop-blur-xl flex items-center gap-4 px-6 flex-shrink-0 z-20 shadow-md">
      <button
        className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white"
        onClick={() => setMobileMenuOpen(true)}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-md hidden sm:block" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-400/70" />
          <input
            type="text"
            placeholder="Search cameras, AI events, rules..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            className="w-full bg-slate-900/60 border border-white/[0.08] rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-400/50 focus:bg-slate-900/90 focus:ring-2 focus:ring-sky-400/10 transition-all font-mono-data"
          />
          {showResults && hasResults && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#090e1a]/95 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl">
              {camResults.length > 0 && (
                <div className="px-3 py-1.5 text-[10px] font-bold text-sky-400 uppercase tracking-wider border-b border-white/[0.06] font-mono-data">CAMERAS</div>
              )}
              {camResults.map((c) => (
                <button key={c.id} onClick={() => navigate('/cameras')} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-sky-500/10 hover:text-sky-300 transition-colors truncate font-mono-data">
                  {c.name}
                </button>
              ))}
              {alertResults.length > 0 && (
                <div className="px-3 py-1.5 text-[10px] font-bold text-red-400 uppercase tracking-wider border-b border-white/[0.06] border-t font-mono-data">ALERTS</div>
              )}
              {alertResults.map((a) => (
                <button key={a.id} onClick={() => navigate('/alerts')} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-red-500/10 hover:text-red-300 transition-colors truncate font-mono-data">
                  {a.alert_type.replace(/_/g, ' ')}
                </button>
              ))}
              {detResults.length > 0 && (
                <div className="px-3 py-1.5 text-[10px] font-bold text-indigo-400 uppercase tracking-wider border-b border-white/[0.06] border-t font-mono-data">DETECTIONS</div>
              )}
              {detResults.map((d) => (
                <button key={d.id} onClick={() => navigate('/events')} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-indigo-500/10 hover:text-indigo-300 transition-colors truncate font-mono-data">
                  {d.object_type}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Header Right Actions */}
      <div className="flex items-center gap-3 ml-auto">
        <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 live-indicator" />
          <span className="font-mono-data text-[11px]">ALL SYSTEMS ONLINE</span>
          <span className="text-slate-600">|</span>
          <span className="font-mono-data text-[11px] text-slate-300">{time}</span>
        </div>

        <NotificationBell />
        <AlertSoundToggle />

        <div className="flex items-center gap-2.5 pl-2 border-l border-white/[0.08]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 border border-sky-400/40 flex items-center justify-center text-xs font-bold text-white shadow-md shadow-sky-500/10">
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-semibold text-slate-100">{user?.name || 'Operator'}</p>
            <p className="text-[10px] text-sky-400/90 font-mono-data uppercase font-medium tracking-wider">{user?.role?.toLowerCase() || 'admin'}</p>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative flex flex-col w-72 h-full bg-[#060913] border-r border-white/10 p-4 shadow-2xl">
            <button
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/50 rounded-full"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-8 px-2 mt-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400/20 to-indigo-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white uppercase font-mono-data">MADAD VISION</h1>
                <p className="text-[10px] text-sky-400 font-semibold uppercase tracking-widest font-mono-data">AI COMMAND CENTER</p>
              </div>
            </div>

            <nav className="flex flex-col gap-1 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150',
                      isActive
                        ? 'bg-sky-500/15 text-sky-300 font-semibold border border-sky-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                    )}
                  >
                    <Icon className={cn("w-5 h-5", isActive ? "text-sky-400" : "text-slate-500")} />
                    <span className="text-xs">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto pt-4 border-t border-white/10">
              <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                <LogOut className="w-5 h-5" />
                <span className="text-xs font-semibold">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

