'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Clock, CheckCircle, UserCheck, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpdateAlertStatus, useAssignAlert, AlertItem } from '@/hooks/use-api';

interface AlertDetailModalProps {
  alert: AlertItem | null;
  open: boolean;
  onClose: () => void;
}

const severityStyles: Record<string, string> = {
  CRITICAL: 'text-red-400 bg-red-500/10 border-red-500/20',
  HIGH: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  MEDIUM: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  LOW: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

export default function AlertDetailModal({ alert, open, onClose }: AlertDetailModalProps) {
  const updateStatus = useUpdateAlertStatus();
  const assignAlert = useAssignAlert();
  const [assigneeId, setAssigneeId] = useState('');

  if (!alert) return null;

  const handleStatus = (status: string) => {
    updateStatus.mutate({ id: alert.id, status }, { onSuccess: onClose });
  };

  const handleAssign = () => {
    if (!assigneeId.trim()) return;
    assignAlert.mutate({ id: alert.id, assigneeId: assigneeId.trim() }, { onSuccess: onClose });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg glass-card border-slate-800/60 text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-white">Alert Details</DialogTitle>
          <DialogDescription>
            {alert.alert_type.replace(/_/g, ' ')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {alert.snapshot_url ? (
            <img src={alert.snapshot_url} alt="Snapshot" className="w-full h-48 object-cover rounded-lg border border-slate-800" />
          ) : (
            <div className="w-full h-48 bg-slate-900 rounded-lg flex items-center justify-center border border-slate-800">
              <Camera className="w-8 h-8 text-slate-700" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5">Type</span>
              <span className="text-white font-medium">{alert.alert_type.replace(/_/g, ' ')}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Severity</span>
              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border capitalize inline-block', severityStyles[alert.severity || 'LOW'] || severityStyles.LOW)}>
                {alert.severity || 'LOW'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Status</span>
              <span className={cn('font-medium capitalize', alert.status === 'PENDING' ? 'text-red-400' : alert.status === 'RESOLVED' ? 'text-emerald-400' : 'text-slate-400')}>
                {alert.status.toLowerCase()}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Camera</span>
              <span className="text-white font-medium">{alert.camera?.name || alert.camera_id || 'N/A'}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-500 block mb-0.5">Timestamp</span>
              <span className="text-white font-medium flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                {new Date(alert.sent_at).toLocaleString()}
              </span>
            </div>
            {alert.assignee && (
              <div className="col-span-2">
                <span className="text-slate-500 block mb-0.5">Assignee</span>
                <span className="text-white font-medium">{alert.assignee.name}</span>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/60">
            <label className="block text-xs text-slate-500 mb-1">Assign to User ID</label>
            <div className="flex gap-2">
              <input
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                placeholder="User ID"
                className="flex-1 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
              />
              <Button size="sm" variant="outline" onClick={handleAssign} disabled={assignAlert.isPending}>
                {assignAlert.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                Assign
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          {alert.status === 'PENDING' && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleStatus('ACKNOWLEDGED')} disabled={updateStatus.isPending}>
                Acknowledge
              </Button>
                <Button size="sm" onClick={() => handleStatus('RESOLVED')} disabled={updateStatus.isPending || !alert.review_status || alert.review_status === 'PENDING'} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                {updateStatus.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Resolve
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
