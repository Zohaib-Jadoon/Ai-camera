'use client';

import { useState } from 'react';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useAlertRules,
  useCreateAlertRule,
  useUpdateAlertRule,
  useDeleteAlertRule,
  useCameras,
  AlertRule,
} from '@/hooks/use-api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const actionOptions = ['email', 'sms', 'webhook', 'push'];
const dayOptions = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const defaultForm: Partial<AlertRule> = {
  name: '',
  camera_id: '',
  object_type: '',
  alert_type: '',
  severity: 'HIGH',
  schedule_mode: 'ALWAYS',
  cooldown_seconds: 60,
  actions: [],
  schedule_days: [],
  schedule_start_time: '',
  schedule_end_time: '',
  enabled: true,
};

export default function AlertRulesPage() {
  const { data: rules = [], isLoading } = useAlertRules();
  const { data: cameras = [] } = useCameras();
  const createRule = useCreateAlertRule();
  const updateRule = useUpdateAlertRule();
  const deleteRule = useDeleteAlertRule();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<AlertRule>>(defaultForm);

  const openCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEdit = (rule: AlertRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      camera_id: rule.camera_id || '',
      object_type: rule.object_type,
      alert_type: rule.alert_type,
      severity: rule.severity,
      schedule_mode: rule.schedule_mode,
      cooldown_seconds: rule.cooldown_seconds,
      actions: rule.actions || [],
      schedule_days: rule.schedule_days || [],
      schedule_start_time: rule.schedule_start_time || '',
      schedule_end_time: rule.schedule_end_time || '',
      enabled: rule.enabled,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(defaultForm);
  };

  const handleSave = async () => {
    const payload = { ...form };
    if (payload.schedule_mode === 'ALWAYS') {
      delete payload.schedule_days;
      delete payload.schedule_start_time;
      delete payload.schedule_end_time;
    }
    if (editingId) {
      await updateRule.mutateAsync({ id: editingId, ...payload });
    } else {
      await createRule.mutateAsync(payload);
    }
    closeModal();
  };

  const toggleEnabled = async (rule: AlertRule) => {
    await updateRule.mutateAsync({ id: rule.id, enabled: !rule.enabled });
  };

  const toggleAction = (action: string) => {
    setForm((prev) => {
      const current = prev.actions || [];
      return {
        ...prev,
        actions: current.includes(action) ? current.filter((a) => a !== action) : [...current, action],
      };
    });
  };

  const toggleDay = (day: string) => {
    setForm((prev) => {
      const current = prev.schedule_days || [];
      return {
        ...prev,
        schedule_days: current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Alert Rules</h1>
          <p className="text-sm text-slate-500">{rules.length} rules configured</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Rule
        </button>
      </div>

      <div className="glass-card rounded-xl border border-slate-800/60 overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto_auto_auto_auto] gap-4 px-4 py-3 border-b border-slate-800/60 text-[10px] text-slate-500 uppercase tracking-wider font-semibold items-center">
          <span>Name</span>
          <span>Camera</span>
          <span>Object Type</span>
          <span>Alert Type</span>
          <span>Severity</span>
          <span>Schedule</span>
          <span>Enabled</span>
          <span className="text-right">Actions</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-slate-800/30">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="grid grid-cols-[1fr_1fr_1fr_1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-3 hover:bg-slate-800/20 transition-colors"
              >
                <span className="text-xs text-white font-medium truncate">{rule.name}</span>
                <span className="text-xs text-slate-400 truncate">{rule.camera?.name || 'Any'}</span>
                <span className="text-xs text-slate-400">{rule.object_type}</span>
                <span className="text-xs text-slate-400">{rule.alert_type}</span>
                <span
                  className={cn(
                    'text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase w-fit',
                    rule.severity === 'CRITICAL' && 'text-red-400 bg-red-500/10 border-red-500/20',
                    rule.severity === 'HIGH' && 'text-orange-400 bg-orange-500/10 border-orange-500/20',
                    rule.severity === 'MEDIUM' && 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                    rule.severity === 'LOW' && 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                  )}
                >
                  {rule.severity}
                </span>
                <span className="text-[10px] text-slate-500">{rule.schedule_mode}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => toggleEnabled(rule)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                </label>
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => openEdit(rule)}
                    className="p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-blue-400"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteRule.mutate(rule.id)}
                    disabled={deleteRule.isPending}
                    className="p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-red-400 disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {rules.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-xs">No alert rules found</div>
            )}
          </div>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={(v) => !v && closeModal()}>
        <DialogContent className="sm:max-w-lg glass-card border-slate-800/60 text-slate-200 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{editingId ? 'Edit Alert Rule' : 'Add Alert Rule'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                placeholder="Rule name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Camera</label>
                <select
                  value={form.camera_id}
                  onChange={(e) => setForm((p) => ({ ...p, camera_id: e.target.value }))}
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                >
                  <option value="">Any camera</option>
                  {cameras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Severity</label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                >
                  {severities.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Object Type</label>
                <input
                  value={form.object_type}
                  onChange={(e) => setForm((p) => ({ ...p, object_type: e.target.value }))}
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                  placeholder="e.g. person, car"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Alert Type</label>
                <input
                  value={form.alert_type}
                  onChange={(e) => setForm((p) => ({ ...p, alert_type: e.target.value }))}
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                  placeholder="e.g. intrusion"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Schedule Mode</label>
                <select
                  value={form.schedule_mode}
                  onChange={(e) => setForm((p) => ({ ...p, schedule_mode: e.target.value as 'ALWAYS' | 'SCHEDULED' }))}
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                >
                  <option value="ALWAYS">Always</option>
                  <option value="SCHEDULED">Scheduled</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Cooldown (seconds)</label>
                <input
                  type="number"
                  value={form.cooldown_seconds}
                  onChange={(e) => setForm((p) => ({ ...p, cooldown_seconds: Number(e.target.value) }))}
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>

            {form.schedule_mode === 'SCHEDULED' && (
              <div className="space-y-3 p-3 rounded-lg bg-slate-900/40 border border-slate-800/60">
                <label className="block text-xs text-slate-400">Days</label>
                <div className="flex flex-wrap gap-2">
                  {dayOptions.map((d) => (
                    <button
                      key={d}
                      onClick={() => toggleDay(d)}
                      className={cn(
                        'px-2 py-1 text-[10px] font-medium rounded border transition-colors',
                        form.schedule_days?.includes(d)
                          ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                          : 'bg-slate-800 border-slate-700 text-slate-500'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={form.schedule_start_time}
                      onChange={(e) => setForm((p) => ({ ...p, schedule_start_time: e.target.value }))}
                      className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">End Time</label>
                    <input
                      type="time"
                      value={form.schedule_end_time}
                      onChange={(e) => setForm((p) => ({ ...p, schedule_end_time: e.target.value }))}
                      className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-400 mb-2">Actions</label>
              <div className="flex flex-wrap gap-3">
                {actionOptions.map((a) => (
                  <label key={a} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.actions?.includes(a)}
                      onChange={() => toggleAction(a)}
                      className="accent-blue-500"
                    />
                    <span className="capitalize">{a}</span>
                  </label>
                ))}
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
          </div>
          <DialogFooter>
            <button
              onClick={closeModal}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={createRule.isPending || updateRule.isPending}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {(createRule.isPending || updateRule.isPending) && <Loader2 className="w-3 h-3 animate-spin" />}
              {editingId ? 'Save Changes' : 'Create Rule'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
