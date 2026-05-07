'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Video,
  AlertTriangle,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

const data = [
  { name: '00:00', detections: 40 },
  { name: '04:00', detections: 30 },
  { name: '08:00', detections: 200 },
  { name: '12:00', detections: 278 },
  { name: '16:00', detections: 189 },
  { name: '20:00', detections: 239 },
  { name: '23:59', detections: 349 },
];

const stats = [
  {
    title: "Active Cameras",
    value: "12 / 14",
    icon: Video,
    trend: "+2",
    trendColor: "text-green-500"
  },
  {
    title: "Total Detections",
    value: "1,284",
    icon: Activity,
    trend: "+12%",
    trendColor: "text-green-500"
  },
  {
    title: "Security Alerts",
    value: "24",
    icon: AlertTriangle,
    trend: "-5%",
    trendColor: "text-red-500"
  },
  {
    title: "Recognized Faces",
    value: "412",
    icon: Users,
    trend: "+18%",
    trendColor: "text-green-500"
  },
];

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard Overview</h2>
        <p className="text-slate-400">Real-time surveillance analytics and system health.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-slate-900 border-slate-800 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className={stat.trendColor + " text-xs flex items-center gap-1 mt-1"}>
                {stat.trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownRight className="w-3 h-3"/>}
                {stat.trend} from last period
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 bg-slate-900 border-slate-800 text-white">
          <CardHeader>
            <CardTitle>Detection Trends</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorDet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="detections" stroke="#3b82f6" fillOpacity={1} fill="url(#colorDet)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 bg-slate-900 border-slate-800 text-white">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center">
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      Human detected at Main Gate
                    </p>
                    <p className="text-xs text-slate-400">
                      2 minutes ago
                    </p>
                  </div>
                  <div className="ml-auto font-medium text-xs text-blue-500">
                    View
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
