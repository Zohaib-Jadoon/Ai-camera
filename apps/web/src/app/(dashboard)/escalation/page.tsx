'use client';

import { useState } from 'react';
import { Plus, Edit, Trash2, Loader2, Clock, Mail, MessageSquare, Webhook, Bell, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useEscalationPolicies,
  useCreateEscalationPolicy,
  useUpdateEscalationPolicy,
  useDeleteEscalationPolicy,
  EscalationPolicy,
  EscalationStep,
} from '@/hooks/use-api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const severityOptions = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const channelIcons: Record<string, any> = { email: Mail, sms: MessageSquare, webhook: Webhook, push: Bell };

export default function EscalationPage() {
  const { data: policies = [], isLoading } = useEscalationPolicies();
  const createPolicy = useCreateEscalationPolicy();
  const updatePolicy = useUpdateEscalationPolicy();
  const deletePolicy = useDeleteEscalationPolicy();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    alert_type: '',
    min_severity: 'MEDIUM' as string,
    enabled: true,
    steps: [] as Array<{ step_number: number; delay_min: number; channel: string; target: string }>,
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', alert_type: '', min_severity: 'MEDIUM', enabled: true, steps: [] });
    setShowModal(true);
  };

  const openEdit = (policy: EscalationPolicy) => {
    setEditingId(policy.id);
    setForm({
      name: policy.name,
      alert_type: policy.alert_type || '',
      min_severity: policy.min_severity,
      enabled: policy.enabled,
      steps: policy.steps?.map((s) => ({ ...s })) || [],
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({ name: '', alert_type: '', min_severity: 'MEDIUM', enabled: true, steps: [] });
  };

  const handleSave = async () => {
    const payload = {
      ...form,
      steps: form.steps.map((s, i) => ({ ...s, step_number: i + 1, channel: s.channel as EscalationStep['channel'] })),
    };
    if (editingId) {
      await updatePolicy.mutateAsync({ id: editingId, ...payload });
    } else {
      await createPolicy.mutateAsync(payload);
    }
    closeModal();
  };

  const addStep = () => {
    setForm((prev) => ({
      ...prev,
      steps: [...prev.steps, { step_number: prev.steps.length + 1, delay_min: 5, channel: 'email', target: '' }],
    }));
  };

  const removeStep = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== idx),
    }));
  };

  const updateStep = (idx: number, field: string, value: any) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Escalation Policies</h1>
          <p className="text-sm text-slate-500">{policies.length} policies configured</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Policy
        </button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : (
          policies.map((policy) => (
            <div key={policy.id} className="glass-card rounded-xl border border-slate-800/60 p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">{policy.name}</h3>
                    {!policy.enabled && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700">Disabled</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Min severity: <span className="text-slate-300">{policy.min_severity}</span>
                    {policy.alert_type && <span> · Alert type: {policy.alert_type}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(policy)}
                    className="p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-blue-400"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deletePolicy.mutate(policy.id)}
                    disabled={deletePolicy.isPending}
                    className="p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-red-400 disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {policy.steps && policy.steps.length > 0 && (
                <div className="space-y-2">
                  {policy.steps.map((step, i) => {
                    const Icon = channelIcons[step.channel] || Mail;
                    return (
                      <div key={i} className="flex items-center gap-3 text-xs text-slate-400 bg-slate-900/40 rounded-lg px-3 py-2 border border-slate-800/60">
                        <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-[10px] font-bold border border-blue-500/20">
                          {step.step_number}
                        </span>
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{step.delay_min} min</span>
                        <Icon className="w-3.5 h-3.5 text-slate-500" />
                        <span className="capitalize">{step.channel}</span>
                        <span className="text-slate-500 ml-auto truncate max-w-[200px]">{step.target}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
        {!isLoading && policies.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-xs">No escalation policies found</div>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={(v) => !v && closeModal()}>
        <DialogContent className="sm:max-w-lg glass-card border-slate-800/60 text-slate-200 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{editingId ? 'Edit Policy' : 'Add Escalation Policy'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                placeholder="Policy name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Alert Type (optional)</label>
                <input
                  value={form.alert_type}
                  onChange={(e) => setForm((p) => ({ ...p, alert_type: e.target.value }))}
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                  placeholder="e.g. intrusion"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Min Severity</label>
                <select
                  value={form.min_severity}
                  onChange={(e) => setForm((p) => ({ ...p, min_severity: e.target.value }))}
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                >
                  {severityOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
                className="accent-blue-500"
              />
              <span className="text-xs text-slate-300">Enabled</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">Escalation Steps</label>
                <button
                  onClick={addStep}
                  className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Step
                </button>
              </div>
              {form.steps.map((step, idx) => (
                <div key={idx} className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 items-center bg-slate-900/40 rounded-lg p-3 border border-slate-800/60">
                  <span className="text-[10px] text-slate-500 font-mono">{idx + 1}</span>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Delay (min)</label>
                    <input
                      type="number"
                      value={step.delay_min}
                      onChange={(e) => updateStep(idx, 'delay_min', Number(e.target.value))}
                      className="w-full bg-slate-900/60 border border-slate-700/60 rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Channel</label>
                    <select
                      value={step.channel}
                      onChange={(e) => updateStep(idx, 'channel', e.target.value)}
                      className="w-full bg-slate-900/60 border border-slate-700/60 rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-blue-500/50"
                    >
                      {Object.keys(channelIcons).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Target</label>
                    <input
                      value={step.target}
                      onChange={(e) => updateStep(idx, 'target', e.target.value)}
                      className="w-full bg-slate-900/60 border border-slate-700/60 rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-blue-500/50"
                      placeholder="email / phone / URL"
                    />
                  </div>
                  <button
                    onClick={() => removeStep(idx)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <button onClick={closeModal} className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={createPolicy.isPending || updatePolicy.isPending}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {(createPolicy.isPending || updatePolicy.isPending) && <Loader2 className="w-3 h-3 animate-spin" />}
              {editingId ? 'Save Changes' : 'Create Policy'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
