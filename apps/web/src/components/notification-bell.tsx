'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useNotifications,
  useUnreadCount,
  useMarkRead,
  useMarkAllRead,
} from '@/hooks/use-notifications';

function timeAgo(date: string | Date): string {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [], isLoading } = useNotifications();
  const { data: unreadCount = 0 } = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (id: string, read: boolean) => {
    if (!read) {
      markRead.mutate(id);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-slate-800/60 text-slate-400 hover:text-white transition-colors"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#0f172a] border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="py-8 text-center text-slate-500 text-xs">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">No notifications</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n.id, n.read)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors',
                    !n.read && 'bg-blue-500/5'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {!n.read && <span className="w-2 h-2 bg-blue-400 rounded-full mt-1.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs', !n.read ? 'font-semibold text-white' : 'text-slate-300')}>
                        {n.title}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{n.message}</p>
                      <p className="text-[10px] text-slate-600 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
