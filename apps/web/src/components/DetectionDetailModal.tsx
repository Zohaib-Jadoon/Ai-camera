'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Camera, Clock } from 'lucide-react';
import { Detection } from '@/hooks/use-api';

interface DetectionDetailModalProps {
  detection: Detection | null;
  open: boolean;
  onClose: () => void;
}

export default function DetectionDetailModal({ detection, open, onClose }: DetectionDetailModalProps) {
  if (!detection) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg glass-card border-slate-800/60 text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-white">Detection Details</DialogTitle>
          <DialogDescription className="capitalize">{detection.object_type}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {detection.snapshot_url ? (
            <img src={detection.snapshot_url} alt="Snapshot" className="w-full h-48 object-cover rounded-lg border border-slate-800" />
          ) : (
            <div className="w-full h-48 bg-slate-900 rounded-lg flex items-center justify-center border border-slate-800">
              <Camera className="w-8 h-8 text-slate-700" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5">Object</span>
              <span className="text-white font-medium capitalize">{detection.object_type}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Confidence</span>
              <span className="text-white font-medium">{Math.round((detection.confidence || 0) * 100)}%</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Camera</span>
              <span className="text-white font-medium">{detection.camera?.name || detection.camera_id || 'N/A'}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-500 block mb-0.5">Timestamp</span>
              <span className="text-white font-medium flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                {new Date(detection.timestamp).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
