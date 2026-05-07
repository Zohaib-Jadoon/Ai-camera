'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Detection } from '@madad/types';

export default function AlertToast() {
  const [alerts, setAlerts] = useState<Detection[]>([]);

  useEffect(() => {
    const socket = io('http://localhost:3000'); // Backend URL

    socket.on('alert', (detection: Detection) => {
      setAlerts((prev) => [detection, ...prev].slice(0, 5));

      // Auto-remove after 5 seconds
      setTimeout(() => {
        setAlerts((prev) => prev.filter((a) => a.id !== detection.id));
      }, 5000);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {alerts.map((alert) => (
        <div key={alert.id} className="bg-red-600 text-white p-4 rounded-lg shadow-lg animate-bounce">
          <p className="font-bold">⚠️ Security Alert!</p>
          <p>{alert.object_type.toUpperCase()} detected at Camera {alert.camera_id}</p>
          <p className="text-xs opacity-75">{new Date(alert.timestamp).toLocaleTimeString()}</p>
        </div>
      ))}
    </div>
  );
}
