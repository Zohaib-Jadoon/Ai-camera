'use client';

import { useState } from 'react';
import { Bell, ShieldAlert, Eye, Clock, Camera, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAlerts, useUpdateAlertStatus, AlertItem } from '@/hooks/use-api';
import AlertDetailModal from '@/components/AlertDetailModal';
import AlertReview from '@/components/AlertReview';

const sevColors: Record<string, string> = {
  CRITICAL: 'text-red-400 bg-red-500/10 border-red-500/20',
  HIGH: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  MEDIUM: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  LOW: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

const statusColors: Record<string, string> = {
  PENDING: 'text-red-400',
  RESOLVED: 'text-emerald-400',
  DISMISSED: 'text-slate-500',
};

export default function AlertsPage() {
  const { data: alerts = [], isLoading } = useAlerts();
  const updateStatus = useUpdateAlertStatus();
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);

  const filtered = alerts.filter((a) => statusFilter === 'all' || a.status === statusFilter);
  const activeCount = alerts.filter((a) => a.status === 'PENDING').length;

  const handleResolve = (id: string) => updateStatus.mutate({ id, status: 'RESOLVED' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Security Alerts</h1>
          <p className="text-sm text-slate-500">{activeCount} active alerts requiring attention</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 font-semibold">
            <ShieldAlert className="w-3.5 h-3.5" /> {activeCount} Active
          </span>
        </div>
      </div>

      <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 w-fit">
        {['all', 'PENDING', 'ACKNOWLEDGED', 'RESOLVED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all',
              statusFilter === s ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'
            )}
          >
            {s.toLowerCase()}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'glass-card rounded-xl border p-4 transition-all',
                alert.status === 'PENDING' ? 'border-red-500/30 glow-red' : 'border-slate-800/60'
              )}
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-10 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Camera className="w-4 h-4 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase bg-red-500/10 text-red-400 border-red-500/20">
                      {alert.alert_type}
                    </span>
                    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase', sevColors[alert.severity || 'LOW'] || sevColors.LOW)}>
                      {alert.severity || 'LOW'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white">{alert.alert_type.replace(/_/g, ' ')}</p>
                  <div className="flex items-center gap-4 mt-1.5 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(alert.sent_at).toLocaleString()}
                    </span>
                    {alert.assignee && (
                      <span className="text-blue-400">Assigned to {alert.assignee.name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cn('text-[10px] font-semibold capitalize', statusColors[alert.status])}>
                    {alert.status.toLowerCase()}
                  </span>
                  {alert.status !== 'RESOLVED' && alert.review_status && alert.review_status !== 'PENDING' && (
                    <>
                      <button
                        onClick={() => handleResolve(alert.id)}
                        aria-label="Resolve reviewed alert"
                        className="p-1.5 rounded-md bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setSelectedAlert(alert)}
                    className="p-1.5 rounded-md hover:bg-slate-700 text-slate-500 hover:text-blue-400"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <AlertReview id={alert.id} status={alert.review_status} />
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">No alerts found</div>
          )}
        </div>
      )}

      <AlertDetailModal
        alert={selectedAlert}
        open={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
      />
    </div>
  );
}
