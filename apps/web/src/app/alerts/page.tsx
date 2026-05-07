'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShieldAlert, CheckCircle, Clock, Trash2, Filter, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([
    { id: '1', type: 'INTRUSION', camera: 'Main Gate', time: '2 mins ago', status: 'NEW', severity: 'HIGH' },
    { id: '2', type: 'UNKNOWN_PERSON', camera: 'Entrance', time: '1 hour ago', status: 'ACKNOWLEDGED', severity: 'MEDIUM' },
    { id: '3', type: 'WATCHLIST_PERSON', camera: 'Parking Lot', time: '3 hours ago', status: 'RESOLVED', severity: 'CRITICAL' },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Alert System</h1>
          <p className="text-zinc-500">Real-time security alerts and incident management</p>
        </div>
        <Button variant="outline" className="flex items-center gap-2 text-red-500">
            <Trash2 className="w-4 h-4" /> Clear Resolved
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <AlertStat title="New Alerts" value="8" color="red" icon={ShieldAlert} />
          <AlertStat title="Pending" value="12" color="yellow" icon={Clock} />
          <AlertStat title="Resolved" value="142" color="green" icon={CheckCircle} />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search alerts..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filter
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Alert Type</th>
                <th className="px-6 py-4">Camera</th>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {alerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4 font-bold flex items-center gap-3">
                    <div className={cn(
                        "p-2 rounded-lg",
                        alert.severity === 'CRITICAL' ? "bg-red-500/20 text-red-600" : "bg-orange-500/20 text-orange-600"
                    )}>
                        <ShieldAlert className="w-4 h-4" />
                    </div>
                    {alert.type.replace('_', ' ')}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">{alert.camera}</td>
                  <td className="px-6 py-4 text-sm text-zinc-500">{alert.time}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                        "px-2 py-1 text-[10px] font-bold rounded uppercase",
                        alert.status === 'NEW' ? "bg-red-500 text-white" :
                        alert.status === 'ACKNOWLEDGED' ? "bg-yellow-500 text-white" : "bg-green-500 text-white"
                    )}>
                        {alert.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                        "text-xs font-black",
                        alert.severity === 'CRITICAL' ? "text-red-600" : "text-zinc-500"
                    )}>
                        {alert.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button size="sm" variant={alert.status === 'RESOLVED' ? 'ghost' : 'outline'}>
                        {alert.status === 'RESOLVED' ? 'View Report' : 'Acknowledge'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AlertStat({ title, value, color, icon: Icon }: any) {
    const colorMap: any = {
        red: "text-red-600 bg-red-50 dark:bg-red-900/10",
        yellow: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/10",
        green: "text-green-600 bg-green-50 dark:bg-green-900/10",
    };
    return (
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-zinc-500">{title}</p>
                <p className="text-3xl font-bold mt-1">{value}</p>
            </div>
            <div className={cn("p-4 rounded-2xl", colorMap[color])}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
    );
}
