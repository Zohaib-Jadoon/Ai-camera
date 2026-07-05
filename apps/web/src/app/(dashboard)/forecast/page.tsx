'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  TrendingUp, TrendingDown, Minus, BarChart3,
  AlertTriangle, Clock, Cpu, Activity,
} from 'lucide-react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    return JSON.parse(raw)?.state?.token ?? null;
  } catch { return null; }
}

interface ForecastPoint {
  hour: number;
  hour_label: string;
  predicted_count: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

interface AnomalyPoint {
  hour: number;
  expected: number;
  actual: number;
  deviation_pct: number;
  is_anomaly: boolean;
  message: string;
}

interface ForecastStats {
  total_events: number;
  hours_of_data: number;
  cameras_tracked: number;
  pattern_hours: number;
}

export default function ForecastPage() {
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyPoint[]>([]);
  const [stats, setStats] = useState<ForecastStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getToken();
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : undefined,
    });
    socketRef.current = socket;

    socket.on('forecast_result', (payload: any) => {
      setLoading(false);
      if (payload.error) {
        setError(payload.error);
      } else {
        setForecast(payload.forecast || []);
        setAnomalies(payload.anomalies || []);
        setStats(payload.stats || null);
        setLastUpdated(new Date());
        setError('');
      }
    });

    // Auto-request forecast on mount
    socket.on('connect', () => {
      setLoading(true);
      socket.emit('request_forecast', {});
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, []);

  const requestForecast = () => {
    if (!socketRef.current) return;
    setLoading(true);
    setError('');
    socketRef.current.emit('request_forecast', {});
  };

  const trendIcon = (trend: string) => {
    if (trend === 'increasing') return <TrendingUp className="w-4 h-4 text-red-400" />;
    if (trend === 'decreasing') return <TrendingDown className="w-4 h-4 text-emerald-400" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  const trendColor = (trend: string) => {
    if (trend === 'increasing') return 'text-red-400';
    if (trend === 'decreasing') return 'text-emerald-400';
    return 'text-slate-400';
  };

  // Find max predicted count for the bar chart
  const maxPredicted = Math.max(...forecast.map(f => f.predicted_count), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Predictive Forecasting</h1>
          <p className="text-sm text-slate-400 mt-1">
            AI-powered predictions for crowd density and traffic patterns based on historical analysis
          </p>
        </div>
        <button
          onClick={requestForecast}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {loading ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing...</>
          ) : (
            <><Activity className="w-4 h-4" /> Refresh Forecast</>
          )}
        </button>
      </div>

      {/* Data Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Events', value: stats.total_events.toLocaleString(), icon: <Cpu className="w-4 h-4 text-blue-400" /> },
            { label: 'Hours of Data', value: `${stats.hours_of_data}h`, icon: <Clock className="w-4 h-4 text-purple-400" /> },
            { label: 'Cameras Tracked', value: stats.cameras_tracked, icon: <BarChart3 className="w-4 h-4 text-emerald-400" /> },
            { label: 'Pattern Hours', value: stats.pattern_hours, icon: <Activity className="w-4 h-4 text-orange-400" /> },
          ].map(s => (
            <div key={s.label} className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                {s.icon}
                <span className="text-xs text-slate-400 uppercase tracking-wider">{s.label}</span>
              </div>
              <p className="text-xl font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">{error}</div>
      )}

      {/* Forecast Chart (simple bar visualization) */}
      {forecast.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              Hourly Forecast
            </h2>
            {lastUpdated && (
              <span className="text-xs text-slate-500">Updated {lastUpdated.toLocaleTimeString()}</span>
            )}
          </div>
          <div className="p-5">
            <div className="flex items-end gap-3 h-48">
              {forecast.map((f, i) => {
                const height = (f.predicted_count / maxPredicted) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="text-xs text-slate-400 font-medium">{f.predicted_count}</div>
                    <div className="w-full relative" style={{ height: '160px' }}>
                      <div
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 rounded-t-lg bg-gradient-to-t from-blue-600/80 to-blue-400/60 transition-all duration-500"
                        style={{ height: `${Math.max(height, 4)}%`, opacity: f.confidence }}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-white font-medium">{f.hour_label}</p>
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        {trendIcon(f.trend)}
                        <span className={`text-[10px] ${trendColor(f.trend)}`}>{f.trend}</span>
                      </div>
                      <p className="text-[10px] text-slate-600">{(f.confidence * 100).toFixed(0)}% conf</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Anomaly Detection */}
      <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/60">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Anomaly Detection
          </h2>
        </div>

        {anomalies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <AlertTriangle className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No anomalies detected</p>
            <p className="text-xs text-slate-600 mt-1">The system compares current activity against historical hourly patterns</p>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            {anomalies.map((a, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg border ${
                  a.is_anomaly
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-emerald-500/10 border-emerald-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {a.is_anomaly ? (
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    ) : (
                      <Activity className="w-5 h-5 text-emerald-400" />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${a.is_anomaly ? 'text-amber-300' : 'text-emerald-300'}`}>
                        {a.message}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Expected: {a.expected} events | Actual: {a.actual} events | Deviation: {a.deviation_pct}%
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    a.is_anomaly ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {a.is_anomaly ? 'ANOMALY' : 'NORMAL'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Empty state when no data */}
      {!loading && forecast.length === 0 && !error && (
        <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-12 flex flex-col items-center text-center">
          <BarChart3 className="w-16 h-16 text-slate-700 mb-4" />
          <h3 className="text-lg font-semibold text-slate-400">No Forecast Data Available</h3>
          <p className="text-sm text-slate-600 mt-2 max-w-md">
            The forecasting engine requires at least 20 detection events to build hourly patterns.
            As the AI engine processes camera feeds, predictions will become available.
          </p>
          <button
            onClick={requestForecast}
            className="mt-4 px-4 py-2 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-lg text-sm hover:bg-blue-600/30 transition-colors"
          >
            Check Again
          </button>
        </div>
      )}
    </div>
  );
}
