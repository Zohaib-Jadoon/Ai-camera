'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Brain,
  Upload,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Terminal,
  Play,
  RotateCw,
  HardDrive,
  ShieldAlert,
  Sliders,
  Sparkles,
  Flame,
  HardHat,
  FileArchive,
  Info,
  BellRing,
  Tag,
  HelpCircle,
  FileText,
  AlertTriangle,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface TrainedModel {
  sop_name: string;
  model_path: string;
  map50: number | null;
  epochs: number | null;
  notes?: string;
  size_mb?: number;
  registered_at?: string;
  title?: string;
  description?: string;
  alert_title?: string;
  alert_message?: string;
  alert_severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  target_class?: string;
}

interface TrainingStatus {
  sop_name: string;
  status: 'QUEUED' | 'EXTRACTING' | 'PREPARING' | 'TRAINING' | 'COMPLETED' | 'FAILED';
  epoch: number;
  total_epochs: number;
  progress_pct: number;
  box_loss: number;
  cls_loss: number;
  map50: number;
  message: string;
  error?: string | null;
  logs?: string[];
  updated_at?: number;
}

const PRESETS = [
  {
    id: 'weapon_detection',
    name: 'General Weapon Detection',
    desc: 'Unifies knife, bat, gun, blade, and rifle into single "Weapon Detected" alert',
    icon: ShieldAlert,
    targetClass: 'weapon',
    generalize: true,
    epochs: 30,
    baseModel: 'yolov8n.pt',
    color: 'from-red-500/20 to-orange-500/10 border-red-500/30 text-red-400',
    defaultTitle: 'General Weapon Detection',
    defaultDescription: 'Perimeter and entrance security monitoring to identify edged weapons, firearms, and blunt instruments.',
    defaultAlertTitle: 'WEAPON DETECTED',
    defaultAlertMessage: 'Dangerous weapon identified on {camera_id} - immediate security dispatch advised',
    defaultAlertSeverity: 'CRITICAL' as const,
  },
  {
    id: 'hardhat_required',
    name: 'PPE & Hardhat Compliance',
    desc: 'Detects hard hats, safety vests, and protective gear violations',
    icon: HardHat,
    targetClass: 'hardhat',
    generalize: false,
    epochs: 30,
    baseModel: 'yolov8n.pt',
    color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30 text-amber-400',
    defaultTitle: 'PPE & Hardhat Compliance',
    defaultDescription: 'Enforces workplace safety regulations by monitoring mandatory hardhat and high-visibility vest compliance.',
    defaultAlertTitle: 'PPE VIOLATION DETECTED',
    defaultAlertMessage: 'Personnel detected without required safety hard hat on {camera_id}',
    defaultAlertSeverity: 'MEDIUM' as const,
  },
  {
    id: 'fire_smoke',
    name: 'Fire & Smoke Detection',
    desc: 'Early hazard detection for open flames, sparks, and smoke plumes',
    icon: Flame,
    targetClass: 'fire',
    generalize: false,
    epochs: 30,
    baseModel: 'yolov8n.pt',
    color: 'from-orange-500/20 to-rose-500/10 border-orange-500/30 text-orange-400',
    defaultTitle: 'Fire & Thermal Hazard Detection',
    defaultDescription: 'Early warning vision monitor for open flames, electrical sparks, or smoke accumulation in industrial zones.',
    defaultAlertTitle: 'FIRE / SMOKE HAZARD DETECTED',
    defaultAlertMessage: 'Smoke plume or flame detected on {camera_id} - initiate fire containment protocol',
    defaultAlertSeverity: 'CRITICAL' as const,
  },
  {
    id: 'custom',
    name: 'Custom SOP Vision Model',
    desc: 'Fine-tune any proprietary object, safety rule, or custom compliance protocol',
    icon: Sliders,
    targetClass: 'phone',
    generalize: false,
    epochs: 30,
    baseModel: 'yolov8n.pt',
    color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-blue-400',
    defaultTitle: 'Cell Phone Usage in Hazard Zone',
    defaultDescription: 'Enforce zero-distraction policy prohibiting mobile phones near heavy robotics per OSHA SOP-904.',
    defaultAlertTitle: 'RESTRICTED PHONE DETECTED',
    defaultAlertMessage: 'Unauthorized mobile device active in operating perimeter on {camera_id}',
    defaultAlertSeverity: 'HIGH' as const,
  },
];

const SEVERITY_CONFIG = {
  LOW: {
    label: 'Low',
    border: 'border-cyan-500/50',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    glow: 'shadow-cyan-500/10',
  },
  MEDIUM: {
    label: 'Medium',
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    glow: 'shadow-amber-500/10',
  },
  HIGH: {
    label: 'High',
    border: 'border-orange-500/50',
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    glow: 'shadow-orange-500/10',
  },
  CRITICAL: {
    label: 'Critical',
    border: 'border-rose-500/50',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    glow: 'shadow-rose-500/10',
  },
};

export default function TrainingPage() {
  const [file, setFile] = useState<File | null>(null);
  const [selectedPreset, setSelectedPreset] = useState('weapon_detection');

  // Custom SOP identity and alert fields
  const [sopName, setSopName] = useState('weapon_detection');
  const [sopTitle, setSopTitle] = useState('General Weapon Detection');
  const [sopDescription, setSopDescription] = useState(
    'Perimeter and entrance security monitoring to identify edged weapons, firearms, and blunt instruments.'
  );
  const [targetClass, setTargetClass] = useState('weapon');
  const [alertTitle, setAlertTitle] = useState('WEAPON DETECTED');
  const [alertMessage, setAlertMessage] = useState(
    'Dangerous weapon identified on {camera_id} - immediate security dispatch advised'
  );
  const [alertSeverity, setAlertSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('CRITICAL');

  const [generalizeWeapon, setGeneralizeWeapon] = useState(true);
  const [baseModel, setBaseModel] = useState('yolov8n.pt');
  const [epochs, setEpochs] = useState(30);
  const [batchSize, setBatchSize] = useState(16);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeStatus, setActiveStatus] = useState<TrainingStatus | null>(null);
  const [models, setModels] = useState<TrainedModel[]>([]);
  const [deployingSop, setDeployingSop] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch registered models
  const fetchModels = async () => {
    try {
      const res = await api.get('/training/models');
      if (Array.isArray(res.data)) {
        setModels(res.data);
      }
    } catch (err: any) {
      console.warn('Could not load models from registry:', err?.response?.data?.message || err?.message || err);
    }
  };

  // Poll training status if a job is in progress
  const pollStatus = async () => {
    if (!sopName) return;
    try {
      const res = await api.get(`/training/status/${sopName}`);
      if (res.data) {
        setActiveStatus(res.data);
        if (res.data.status === 'COMPLETED') {
          fetchModels();
        }
      }
    } catch (err) {
      // Ignored if job doesn't exist yet
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  useEffect(() => {
    let timer: any;
    if (
      activeStatus?.status === 'TRAINING' ||
      activeStatus?.status === 'PREPARING' ||
      activeStatus?.status === 'EXTRACTING' ||
      uploading
    ) {
      timer = setInterval(pollStatus, 2000);
    }
    return () => clearInterval(timer);
  }, [activeStatus?.status, uploading, sopName]);

  // Handle preset selection
  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId);
    const p = PRESETS.find((x) => x.id === presetId);
    if (p) {
      if (p.id === 'custom') {
        setSopName('cell_phone_violation');
      } else {
        setSopName(p.id);
      }
      setSopTitle(p.defaultTitle);
      setSopDescription(p.defaultDescription);
      setAlertTitle(p.defaultAlertTitle);
      setAlertMessage(p.defaultAlertMessage);
      setAlertSeverity(p.defaultAlertSeverity);
      setTargetClass(p.targetClass);
      setGeneralizeWeapon(p.generalize);
      setEpochs(p.epochs);
      setBaseModel(p.baseModel);
    }
  };

  // Quick slug generator when editing custom SOP title
  const handleTitleChange = (val: string) => {
    setSopTitle(val);
    if (selectedPreset === 'custom') {
      const slug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      if (slug) {
        setSopName(slug);
      }
    }
  };

  const handleStartTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      showToast('Please select a dataset .zip archive to upload', 'error');
      return;
    }

    if (!sopName.trim()) {
      showToast('Please provide a valid SOP identifier name', 'error');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sop_name', sopName.trim().toLowerCase());
    formData.append('sop_title', sopTitle.trim() || sopName);
    formData.append('sop_description', sopDescription.trim());
    formData.append('target_class', targetClass.trim() || 'target');
    formData.append('alert_title', alertTitle.trim() || `${sopName.toUpperCase()} ALERT`);
    formData.append('alert_message', alertMessage.trim());
    formData.append('alert_severity', alertSeverity);
    formData.append('generalize_weapon', String(generalizeWeapon));
    formData.append('base_model', baseModel);
    formData.append('epochs', String(epochs));
    formData.append('batch_size', String(batchSize));

    try {
      const res = await api.post('/training/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || file.size;
          const current = progressEvent.loaded;
          const pct = Math.round((current * 100) / total);
          setUploadProgress(pct);
        },
      });

      showToast(`Training initiated for SOP: ${sopTitle || sopName}`);
      setActiveStatus(res.data);
      setTimeout(pollStatus, 1500);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to start training';
      showToast(msg, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeploy = async (modelSop: string) => {
    setDeployingSop(modelSop);
    try {
      await api.post(`/training/deploy/${modelSop}`);
      showToast(`Model '${modelSop}.pt' successfully deployed to live camera detectors!`);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to deploy model';
      showToast(msg, 'error');
    } finally {
      setDeployingSop(null);
    }
  };

  const previewMessage = alertMessage.replace(/\{camera_id\}/g, 'Camera-02 (Hazard Zone)');
  const currentSeverityStyle = SEVERITY_CONFIG[alertSeverity] || SEVERITY_CONFIG.HIGH;

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold flex items-center gap-3 backdrop-blur-xl animate-in slide-in-from-bottom-5',
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          )}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 shadow-lg shadow-indigo-500/10">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                Model Training & Fine-Tuning
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  YOLOv8 Accelerated
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload annotated datasets in ZIP format, train specialized vision models, and auto-deploy to live cameras
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            fetchModels();
            pollStatus();
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all self-start md:self-auto"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Hardware & Pipeline KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Inference Hardware</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-lg font-bold text-white mt-1.5">GTX 1660 SUPER</p>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            CUDA:0 Acceleration Active
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Trained SOP Models</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-lg font-bold text-white mt-1.5">{models.length}</p>
          <p className="text-[11px] text-slate-400 mt-1">Available in ModelRegistry</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Weapon Generalization</span>
            <ShieldAlert className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-lg font-bold text-white mt-1.5">
            {generalizeWeapon ? 'Enabled' : 'Disabled'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {generalizeWeapon ? 'Unified "Weapon Detected" Alerts' : 'Custom Class Direct Naming'}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Training Pipeline</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-lg font-bold text-white mt-1.5">
            {activeStatus?.status === 'TRAINING' ? 'Training in Progress' : 'Ready / Idle'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {activeStatus?.status === 'TRAINING'
              ? `Epoch ${activeStatus.epoch}/${activeStatus.total_epochs}`
              : 'Auto-split & class remapping'}
          </p>
        </div>
      </div>

      {/* Main Grid: Configuration & Upload + Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configuration & Upload (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleStartTraining} className="space-y-6">
            {/* Step 1: Select SOP Preset */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-extrabold">1</span>
                    Choose Training Target / SOP
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Select a detection objective or build a custom SOP vision model</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRESETS.map((p) => {
                  const Icon = p.icon;
                  const isSelected = selectedPreset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePresetSelect(p.id)}
                      className={cn(
                        'text-left p-3.5 rounded-xl border transition-all relative overflow-hidden',
                        isSelected
                          ? 'border-blue-500/60 bg-blue-500/10 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/50'
                          : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/60'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn('p-2 rounded-lg border bg-gradient-to-br', p.color)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">{p.desc}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Weapon Generalization Notice */}
              {generalizeWeapon && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Unified Weapon Mode Active:</strong> All knife, bat, gun, blade, and rifle annotations in your ZIP dataset will be automatically remapped to a single class (<code>weapon</code>). The fine-tuned model and alerts will universally say <strong>&quot;Weapon Detected&quot;</strong> rather than naming individual objects.
                  </p>
                </div>
              )}
            </div>

            {/* Step 2: Custom SOP Specification & Alert Engine */}
            <div className={cn(
              'p-5 rounded-2xl bg-slate-900/80 border shadow-xl space-y-5 transition-all',
              selectedPreset === 'custom'
                ? 'border-blue-500/50 shadow-blue-500/5 ring-1 ring-blue-500/20'
                : 'border-slate-800/80'
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-extrabold">2</span>
                    Custom SOP Specification & Alert Engine
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Define what this SOP is, why it is being trained, and what alert to emit
                  </p>
                </div>
                {selectedPreset === 'custom' && (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    Custom SOP Active
                  </span>
                )}
              </div>

              {/* Section A: What it is */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-950/50 border border-slate-800/60">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                  <Tag className="w-3.5 h-3.5" />
                  <span>1. What It Is (SOP Identity)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      SOP Name / Display Title
                    </label>
                    <input
                      type="text"
                      value={sopTitle}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="e.g. Cell Phone Usage in Hazard Zone"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Human-readable name in registry and alerts
                    </span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      System Tag / Model Slug
                    </label>
                    <input
                      type="text"
                      value={sopName}
                      onChange={(e) => setSopName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="e.g. cell_phone_violation"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block font-mono">
                      Weight file: {sopName || 'sop'}.pt
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1 text-xs">
                    Target Class in Dataset
                  </label>
                  <input
                    type="text"
                    value={targetClass}
                    onChange={(e) => setTargetClass(e.target.value)}
                    placeholder="e.g. phone, forklift, spill, no_vest"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-mono text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Annotation class label in your YOLO dataset labels folder
                  </span>
                </div>
              </div>

              {/* Section B: Why it is being trained */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-950/50 border border-slate-800/60">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-400">
                  <FileText className="w-3.5 h-3.5" />
                  <span>2. Why It Is Being Trained (Operational Context & Policy)</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1 text-xs">
                    Operational Reason / Safety Standard
                  </label>
                  <textarea
                    rows={2}
                    value={sopDescription}
                    onChange={(e) => setSopDescription(e.target.value)}
                    placeholder="e.g. Enforce OSHA standard 1910.178 distraction prevention rule prohibiting handheld electronics within 5 meters of automated machinery."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                  />
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-500">Quick templates:</span>
                    <button
                      type="button"
                      onClick={() => setSopDescription('Distraction prevention and zero-phone safety protocol around robotic packaging conveyors.')}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    >
                      + Distraction Safety
                    </button>
                    <button
                      type="button"
                      onClick={() => setSopDescription('Cleanroom sterility compliance requiring approved sanitary garments and gear before airlock access.')}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    >
                      + Cleanroom Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => setSopDescription('Pedestrian and vehicle collision prevention in high-density warehouse loading corridors.')}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    >
                      + Forklift Zone
                    </button>
                  </div>
                </div>
              </div>

              {/* Section C: What alert to generate */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-950/50 border border-slate-800/60">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
                  <BellRing className="w-3.5 h-3.5" />
                  <span>3. What Alert To Generate (Real-Time Notification Engine)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Alert Title / Headline
                    </label>
                    <input
                      type="text"
                      value={alertTitle}
                      onChange={(e) => setAlertTitle(e.target.value)}
                      placeholder="e.g. ⚠️ RESTRICTED PHONE DETECTED"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Prominent alert banner headline for live operators
                    </span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Alert Severity Level
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((lvl) => {
                        const isLvlSelected = alertSeverity === lvl;
                        const cfg = SEVERITY_CONFIG[lvl];
                        return (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setAlertSeverity(lvl)}
                            className={cn(
                              'py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all text-center',
                              isLvlSelected
                                ? `${cfg.bg} ${cfg.border} ${cfg.text} shadow-sm ring-1 ring-white/10`
                                : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                            )}
                          >
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Controls toast color, alert tone, and priority
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1 text-xs">
                    Alert Message Template (Supports <code className="text-cyan-400">`{'{camera_id}'}`</code>)
                  </label>
                  <input
                    type="text"
                    value={alertMessage}
                    onChange={(e) => setAlertMessage(e.target.value)}
                    placeholder="e.g. Unauthorized mobile device active in operating perimeter on {camera_id}"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Use <code className="text-cyan-400">{'{camera_id}'}</code> for dynamic camera name injection at detection time
                  </span>
                </div>

                {/* Live Alert Toast Preview */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-2">
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>Live Operator Alert Preview:</span>
                  </div>

                  <div className={cn(
                    'p-3.5 rounded-xl border flex items-center justify-between gap-3 backdrop-blur-xl shadow-lg transition-all',
                    currentSeverityStyle.bg,
                    currentSeverityStyle.border,
                    currentSeverityStyle.glow
                  )}>
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={cn('p-2 rounded-lg border shrink-0', currentSeverityStyle.badge)}>
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-xs font-black tracking-wide uppercase', currentSeverityStyle.text)}>
                            {alertTitle || 'ALERT DETECTED'}
                          </span>
                          <span className={cn('text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase border', currentSeverityStyle.badge)}>
                            {alertSeverity}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-200 mt-0.5 font-medium truncate">
                          {previewMessage}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">Just now</span>
                      <div className="px-2 py-1 rounded bg-slate-900/80 border border-slate-700/60 text-[10px] font-semibold text-slate-300">
                        Watch Feed
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Upload ZIP Dataset */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-extrabold">3</span>
                  Upload Dataset (.ZIP)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload a ZIP file containing images and YOLO annotation .txt files (Roboflow, CVAT, LabelImg format)
                </p>
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) {
                    setFile(e.dataTransfer.files[0]);
                  }
                }}
                className={cn(
                  'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
                  file
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-slate-700/80 hover:border-blue-500/50 hover:bg-slate-800/30'
                )}
                onClick={() => {
                  const input = document.getElementById('dataset-zip-input') as HTMLInputElement;
                  input?.click();
                }}
              >
                <input
                  id="dataset-zip-input"
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setFile(e.target.files[0]);
                  }}
                />

                {file ? (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                      <FileArchive className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{file.name}</p>
                      <p className="text-xs text-emerald-400 mt-0.5">
                        {(file.size / (1024 * 1024)).toFixed(1)} MB • Ready for training
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-500 hover:text-slate-300 underline mt-1">
                      Click to choose a different file
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2.5">
                    <div className="p-3 rounded-xl bg-slate-800/60 text-slate-400">
                      <Upload className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-200">
                        Drag and drop your dataset <code className="text-blue-400">.zip</code> archive here
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Supports up to 500 MB (Auto-detects images, labels, and generates 80/20 splits)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 4: Hyperparameters & Execution */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-extrabold">4</span>
                  Training Hyperparameters
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Fine-tune base architecture, training epochs, and batch size</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Base Architecture</label>
                  <select
                    value={baseModel}
                    onChange={(e) => setBaseModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="yolov8n.pt">YOLOv8 Nano (Fastest, ~5 min)</option>
                    <option value="yolov8s.pt">YOLOv8 Small (Balanced)</option>
                    <option value="yolov8m.pt">YOLOv8 Medium (High Precision)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Epochs</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={epochs}
                    onChange={(e) => setEpochs(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Batch Size</label>
                  <select
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value={8}>8 (Low VRAM)</option>
                    <option value={16}>16 (Recommended for GTX 1660)</option>
                    <option value={32}>32 (Fastest throughput)</option>
                  </select>
                </div>
              </div>

              {/* Upload Progress Bar */}
              {uploading && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Uploading dataset archive...</span>
                    <span className="font-bold text-white">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={uploading || !file || activeStatus?.status === 'TRAINING'}
                className="w-full py-3.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading & Preparing Dataset...
                  </>
                ) : activeStatus?.status === 'TRAINING' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Training in Progress ({activeStatus.progress_pct}%)
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    Start YOLO Model Training
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Live Monitor & Registry (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Progress Card */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                Live Training Monitor
              </h2>
              {activeStatus && (
                <span
                  className={cn(
                    'text-[10px] font-extrabold px-2 py-0.5 rounded-full border',
                    activeStatus.status === 'TRAINING'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
                      : activeStatus.status === 'COMPLETED'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : activeStatus.status === 'FAILED'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  )}
                >
                  {activeStatus.status}
                </span>
              )}
            </div>

            {activeStatus ? (
              <div className="space-y-4">
                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      Epoch {activeStatus.epoch} / {activeStatus.total_epochs}
                    </span>
                    <span className="font-mono font-bold text-white">{activeStatus.progress_pct}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 transition-all duration-300"
                      style={{ width: `${Math.max(activeStatus.progress_pct, 4)}%` }}
                    />
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Box Loss</span>
                    <p className="text-xs font-mono font-bold text-slate-200 mt-0.5">
                      {activeStatus.box_loss ? activeStatus.box_loss.toFixed(4) : '0.0000'}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Class Loss</span>
                    <p className="text-xs font-mono font-bold text-slate-200 mt-0.5">
                      {activeStatus.cls_loss ? activeStatus.cls_loss.toFixed(4) : '0.0000'}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">mAP50</span>
                    <p className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                      {activeStatus.map50 ? (activeStatus.map50 * 100).toFixed(1) + '%' : '--'}
                    </p>
                  </div>
                </div>

                {/* Terminal Logs Output */}
                <div className="rounded-xl bg-black/80 border border-slate-800/80 p-3 h-52 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1">
                  {activeStatus.logs && activeStatus.logs.length > 0 ? (
                    activeStatus.logs.map((line, idx) => (
                      <div key={idx} className="leading-tight break-all text-slate-400">
                        {line}
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-600 italic">No output logs yet...</div>
                  )}
                  <div ref={logsEndRef} />
                </div>
              </div>
            ) : (
              <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl space-y-2">
                <HardDrive className="w-8 h-8 text-slate-700 mx-auto" />
                <p className="text-xs text-slate-400 font-semibold">No Active Training Job</p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Upload a dataset to start a new fine-tuning run. Real-time loss and accuracy curves will stream here.
                </p>
              </div>
            )}
          </div>

          {/* Model Registry Card */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  Model Registry & Deployment
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Deploy fine-tuned weights to live cameras</p>
              </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {models.length > 0 ? (
                models.map((m) => {
                  const severityKey = (m.alert_severity as keyof typeof SEVERITY_CONFIG) || 'HIGH';
                  const sevStyle = SEVERITY_CONFIG[severityKey] || SEVERITY_CONFIG.HIGH;
                  const displayTitle = m.title || m.sop_name.replace(/_/g, ' ');

                  return (
                    <div
                      key={m.sop_name}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white capitalize truncate">
                              {displayTitle}
                            </span>
                            {m.alert_severity && (
                              <span className={cn('text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase border', sevStyle.badge)}>
                                {m.alert_severity}
                              </span>
                            )}
                            {m.map50 !== null && m.map50 !== undefined && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                                mAP: {(m.map50 * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>

                          {m.description && (
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                              {m.description}
                            </p>
                          )}

                          <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[10px] text-slate-400">
                            <span className="font-mono text-slate-300">
                              {m.sop_name}.pt • {m.epochs ? `${m.epochs} ep` : 'pretrained'}
                            </span>
                            {m.alert_title && (
                              <span className="flex items-center gap-1 text-rose-400/90 font-medium truncate max-w-[200px]">
                                <BellRing className="w-3 h-3 shrink-0" />
                                {m.alert_title}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeploy(m.sop_name)}
                          disabled={deployingSop === m.sop_name}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600/90 hover:bg-blue-500 text-white transition-colors shrink-0 disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                        >
                          {deployingSop === m.sop_name ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Deploying...
                            </>
                          ) : (
                            'Deploy'
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-500 italic text-center py-6">
                  No fine-tuned models registered yet. Train a model to see it here.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
