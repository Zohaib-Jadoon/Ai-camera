'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@madad/types';
import { Bell } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function AlertToast() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // This would normally listen to a websocket
  useEffect(() => {
    // Mock incoming alerts for demo
    const interval = setInterval(() => {
      // randomly add alert logic could go here
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {alerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: 50, scale: 0.3 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-lg flex items-start gap-4 max-w-sm"
          >
            <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
              <Bell className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="font-bold text-sm">{alert.alert_type}</p>
              <p className="text-xs text-zinc-500">Camera {alert.camera_id}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
