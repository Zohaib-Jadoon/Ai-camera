'use client';

import { useState } from 'react';
import { Plus, Edit, Trash2, Loader2, Webhook, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  WebhookConfig,
} from '@/hooks/use-api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const eventOptions = ['alert.created', 'camera.offline', 'camera.online', 'alert.acknowledged'];

export default function WebhooksPage() {
  const { data: webhooks = [], isLoading } = useWebhooks();
  const createWebhook = useCreateWebhook();
  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: '',
    enabled: true,
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', url: '', events: [], secret: '', enabled: true });
    setShowModal(true);
  };

  const openEdit = (wh: WebhookConfig) => {
    setEditingId(wh.id);
    setForm({
      name: wh.name,
      url: wh.url,
      events: wh.events || [],
      secret: wh.secret || '',
      enabled: wh.enabled,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({ name: '', url: '', events: [], secret: '', enabled: true });
  };

  const handleSave = async () => {
    if (editingId) {
      await updateWebhook.mutateAsync({ id: editingId, ...form });
    } else {
      await createWebhook.mutateAsync(form);
    }
    closeModal();
  };

  const toggleEvent = (evt: string) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(evt) ? prev.events.filter((e) => e !== evt) : [...prev.events, evt],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Webhook Integrations</h1>
          <p className="text-sm text-slate-500">{webhooks.length} webhooks configured</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Webhook
        </button>
      </div>

      <div className="glass-card rounded-xl border border-slate-800/60 overflow-hidden">
        <div className="grid grid-cols-[1fr_1.5fr_1fr_auto_auto_auto] gap-4 px-4 py-3 border-b border-slate-800/60 text-[10px] text-slate-500 uppercase tracking-wider font-semibold items-center">
          <span>Name</span>
          <span>URL</span>
          <span>Events</span>
          <span>Enabled</span>
          <span>Test</span>
          <span className="text-right">Actions</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-slate-800/30">
            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className="grid grid-cols-[1fr_1.5fr_1fr_auto_auto_auto] gap-4 items-center px-4 py-3 hover:bg-slate-800/20 transition-colors"
              >
                <span className="text-xs text-white font-medium truncate">{wh.name}</span>
                <span className="text-xs text-slate-400 truncate">{wh.url}</span>
                <div className="flex flex-wrap gap-1">
                  {(wh.events || []).map((e) => (
                    <span key={e} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {e}
                    </span>
                  ))}
                </div>
                <span className={cn('text-[10px] font-bold', wh.enabled ? 'text-emerald-400' : 'text-slate-500')}>
                  {wh.enabled ? 'ON' : 'OFF'}
                </span>
                <button
                  onClick={() => fetch('/api/webhooks/test', { method: 'POST', body: JSON.stringify({ id: wh.id }) })}
                  className="p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-blue-400"
                  title="Test webhook"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => openEdit(wh)}
                    className="p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-blue-400"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteWebhook.mutate(wh.id)}
                    disabled={deleteWebhook.isPending}
                    className="p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-red-400 disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {webhooks.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-xs">No webhooks configured</div>
            )}
          </div>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={(v) => !v && closeModal()}>
        <DialogContent className="sm:max-w-lg glass-card border-slate-800/60 text-slate-200 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{editingId ? 'Edit Webhook' : 'Add Webhook'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                placeholder="Slack Alerts"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">URL</label>
              <input
                value={form.url}
                onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                placeholder="https://hooks.slack.com/services/..."
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-2">Events</label>
              <div className="flex flex-wrap gap-2">
                {eventOptions.map((e) => (
                  <button
                    key={e}
                    onClick={() => toggleEvent(e)}
                    className={cn(
                      'px-2 py-1 text-[10px] font-medium rounded border transition-colors',
                      form.events.includes(e)
                        ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Secret (optional)</label>
              <input
                type="password"
                value={form.secret}
                onChange={(e) => setForm((p) => ({ ...p, secret: e.target.value }))}
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                placeholder="HMAC signing key"
              />
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
            <button onClick={closeModal} className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={createWebhook.isPending || updateWebhook.isPending}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {(createWebhook.isPending || updateWebhook.isPending) && <Loader2 className="w-3 h-3 animate-spin" />}
              {editingId ? 'Save Changes' : 'Create Webhook'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
