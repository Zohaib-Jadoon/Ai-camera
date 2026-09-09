'use client';
import { runUiAction } from '@/lib/ui-action';

import { useState } from 'react';
import {
  Wifi, WifiOff, CheckCircle, XCircle, Loader2, Monitor,
  Settings2, Gauge, Cpu, Cable, HelpCircle, ChevronDown, ChevronUp,
  ArrowRight, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCameras, useUpdateCamera, useTestCameraConnection, Camera } from '@/hooks/use-api';

const SOP_OPTIONS = [
  { value: 'general_detection', label: 'Default (General Detection)' },
  { value: 'hardhat_required', label: 'Hardhat Required' },
  { value: 'fire_smoke', label: 'Fire & Smoke Detection' },
  { value: 'weapon_detection', label: 'Weapon Detection' },
  { value: 'ppe_compliance', label: 'PPE Compliance' },
  { value: 'crowd_density', label: 'Crowd Density' },
  { value: 'vehicle_counting', label: 'Vehicle Counting' },
];

export default function CalibrationPage() {
  const { data: cameras = [], isLoading } = useCameras();
  const updateCamera = useUpdateCamera();
  const testConnection = useTestCameraConnection();

  const [selected, setSelected] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    ok: boolean; message: string; resolution: number[] | null; fps: number | null;
  } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const cam = cameras.find((c) => c.id === selected);

  const handleTest = async (camera: Camera) => {
    setTestResult(null);
    setSelected(camera.id);
    try {
      const result = await testConnection.mutateAsync({ id: camera.id });
      setTestResult(result);
    } catch {
      setTestResult({ ok: false, message: 'Request failed — is the backend running?', resolution: null, fps: null });
    }
  };

  const handleSopChange = async (camera: Camera, sop: string) => {
    const selectedSop = sop || 'general_detection';
    await updateCamera.mutateAsync({ id: camera.id, sop_name: selectedSop } as any);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Camera Calibration</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Test RTSP connections, configure AI models, and calibrate hardware cameras
          </p>
        </div>
        <button
          onClick={() => setGuideOpen(!guideOpen)}
          className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-lg transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          Hardware Setup Guide
          {guideOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* ─── Hardware Setup Guide ─────────────────────────────────────── */}
      {guideOpen && (
        <div className="glass-card rounded-xl border border-blue-500/20 p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Cable className="w-5 h-5 text-blue-400" /> CCTV Hardware Integration Guide
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-800/60 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold">1</span>
                Network Setup
              </div>
              <ul className="text-slate-400 space-y-1 text-xs leading-relaxed">
                <li>• Connect IP camera to the same LAN as the server</li>
                <li>• Assign a static IP to the camera (e.g. 192.168.1.100)</li>
                <li>• Ensure port 554 (RTSP) is open on the camera</li>
                <li>• Test connectivity: <code className="text-blue-400 bg-slate-800 px-1 rounded">ping 192.168.1.100</code></li>
              </ul>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-800/60 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-semibold">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs font-bold">2</span>
                RTSP URL Format
              </div>
              <ul className="text-slate-400 space-y-1 text-xs leading-relaxed">
                <li>• <strong className="text-white">Hikvision:</strong> <code className="text-blue-400 bg-slate-800 px-1 rounded text-[10px]">rtsp://user:pass@IP:554/Streaming/Channels/101</code></li>
                <li>• <strong className="text-white">Dahua:</strong> <code className="text-blue-400 bg-slate-800 px-1 rounded text-[10px]">rtsp://user:pass@IP:554/cam/realmonitor?channel=1</code></li>
                <li>• <strong className="text-white">Generic ONVIF:</strong> <code className="text-blue-400 bg-slate-800 px-1 rounded text-[10px]">rtsp://user:pass@IP:554/stream1</code></li>
                <li>• <strong className="text-white">USB/Webcam:</strong> Enter <code className="text-blue-400 bg-slate-800 px-1 rounded">0</code> for local webcam</li>
              </ul>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-800/60 space-y-2">
              <div className="flex items-center gap-2 text-purple-400 font-semibold">
                <span className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs font-bold">3</span>
                Recommended Specs
              </div>
              <ul className="text-slate-400 space-y-1 text-xs leading-relaxed">
                <li>• Resolution: 1080p (1920×1080) or higher</li>
                <li>• Frame rate: 15–30 FPS for real-time detection</li>
                <li>• Codec: H.264 (best compatibility with OpenCV)</li>
                <li>• Night vision / IR LEDs for 24/7 monitoring</li>
                <li>• PoE (Power over Ethernet) simplifies wiring</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            RTSP credentials are stored encrypted and never exposed to the frontend.
          </p>
        </div>
      )}

      {/* ─── Camera List ──────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : cameras.length === 0 ? (
        <div className="glass-card rounded-xl border border-slate-800/60 p-12 text-center">
          <Monitor className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No cameras configured yet.</p>
          <p className="text-xs text-slate-600 mt-1">Add cameras in the <strong className="text-blue-400">Cameras</strong> section first, then return here to calibrate.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cameras.map((camera) => {
            const isOnline = camera.status === 'ONLINE';
            const isSelected = selected === camera.id;
            const isTesting = testConnection.isPending && isSelected;

            return (
              <div
                key={camera.id}
                className={cn(
                  'glass-card rounded-xl border overflow-hidden transition-all',
                  isSelected ? 'border-blue-500/40 glow-blue' : 'border-slate-800/60 hover:border-slate-700'
                )}
              >
                {/* Camera header row */}
                <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                      isOnline ? 'bg-emerald-500/15 border border-emerald-500/25' : 'bg-slate-800 border border-slate-700'
                    )}>
                      {isOnline ? <Wifi className="w-5 h-5 text-emerald-400" /> : <WifiOff className="w-5 h-5 text-slate-600" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate">{camera.name}</h3>
                      <p className="text-[10px] text-slate-500 truncate font-mono">{camera.rtsp_url || 'No RTSP URL'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {camera.sop_name && (
                      <span className="text-[10px] bg-purple-500/15 text-purple-400 border border-purple-500/25 px-2 py-0.5 rounded-md font-semibold uppercase">
                        {camera.sop_name}
                      </span>
                    )}
                    <span className={cn(
                      'text-[10px] font-bold uppercase px-2 py-0.5 rounded-md',
                      isOnline ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-500'
                    )}>
                      {camera.status}
                    </span>
                    <button
                      onClick={() => handleTest(camera)}
                      disabled={isTesting}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {isTesting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Gauge className="w-3.5 h-3.5" />
                      )}
                      Test Connection
                    </button>
                  </div>
                </div>

                {/* Expandable calibration panel */}
                {isSelected && (
                  <div className="border-t border-slate-800/60 p-5 space-y-4 bg-slate-900/30">
                    {/* Test result */}
                    {testResult && (
                      <div className={cn(
                        'flex items-start gap-3 p-4 rounded-lg border',
                        testResult.ok
                          ? 'bg-emerald-950/40 border-emerald-500/30'
                          : 'bg-red-950/40 border-red-500/30'
                      )}>
                        {testResult.ok ? (
                          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-semibold', testResult.ok ? 'text-emerald-300' : 'text-red-300')}>
                            {testResult.ok ? 'Connection Successful' : 'Connection Failed'}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{testResult.message}</p>
                          {testResult.resolution && (
                            <div className="flex items-center gap-4 mt-2 text-xs">
                              <span className="text-slate-300 flex items-center gap-1">
                                <Monitor className="w-3.5 h-3.5 text-blue-400" />
                                {testResult.resolution[0]}×{testResult.resolution[1]}
                              </span>
                              {testResult.fps !== null && testResult.fps > 0 && (
                                <span className="text-slate-300 flex items-center gap-1">
                                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                                  {testResult.fps} FPS
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {isTesting && !testResult && (
                      <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-950/30 border border-blue-500/20">
                        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                        <div>
                          <p className="text-sm font-semibold text-blue-300">Testing RTSP stream…</p>
                          <p className="text-xs text-slate-500 mt-0.5">The AI Engine is attempting to open the stream. This can take up to 10 seconds.</p>
                        </div>
                      </div>
                    )}

                    {/* SOP model selector */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                          <Cpu className="w-3.5 h-3.5 text-purple-400" />
                          AI Detection Model (SOP)
                        </label>
                        <select
                          value={camera.sop_name && camera.sop_name !== '' ? camera.sop_name : 'general_detection'}
                          onChange={(e) => { const value = e.target.value; void runUiAction(() => handleSopChange(camera, value)); }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                        >
                          {SOP_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value} className="bg-slate-900 text-white py-1">
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-600 mt-1">
                          Changing SOP hot-swaps the YOLO model on the AI engine without restart.
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                          <Settings2 className="w-3.5 h-3.5 text-amber-400" />
                          Camera Details
                        </label>
                        <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3 text-xs text-slate-400 space-y-1.5">
                          <div className="flex justify-between">
                            <span>Location</span>
                            <span className="text-white font-medium">{camera.location || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Added</span>
                            <span className="text-white font-medium">
                              {camera.createdAt ? new Date(camera.createdAt).toLocaleDateString() : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Zones</span>
                            <span className="text-white font-medium">{camera.zones?.length ?? 0} configured</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
