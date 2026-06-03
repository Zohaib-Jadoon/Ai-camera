'use client';

import { useState } from 'react';
import { Users, Search, UserPlus, Tag, Loader2, X, UploadCloud, Image as ImageIcon, Bell, BellOff, Edit2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePersons, useCreatePerson, useUpdatePerson, useDeletePerson, useUploadImage, Person } from '@/hooks/use-api';

const tagColors: Record<string, string> = {
  Employee: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Family: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  Visitor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  VIP: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Blacklisted: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const TAG_OPTIONS = ['Employee', 'Family', 'Visitor', 'VIP', 'Blacklisted'];

export default function FacesPage() {
  const { data: persons = [], isLoading } = usePersons();
  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();
  const deletePerson = useDeletePerson();
  const uploadImage = useUploadImage();

  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null); // base64 for new-person upload
  const [uploadStatus, setUploadStatus] = useState<{id: string; ok: boolean; msg: string} | null>(null);
  const [form, setForm] = useState({
    name: '',
    tag: '',
    alert_message: '',
    alert_enabled: false,
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  /** Resize + re-encode image to JPEG 80% quality, max 640px — keeps payload under 200 KB. */
  const compressImage = (dataUrl: string): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 640;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = dataUrl;
    });

  const handleFileUpload = (personId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const raw = event.target?.result as string;
      try {
        const compressed = await compressImage(raw);
        await uploadImage.mutateAsync({ personId, imageB64: compressed });
        setUploadStatus({ id: personId, ok: true, msg: 'Face enrolled ✓' });
        setTimeout(() => setUploadStatus(null), 3000);
      } catch (err: any) {
        setUploadStatus({ id: personId, ok: false, msg: err.response?.data?.message || err.message || 'Upload failed' });
        setTimeout(() => setUploadStatus(null), 4000);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleNewPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const compressed = await compressImage(ev.target?.result as string);
      setPendingPhoto(compressed);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };


  const startEdit = (person: Person) => {
    setEditingId(person.id);
    setForm({
      name: person.name,
      tag: person.tag || '',
      alert_message: person.alert_message || '',
      alert_enabled: person.alert_enabled || false,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ name: '', tag: '', alert_message: '', alert_enabled: false });
  };

  const saveEdit = async (id: string) => {
    await updatePerson.mutateAsync({
      id,
      name: form.name,
      tag: form.tag || undefined,
      alert_message: form.alert_message || undefined,
      alert_enabled: form.alert_enabled,
    });
    setEditingId(null);
  };

  const handleCreate = async () => {
    const person = await createPerson.mutateAsync({
      name: form.name,
      tag: form.tag || undefined,
      alert_message: form.alert_message || undefined,
      alert_enabled: form.alert_enabled,
    });
    // If a photo was selected, auto-enroll the face embedding immediately
    if (pendingPhoto && person?.id) {
      try {
        await uploadImage.mutateAsync({ personId: person.id, imageB64: pendingPhoto });
      } catch (_) { /* non-fatal — user can re-upload from the card */ }
    }
    setForm({ name: '', tag: '', alert_message: '', alert_enabled: false });
    setPendingPhoto(null);
    setShowAdd(false);
  };

  const tags = ['All', ...Array.from(new Set(persons.map((p: Person) => p.tag).filter(Boolean) as string[]))];
  const filtered = persons.filter(
    (p) =>
      (tagFilter === 'All' || p.tag === tagFilter) &&
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Face Recognition</h1>
          <p className="text-sm text-slate-500">Manage known persons, watchlists, and custom arrival alerts</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <UserPlus className="w-4 h-4" /> Add Person
        </button>
      </div>

      {showAdd && (
        <div className="glass-card rounded-xl border border-blue-500/20 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Add New Person</h3>
            <button onClick={() => { setShowAdd(false); setPendingPhoto(null); }} className="text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Full name"
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Tag</label>
              <select
                value={form.tag}
                onChange={(e) => setForm((prev) => ({ ...prev, tag: e.target.value }))}
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
              >
                <option value="">Select tag...</option>
                {TAG_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* ── Face Photo Upload ───────────────────────── */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Face Photo <span className="text-slate-600">(required for recognition)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative w-20 h-20 rounded-xl border-2 border-dashed border-slate-700 group-hover:border-blue-500/60 overflow-hidden flex items-center justify-center bg-slate-900/60 transition-colors shrink-0">
                  {pendingPhoto ? (
                    <img src={pendingPhoto} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <UploadCloud className="w-6 h-6 text-slate-600 group-hover:text-blue-400 transition-colors" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-slate-300">{pendingPhoto ? 'Photo selected — click to change' : 'Click to upload a clear face photo'}</p>
                  <p className="text-xs text-slate-600 mt-0.5">JPG, PNG, WEBP · max 5 MB · front-facing works best</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleNewPhotoSelect} />
              </label>
              {!pendingPhoto && (
                <p className="mt-1.5 text-xs text-amber-500/80 flex items-center gap-1">
                  <span>⚠</span> Without a photo the AI will not be able to recognise this person
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Custom Alert Message <span className="text-slate-600">(optional)</span>
              </label>
              <input
                value={form.alert_message}
                onChange={(e) => setForm((prev) => ({ ...prev, alert_message: e.target.value }))}
                placeholder="e.g. VIP Customer Sarah has arrived at the front desk"
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="alert_enabled"
                checked={form.alert_enabled}
                onChange={(e) => setForm((prev) => ({ ...prev, alert_enabled: e.target.checked }))}
                className="accent-blue-500"
              />
              <label htmlFor="alert_enabled" className="text-xs text-slate-300 cursor-pointer">
                Enable arrival alerts for this person
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowAdd(false); setPendingPhoto(null); }} className="px-4 py-2 text-sm text-slate-400">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={createPerson.isPending || uploadImage.isPending || !form.name.trim()}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 text-white text-sm px-4 py-2 rounded-lg"
            >
              {(createPerson.isPending || uploadImage.isPending) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              {uploadImage.isPending ? 'Enrolling face…' : 'Save Person'}
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
            placeholder="Search persons..."
            className="w-full bg-slate-900/60 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5">
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setTagFilter(t)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                tagFilter === t ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              isEditing={editingId === person.id}
              editForm={form}
              setEditForm={setForm}
              onStartEdit={() => startEdit(person)}
              onCancelEdit={cancelEdit}
              onSaveEdit={() => saveEdit(person.id)}
              onDelete={() => deletePerson.mutate(person.id)}
              onUpload={(e) => handleFileUpload(person.id, e)}
              isUploading={uploadImage.isPending && uploadImage.variables?.personId === person.id}
              isDeleting={deletePerson.isPending}
              isSaving={updatePerson.isPending}
              uploadStatus={uploadStatus?.id === person.id ? uploadStatus : null}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500 text-sm">No persons found</div>
          )}
        </div>
      )}
    </div>
  );
}

function PersonCard({
  person,
  isEditing,
  editForm,
  setEditForm,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onUpload,
  isUploading,
  isDeleting,
  isSaving,
  uploadStatus,
}: {
  person: Person;
  isEditing: boolean;
  editForm: { name: string; tag: string; alert_message: string; alert_enabled: boolean };
  setEditForm: React.Dispatch<React.SetStateAction<{ name: string; tag: string; alert_message: string; alert_enabled: boolean }>>;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploading: boolean;
  isDeleting: boolean;
  isSaving: boolean;
  uploadStatus: { ok: boolean; msg: string } | null;
}) {
  if (isEditing) {
    return (
      <div className="glass-card rounded-xl border border-blue-500/30 p-5 space-y-4">
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-slate-500 mb-1">Name</label>
            <input
              value={editForm.name}
              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-1">Tag</label>
            <select
              value={editForm.tag}
              onChange={(e) => setEditForm((prev) => ({ ...prev, tag: e.target.value }))}
              className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
            >
              <option value="">Select tag...</option>
              {TAG_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-1">Alert Message</label>
            <input
              value={editForm.alert_message}
              onChange={(e) => setEditForm((prev) => ({ ...prev, alert_message: e.target.value }))}
              placeholder="Custom alert message..."
              className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={editForm.alert_enabled}
              onChange={(e) => setEditForm((prev) => ({ ...prev, alert_enabled: e.target.checked }))}
              className="accent-blue-500"
            />
            Enable arrival alerts
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCancelEdit} className="flex-1 py-2 text-xs text-slate-400 bg-slate-800/40 rounded-lg hover:bg-slate-800">Cancel</button>
          <button
            onClick={onSaveEdit}
            disabled={isSaving}
            className="flex-1 py-2 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl border border-slate-800/60 p-5 hover:border-slate-700 transition-all">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {person.photo_url ? (
            <img
              src={person.photo_url}
              alt={person.name}
              className="w-12 h-12 rounded-full object-cover border border-slate-700"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg font-bold text-white">
              {person.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{person.name}</h3>
            {person.tag && (
              <span
                className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded border mt-1 inline-block',
                  tagColors[person.tag] || 'text-slate-400 bg-slate-500/10 border-slate-500/20'
                )}
              >
                {person.tag}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1" title={person.alert_enabled ? 'Alerts enabled' : 'Alerts disabled'}>
          {person.alert_enabled ? (
            <Bell className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <BellOff className="w-3.5 h-3.5 text-slate-600" />
          )}
        </div>
      </div>

      {person.alert_message && person.alert_enabled && (
        <div className="mt-3 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
          <p className="text-[10px] text-amber-400/80 flex items-center gap-1">
            <Bell className="w-3 h-3" />
            {person.alert_message}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <label className={cn(
          'py-2 text-xs font-medium rounded-lg transition-colors text-center cursor-pointer flex items-center justify-center gap-2',
          (person as any).faceEmbeddings?.length > 0
            ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20'
            : 'text-slate-400 bg-slate-800/40 hover:bg-slate-800'
        )}>
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <UploadCloud className="w-3.5 h-3.5" />
          )}
          {isUploading
            ? 'Enrolling…'
            : (person as any).faceEmbeddings?.length > 0
              ? `${(person as any).faceEmbeddings.length} face(s) enrolled — add more`
              : 'Upload Face Photo'}
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
        </label>
        {uploadStatus && (
          <p className={cn('text-[10px] text-center py-1 px-2 rounded-lg', uploadStatus.ok ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10')}>
            {uploadStatus.msg}
          </p>
        )}
        {!(person as any).faceEmbeddings?.length && !uploadStatus && (
          <p className="text-[10px] text-amber-500/70 text-center">⚠ No face enrolled — AI cannot recognise this person</p>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={onStartEdit}
            className="flex-1 p-2 text-slate-500 hover:text-blue-400 bg-slate-800/40 hover:bg-slate-800 rounded-lg transition-colors text-xs flex items-center justify-center gap-1"
            title="Edit person"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="flex-1 p-2 text-slate-500 hover:text-red-400 bg-slate-800/40 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40 text-xs flex items-center justify-center gap-1"
          >
            <Tag className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}
