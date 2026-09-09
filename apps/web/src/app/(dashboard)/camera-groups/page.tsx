'use client';
import { runUiAction } from '@/lib/ui-action';

import { useState } from 'react';
import { Plus, Edit, Trash2, Loader2, Camera, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCameraGroups,
  useCreateCameraGroup,
  useUpdateCameraGroup,
  useDeleteCameraGroup,
  useCameras,
  CameraGroup,
} from '@/hooks/use-api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function CameraGroupsPage() {
  const { data: groups = [], isLoading } = useCameraGroups();
  const { data: cameras = [] } = useCameras();
  const createGroup = useCreateCameraGroup();
  const updateGroup = useUpdateCameraGroup();
  const deleteGroup = useDeleteCameraGroup();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', location: '', camera_ids: [] as string[] });

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', location: '', camera_ids: [] });
    setShowModal(true);
  };

  const openEdit = (group: CameraGroup) => {
    setEditingId(group.id);
    setForm({
      name: group.name,
      location: group.location || '',
      camera_ids: group.cameras?.map((c) => c.id) || [],
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({ name: '', location: '', camera_ids: [] });
  };

  const handleSave = async () => {
    if (editingId) {
      await updateGroup.mutateAsync({ id: editingId, ...form });
    } else {
      await createGroup.mutateAsync(form);
    }
    closeModal();
  };

  const toggleCamera = (id: string) => {
    setForm((prev) => ({
      ...prev,
      camera_ids: prev.camera_ids.includes(id)
        ? prev.camera_ids.filter((c) => c !== id)
        : [...prev.camera_ids, id],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Camera Groups</h1>
          <p className="text-sm text-slate-500">{groups.length} groups configured</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Group
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div
              key={group.id}
              className="glass-card rounded-xl border border-slate-800/60 p-5 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">{group.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{group.location || 'No location'}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(group)}
                    className="p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-blue-400"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteGroup.mutate(group.id)}
                    disabled={deleteGroup.isPending}
                    className="p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-red-400 disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Camera className="w-3.5 h-3.5" />
                <span>{group.cameras?.length || 0} cameras</span>
              </div>

              {group.cameras && group.cameras.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {group.cameras.map((c) => (
                    <span
                      key={c.id}
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded border',
                        c.status === 'ONLINE'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-slate-800 border-slate-700 text-slate-500'
                      )}
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {groups.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500 text-xs">
              No camera groups found
            </div>
          )}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={(v) => !v && closeModal()}>
        <DialogContent className="sm:max-w-lg glass-card border-slate-800/60 text-slate-200 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingId ? 'Edit Camera Group' : 'Add Camera Group'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                placeholder="Group name"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                placeholder="Building A"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-2">Cameras</label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {cameras.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.camera_ids.includes(c.id)}
                      onChange={() => toggleCamera(c.id)}
                      className="accent-blue-500"
                    />
                    <span>{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <button onClick={closeModal} className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              onClick={() => runUiAction(handleSave)}
              disabled={createGroup.isPending || updateGroup.isPending}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {(createGroup.isPending || updateGroup.isPending) && <Loader2 className="w-3 h-3 animate-spin" />}
              {editingId ? 'Save Changes' : 'Create Group'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
