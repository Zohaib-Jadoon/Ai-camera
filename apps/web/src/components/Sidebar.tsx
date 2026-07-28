'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Video,
  Camera,
  Settings,
  Bell,
  History,
  Users,
  LogOut,
  Shield,
  Map,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Cpu,
  SlidersHorizontal,
  Car,
  HeartPulse,
  Fingerprint,
  TrendingUp,
  Film,
  ShieldAlert,
  LayoutGrid,
  Webhook,
  Zap,
  UserCog,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore, type UserRole } from '@/store/auth-store';

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  minRole?: UserRole;
  badge?: string;
};


const ROLE_RANK: Record<UserRole, number> = {
  ADMIN: 3,
  SECURITY_OPERATOR: 2,
  VIEWER: 1,
};

export const navItems: NavItem[] = [
  { name: 'Dashboard',        href: '/dashboard',     icon: LayoutDashboard },
  { name: 'Live Monitor',     href: '/live',          icon: Video, badge: 'LIVE' },
  { name: 'Cameras',          href: '/cameras',       icon: Camera },
  { name: 'Camera Groups',    href: '/camera-groups', icon: LayoutGrid },
  { name: 'Calibration',      href: '/calibration',   icon: SlidersHorizontal, minRole: 'SECURITY_OPERATOR' },
  { name: 'AI Events',        href: '/events',        icon: History },
  { name: 'Alerts',           href: '/alerts',        icon: Bell },
  { name: 'Alert Rules',      href: '/alert-rules',   icon: ShieldAlert,       minRole: 'SECURITY_OPERATOR' },
  { name: 'Recordings',       href: '/recordings',    icon: Film },
  { name: 'Traffic Analytics',href: '/traffic',       icon: Car },
  { name: 'Safety Compliance',href: '/safety',        icon: HeartPulse },
  { name: 'Person ReID',      href: '/reid',          icon: Fingerprint,       minRole: 'SECURITY_OPERATOR' },
  { name: 'Forecasting',      href: '/forecast',      icon: TrendingUp },
  { name: 'Faces',            href: '/faces',         icon: Users,             minRole: 'SECURITY_OPERATOR' },
  { name: 'Zone Editor',      href: '/zones',         icon: Map,               minRole: 'SECURITY_OPERATOR' },
  { name: 'Analytics',        href: '/analytics',     icon: BarChart3 },
  { name: 'Webhooks',         href: '/webhooks',      icon: Webhook,           minRole: 'ADMIN' },
  { name: 'Escalation',       href: '/escalation',    icon: Zap,               minRole: 'SECURITY_OPERATOR' },
  { name: 'User Management',  href: '/users',         icon: UserCog,           minRole: 'ADMIN' },
  { name: 'Settings',         href: '/settings',      icon: Settings },
];

function canSee(itemRole: UserRole | undefined, userRole: UserRole): boolean {
  if (!itemRole) return true;
  return ROLE_RANK[userRole] >= ROLE_RANK[itemRole];
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const userRole: UserRole = (user?.role as UserRole) ?? 'VIEWER';

  const handleLogout = () => {
    logout();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth-storage');
      window.location.href = '/login';
    }
  };

  const visibleItems = navItems.filter((item) => canSee(item.minRole, userRole));

  return (
    <aside
      className={cn(
        'relative hidden md:flex flex-col h-screen bg-[#060913]/90 backdrop-blur-xl border-r border-white/[0.07] transition-all duration-300 ease-in-out z-20 shadow-2xl',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-5 border-b border-white/[0.06]',
        collapsed && 'justify-center px-2'
      )}>
        <div className="relative flex-shrink-0 group cursor-pointer">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400/20 to-indigo-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
            <Shield className="w-5 h-5" />
          </div>
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#060913] live-indicator" />
        </div>
        {!collapsed && (
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold tracking-tight text-white font-mono-data uppercase">MADAD VISION</h1>
              <Sparkles className="w-3 h-3 text-sky-400 animate-pulse" />
            </div>
            <p className="text-[10px] text-sky-400 font-semibold uppercase tracking-widest font-mono-data">AI COMMAND CENTER</p>
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-14 w-6 h-6 bg-[#111827] border border-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:border-sky-400/50 hover:bg-slate-800 transition-all z-30 shadow-lg"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* AI Engine Status Card */}
      {!collapsed && (
        <div className="mx-3 mt-4 mb-2 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-sky-500/10 via-indigo-500/5 to-transparent border border-sky-500/20">
          <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 flex-shrink-0">
            <Cpu className="w-4 h-4 animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-sky-400 uppercase tracking-wider font-mono-data">AI CORE V8</p>
              <span className="w-2 h-2 bg-emerald-400 rounded-full live-indicator" />
            </div>
            <p className="text-[10px] text-slate-400 font-mono-data truncate">YOLOv8 • RTSP ACTIVE</p>
          </div>
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative',
                collapsed && 'justify-center px-2',
                isActive
                  ? 'bg-gradient-to-r from-sky-500/15 to-indigo-500/10 text-sky-300 font-semibold border border-sky-500/30 shadow-lg shadow-sky-500/5'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
              )}
              title={collapsed ? item.name : undefined}
            >
              <Icon className={cn(
                'flex-shrink-0 transition-transform duration-200 group-hover:scale-110',
                collapsed ? 'w-5 h-5' : 'w-4.5 h-4.5',
                isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-200'
              )} />
              {!collapsed && (
                <span className="text-xs font-medium tracking-wide">{item.name}</span>
              )}
              {!collapsed && item.badge && (
                <span className="ml-auto px-1.5 py-0.5 text-[9px] font-bold tracking-wider rounded bg-sky-500/20 text-sky-300 border border-sky-400/30 font-mono-data">
                  {item.badge}
                </span>
              )}
              {!collapsed && isActive && !item.badge && (
                <span className="ml-auto w-1.5 h-1.5 bg-sky-400 rounded-full shadow-[0_0_8px_#38bdf8]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Info & Footer */}
      <div className={cn('px-3 pb-3 pt-2 border-t border-white/[0.06]', collapsed && 'flex justify-center')}>
        {!collapsed && user && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] mb-2">
            {user.avatar_url ? (
              <Image
                src={user.avatar_url}
                alt={user.name}
                width={30}
                height={30}
                className="rounded-full border border-sky-400/30"
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold font-mono-data shadow-md">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-100 truncate">{user.name}</p>
              <p className="text-[10px] text-sky-400/80 uppercase font-mono-data tracking-wider font-medium">{user.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200',
            collapsed && 'justify-center w-auto px-2'
          )}
        >
          <LogOut className="w-4.5 h-4.5 flex-shrink-0 text-slate-400 group-hover:text-red-400" />
          {!collapsed && <span className="text-xs font-semibold tracking-wide">Logout</span>}
        </button>
        {!collapsed && (
          <div className="flex items-center justify-between mt-2.5 px-2">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono-data">v1.0 PRO</span>
            <span className="text-[9px] text-emerald-400/90 font-mono-data flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-emerald-400" /> ENCRYPTED
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

