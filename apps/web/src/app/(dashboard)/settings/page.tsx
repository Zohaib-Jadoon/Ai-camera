'use client';

import { useState, useEffect } from 'react';
import { Settings, Bell, Shield, Cpu, Users, Sliders, Save, Loader2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUsers, User, useSettings, useUpdateSettings } from '@/hooks/use-api';

const tabs = [
  { id: 'ai', label: 'AI Detection', icon: Cpu },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'users', label: 'Users & Roles', icon: Users },
  { id: 'alerts', label: 'Alert Thresholds', icon: Shield },
  { id: 'system', label: 'System', icon: Sliders },
];

const defaultSettings = {
  humanDetection: true,
  vehicleDetection: true,
  faceRecognition: true,
  animalDetection: false,
  objectTracking: true,
  confidenceThreshold: 80,
  pushNotifications: true,
  inAppAlerts: true,
  emailAlerts: true,
  soundAlerts: true,
  intrusionCooldown: '30s',
  unknownFaceCooldown: '60s',
  maxAlertsPerHour: '50',
  autoDismissAfter: '24h',
  backendUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  aiEngineUrl: 'http://localhost:8000',
  cacheUrl: 'valkey://localhost:6379',
  snapshotVolume: './snapshots',
};

export default function SettingsPage() {
  const [tab, setTab] = useState('ai');
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: savedSettings, isLoading: settingsLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const [settings, setSettings] = useState<Record<string, any>>(defaultSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (savedSettings) {
      setSettings((prev: Record<string, any>) => ({ ...prev, ...savedSettings }));
    }
  }, [savedSettings]);

  const toggle = (key: string) =>
    setSettings((prev: Record<string, any>) => ({ ...prev, [key]: !prev[key] }));

  const setValue = (key: string, value: any) =>
    setSettings((prev: Record<string, any>) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaved(false);
    await updateSettings.mutateAsync(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const isLoading = settingsLoading;
  const isSaving = updateSettings.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-500">Configure AI, notifications, users, and system preferences</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Tab nav */}
        <div className="w-full md:w-48 flex-shrink-0 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0 scrollbar-hide">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn('whitespace-nowrap flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left', tab === t.id ? 'bg-blue-600/15 text-blue-400' : 'text-slate-500 hover:text-white hover:bg-slate-800/40')}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 glass-card rounded-xl border border-slate-800/60 p-6">
          {saved && (
            <div className="mb-4 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              <CheckCircle className="w-3.5 h-3.5" />
              Settings saved successfully.
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
            </div>
          ) : (
            <>
              {tab === 'ai' && (
                <div className="space-y-6">
                  <h2 className="text-sm font-semibold text-white">AI Detection Settings</h2>
                  {[
                    { label: 'Human Detection', desc: 'Detect humans via YOLOv8', key: 'humanDetection' },
                    { label: 'Vehicle Detection', desc: 'Detect cars, bikes, trucks', key: 'vehicleDetection' },
                    { label: 'Face Recognition', desc: 'ArcFace-powered face matching', key: 'faceRecognition' },
                    { label: 'Animal Detection', desc: 'Detect animals and birds', key: 'animalDetection' },
                    { label: 'Object Tracking', desc: 'ByteTrack multi-object tracker', key: 'objectTracking' },
                  ].map(s => (
                    <div key={s.key} className="flex items-center justify-between py-3 border-b border-slate-800/40 last:border-0">
                      <div>
                        <p className="text-xs font-medium text-white">{s.label}</p>
                        <p className="text-[10px] text-slate-500">{s.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={!!settings[s.key]} onChange={() => toggle(s.key)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                      </label>
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">Confidence Threshold</label>
                    <input
                      type="range"
                      min={50}
                      max={99}
                      value={settings.confidenceThreshold || 80}
                      onChange={(e) => setValue('confidenceThreshold', Number(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1"><span>50%</span><span>{settings.confidenceThreshold || 80}% (current)</span><span>99%</span></div>
                  </div>
                </div>
              )}

              {tab === 'notifications' && (
                <div className="space-y-6">
                  <h2 className="text-sm font-semibold text-white">Notification Preferences</h2>
                  {[
                    { label: 'Push Notifications', desc: 'FCM push to mobile devices', key: 'pushNotifications' },
                    { label: 'In-App Alerts', desc: 'Dashboard real-time notifications', key: 'inAppAlerts' },
                    { label: 'Email Alerts', desc: 'Critical alerts via email', key: 'emailAlerts' },
                    { label: 'Sound Alerts', desc: 'Audio notification on new alert', key: 'soundAlerts' },
                  ].map(n => (
                    <div key={n.key} className="flex items-center justify-between py-3 border-b border-slate-800/40 last:border-0">
                      <div><p className="text-xs font-medium text-white">{n.label}</p><p className="text-[10px] text-slate-500">{n.desc}</p></div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={!!settings[n.key]} onChange={() => toggle(n.key)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-slate-700 rounded-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'users' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">User Management</h2>
                    <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg">+ Add User</button>
                  </div>
                  {usersLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                    </div>
                  ) : users.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-8">No users found</p>
                  ) : (
                    users.map((u: User) => (
                      <div key={u.id} className="flex items-center gap-4 py-3 border-b border-slate-800/40">
                        <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">{u.name[0]}</div>
                        <div className="flex-1"><p className="text-xs font-medium text-white">{u.name}</p><p className="text-[10px] text-slate-500">{u.email}</p></div>
                        <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded', u.role === 'ADMIN' ? 'text-red-400 bg-red-500/10' : u.role === 'SECURITY_OPERATOR' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 bg-slate-500/10')}>
                          {u.role}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'alerts' && (
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-white">Alert Thresholds</h2>
                  {[
                    { label: 'Intrusion Alert Cooldown', key: 'intrusionCooldown' },
                    { label: 'Unknown Face Alert Cooldown', key: 'unknownFaceCooldown' },
                    { label: 'Max Alerts Per Hour', key: 'maxAlertsPerHour' },
                    { label: 'Auto-Dismiss After', key: 'autoDismissAfter' },
                  ].map(a => (
                    <div key={a.key} className="flex items-center justify-between py-3 border-b border-slate-800/40">
                      <span className="text-xs text-slate-300">{a.label}</span>
                      <input
                        value={settings[a.key] || ''}
                        onChange={(e) => setValue(a.key, e.target.value)}
                        className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right focus:outline-none focus:border-blue-500/50"
                      />
                    </div>
                  ))}
                </div>
              )}

              {tab === 'system' && (
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-white">System Preferences</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: 'Backend URL', key: 'backendUrl' },
                      { label: 'AI Engine URL', key: 'aiEngineUrl' },
                      { label: 'Cache (Valkey)', key: 'cacheUrl' },
                      { label: 'Snapshot Volume', key: 'snapshotVolume' },
                    ].map(s => (
                      <div key={s.key}>
                        <label className="block text-[10px] text-slate-500 mb-1">{s.label}</label>
                        <input
                          value={settings[s.key] || ''}
                          onChange={(e) => setValue(s.key, e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mt-6 pt-4 border-t border-slate-800/40 flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
