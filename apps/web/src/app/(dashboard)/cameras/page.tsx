'use client';

import { useState } from 'react';
import { Plus, Search, Wifi, WifiOff, MapPin, Edit, Trash2, TestTube, Camera, Loader2, X, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCameras, useCreateCamera, useUpdateCamera, useDeleteCamera, useBulkImportCameras, Camera as CameraType } from '@/hooks/use-api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function CamerasPage() {
  const { data: cameras = [], isLoading } = useCameras();
  const createCamera = useCreateCamera();
  const updateCamera = useUpdateCamera();
  const deleteCamera = useDeleteCamera();
  const bulkImport = useBulkImportCameras();

  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [group, setGroup] = useState('All');

  const [form, setForm] = useState({ name: '', rtsp_url: '', location: '', group: '' });
  const [editForm, setEditForm] = useState({ name: '', rtsp_url: '', location: '' });

  // Bulk import state
  const [showImport, setShowImport] = useState(false);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  const groups = ['All', ...new Set(cameras.map((c) => c.location || 'Uncategorized').filter(Boolean))];
  const filtered = cameras.filter(
    (c) =>
      (group === 'All' || c.location === group) &&
      c.name.toLowerCase().includes(search.toLowerCase())
  );
  const online = cameras.filter((c) => c.status === 'ONLINE' || c.status === 'Online').length;

  const handleCreate = async () => {
    await createCamera.mutateAsync({
      name: form.name,
      rtsp_url: form.rtsp_url,
      location: form.location,
      status: 'OFFLINE',
    });
    setForm({ name: '', rtsp_url: '', location: '', group: '' });
    setShowAdd(false);
  };

  const handleUpdate = async (id: string) => {
    await updateCamera.mutateAsync({
      id,
      name: editForm.name,
      rtsp_url: editForm.rtsp_url,
      location: editForm.location,
    });
    setEditingId(null);
  };

  const startEdit = (cam: CameraType) => {
    setEditForm({ name: cam.name, rtsp_url: cam.rtsp_url, location: cam.location || '' });
    setEditingId(cam.id);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    setImportSuccess('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) {
          setImportError('CSV must have a header row and at least one data row');
          setCsvRows([]);
          return;
        }
        const headers = lines[0].split(',').map((h) => h.trim());
        const rows: Record<string, string>[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map((v) => v.trim());
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
          });
          rows.push(row);
        }
        setCsvRows(rows);
      } catch {
        setImportError('Failed to parse CSV file');
        setCsvRows([]);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImportError('');
    setImportSuccess('');
    if (csvRows.length === 0) return;

    const cameras = csvRows.map((row) => ({
      name: row.name || '',
      rtsp_url: row.rtsp_url || '',
      location: row.location || '',
      detect_url: row.detect_url || undefined,
      record_url: row.record_url || undefined,
      group_id: row.group_id || undefined,
    }));

    try {
      const result = await bulkImport.mutateAsync(cameras);
      setImportSuccess(`Imported ${result.imported} cameras${result.failed > 0 ? `, ${result.failed} failed` : ''}`);
      setCsvRows([]);
    } catch (err: any) {
      setImportError(err?.response?.data?.message || 'Import failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Camera Management</h1>
          <p className="text-sm text-slate-500">
            {online}/{cameras.length} cameras online
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2 rounded-lg border border-slate-700 transition-colors"
          >
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Camera
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="glass-card rounded-xl border border-blue-500/20 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white">Add New Camera</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'name', label: 'Camera Name', placeholder: 'Main Entrance' },
              { key: 'rtsp_url', label: 'RTSP URL', placeholder: 'rtsp://192.168.1.100:554/stream' },
              { key: 'location', label: 'Location', placeholder: 'Building A' },
            ].map((f) => (
              <div key={f.key} className={f.key === 'rtsp_url' ? 'md:col-span-2' : ''}>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{f.label}</label>
                <input
                  value={(form as any)[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-slate-400">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createCamera.isPending}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 text-white text-sm px-4 py-2 rounded-lg"
            >
              {createCamera.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />}
              Save Camera
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cameras..."
            className="w-full bg-slate-900/60 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 max-w-full overflow-x-auto scrollbar-hide">
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap',
                group === g ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((cam) => (
            <CameraCard
              key={cam.id}
              cam={cam}
              isEditing={editingId === cam.id}
              editForm={editForm}
              setEditForm={setEditForm}
              onStartEdit={() => startEdit(cam)}
              onSaveEdit={() => handleUpdate(cam.id)}
              onCancelEdit={() => setEditingId(null)}
              onDelete={() => deleteCamera.mutate(cam.id)}
              isDeleting={deleteCamera.isPending}
              isUpdating={updateCamera.isPending}
            />
          ))}
        </div>
      )}

      <Dialog open={showImport} onOpenChange={(v) => !v && setShowImport(false)}>
        <DialogContent className="sm:max-w-xl glass-card border-slate-800/60 text-slate-200 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Import Cameras from CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800/60">
              <p className="text-[10px] text-slate-500">
                Expected columns: <span className="text-slate-300">name, rtsp_url, location, detect_url, record_url, group_id</span>
              </p>
            </div>

            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-500"
            />

            {importError && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5" />
                {importError}
              </div>
            )}
            {importSuccess && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                <CheckCircle className="w-3.5 h-3.5" />
                {importSuccess}
              </div>
            )}

            {csvRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Preview ({Math.min(csvRows.length, 5)} of {csvRows.length} rows)</p>
                <div className="glass-card rounded-lg border border-slate-800/60 overflow-hidden">
                  <div className="grid grid-cols-[1fr_1.5fr_1fr] gap-2 px-3 py-2 border-b border-slate-800/60 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    <span>name</span>
                    <span>rtsp_url</span>
                    <span>location</span>
                  </div>
                  {csvRows.slice(0, 5).map((row, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1.5fr_1fr] gap-2 px-3 py-2 text-[11px] text-slate-300 border-b border-slate-800/20 last:border-0">
                      <span className="truncate">{row.name}</span>
                      <span className="truncate font-mono text-slate-400">{row.rtsp_url}</span>
                      <span className="truncate">{row.location}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <button
              onClick={() => { setShowImport(false); setCsvRows([]); setImportError(''); setImportSuccess(''); }}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleImport}
              disabled={csvRows.length === 0 || bulkImport.isPending}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {bulkImport.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Import {csvRows.length > 0 ? `${csvRows.length} cameras` : ''}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CameraCard({
  cam,
  isEditing,
  editForm,
  setEditForm,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  isDeleting,
  isUpdating,
}: {
  cam: CameraType;
  isEditing: boolean;
  editForm: { name: string; rtsp_url: string; location: string };
  setEditForm: (f: { name: string; rtsp_url: string; location: string }) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isUpdating: boolean;
}) {
  const isOnline = cam.status === 'ONLINE' || cam.status === 'Online';
  return (
    <div className="glass-card rounded-xl border border-slate-800/60 overflow-hidden group hover:border-slate-700 transition-all">
      <div className="aspect-video bg-slate-950 relative flex items-center justify-center overflow-hidden">
        {cam.snapshot_url ? (
          <img src={cam.snapshot_url} alt={cam.name} className="w-full h-full object-cover" />
        ) : isOnline ? (
          <Camera className="w-8 h-8 text-slate-800" />
        ) : (
          <WifiOff className="w-8 h-8 text-slate-700" />
        )}
        <div className="absolute top-2 left-2">
          <span
            className={cn(
              'text-[9px] font-bold px-2 py-0.5 rounded',
              isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
            )}
          >
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
      <div className="p-4">
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-medium text-slate-400 mb-1">Name</label>
              <input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-400 mb-1">RTSP URL</label>
              <input
                value={editForm.rtsp_url}
                onChange={(e) => setEditForm({ ...editForm, rtsp_url: e.target.value })}
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-400 mb-1">Location</label>
              <input
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onCancelEdit} className="px-3 py-1 text-[10px] text-slate-400">Cancel</button>
              <button
                onClick={onSaveEdit}
                disabled={isUpdating}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[10px] px-3 py-1 rounded-lg"
              >
                {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">{cam.name}</h3>
                <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {cam.location || 'Unknown'}
                </p>
                {cam.last_seen && (
                  <p className="text-[9px] text-slate-600 mt-0.5">
                    Last seen: {new Date(cam.last_seen).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <button onClick={onStartEdit} className="p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-blue-400">
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="mt-2 text-[9px] text-slate-600 font-mono truncate">{cam.rtsp_url}</p>
          </>
        )}
      </div>
    </div>
  );
}
