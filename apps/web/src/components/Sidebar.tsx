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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore, type UserRole } from '@/store/auth-store';

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  /** Minimum role required to see this item. undefined = all roles. */
  minRole?: UserRole;
};

// Role hierarchy: ADMIN > SECURITY_OPERATOR > VIEWER
const ROLE_RANK: Record<UserRole, number> = {
  ADMIN: 3,
  SECURITY_OPERATOR: 2,
  VIEWER: 1,
};

export const navItems: NavItem[] = [
  { name: 'Dashboard',        href: '/dashboard',     icon: LayoutDashboard },
  { name: 'Live Monitor',     href: '/live',          icon: Video },
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
        'relative hidden md:flex flex-col h-screen bg-[#050d1a] border-r border-slate-800/60 transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className={cn(
        'flex items-center gap-3 px-4 py-5 border-b border-slate-800/60',
        collapsed && 'justify-center px-2'
      )}>
        <div className="relative flex-shrink-0">
          <Shield className="w-8 h-8 text-blue-500" />
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#050d1a]" />
        </div>
        {!collapsed && (
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white leading-none">Madad Vision</h1>
            <p className="text-[10px] text-blue-400 font-medium uppercase tracking-widest mt-0.5">AI Platform</p>
          </div>
        )}
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-14 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors z-10"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {!collapsed && (
        <div className="mx-3 mt-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <Cpu className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider">AI Engine</p>
            <p className="text-[10px] text-blue-400/70">YOLOv8 • Online</p>
          </div>
          <span className="w-2 h-2 bg-emerald-400 rounded-full live-indicator flex-shrink-0" />
        </div>
      )}

      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon as React.ComponentType<{ className?: string }>;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group',
                collapsed && 'justify-center px-2',
                isActive
                  ? 'bg-blue-600/15 text-blue-400 font-medium'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/60'
              )}
              title={collapsed ? item.name : undefined}
            >
              <Icon className={cn(
                'flex-shrink-0 transition-colors',
                collapsed ? 'w-5 h-5' : 'w-4.5 h-4.5',
                isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'
              )} />
              {!collapsed && (
                <span className="text-sm">{item.name}</span>
              )}
              {!collapsed && isActive && (
                <span className="ml-auto w-1.5 h-1.5 bg-blue-400 rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User badge at the bottom */}
      <div className={cn('px-3 pb-2 pt-2 border-t border-slate-800/60', collapsed && 'flex justify-center')}>
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg mb-1">
            {user.avatar_url ? (
              <Image
                src={user.avatar_url}
                alt={user.name}
                width={28}
                height={28}
                className="rounded-full border border-slate-700"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-300 text-xs font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500 truncate">{user.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all duration-150',
            collapsed && 'justify-center w-auto px-2'
          )}
        >
          <LogOut className="w-4.5 h-4.5 flex-shrink-0" />
          {!collapsed && <span className="text-sm">Logout</span>}
        </button>
        {!collapsed && (
          <p className="text-[9px] text-slate-700 mt-2 px-3 uppercase tracking-widest font-semibold">
            v1.0.0 · Madad Vision AI
          </p>
        )}
      </div>
    </aside>
  );
}
