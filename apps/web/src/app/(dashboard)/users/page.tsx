'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Users,
  UserPlus,
  Shield,
  Eye,
  Settings2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  X,
  Check,
  AlertCircle,
  Mail,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

type UserRole = 'ADMIN' | 'SECURITY_OPERATOR' | 'VIEWER';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  avatar_url?: string;
  oauth_provider?: string;
  createdAt: string;
}

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: 'bg-red-500/15 text-red-400 border-red-500/30',
  SECURITY_OPERATOR: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  VIEWER: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const ROLE_ICONS: Record<UserRole, typeof Shield> = {
  ADMIN: Shield,
  SECURITY_OPERATOR: Settings2,
  VIEWER: Eye,
};

// ─── Invite Modal ────────────────────────────────────────────────────────────

function InviteModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('VIEWER');
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: { name: string; email: string; role: UserRole }) =>
      api.post('/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to invite user');
    },
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#0d1b2e] border border-slate-700/60 rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white">Invite User</h2>
            <p className="text-xs text-slate-500 mt-0.5">After creation, the user must use Forgot Password. Email delivery requires configured SMTP.</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/70 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@company.com"
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/70 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {(['VIEWER', 'SECURITY_OPERATOR', 'ADMIN'] as UserRole[]).map((r) => {
                const Icon = ROLE_ICONS[r];
                return (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all ${
                      role === r
                        ? ROLE_COLORS[r]
                        : 'border-slate-700/60 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {r === 'SECURITY_OPERATOR' ? 'Operator' : r.charAt(0) + r.slice(1).toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate({ name, email, role })}
            disabled={!name || !email || mutation.isPending}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {mutation.isPending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><UserPlus className="w-4 h-4" /> Invite</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UserManagementPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const currentUser = useAuthStore((s) => s.user);

  const { data: users = [], isLoading, isError, refetch } = useQuery<UserRow[]>({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserRow> }) =>
      api.patch(`/users/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const toggleActive = (user: UserRow) =>
    updateMutation.mutate({ id: user.id, data: { isActive: !user.isActive } });

  const changeRole = (user: UserRow, role: UserRole) =>
    updateMutation.mutate({ id: user.id, data: { role } });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  const roleCounts = {
    ADMIN: users.filter((u) => u.role === 'ADMIN').length,
    SECURITY_OPERATOR: users.filter((u) => u.role === 'SECURITY_OPERATOR').length,
    VIEWER: users.filter((u) => u.role === 'VIEWER').length,
    active: users.filter((u) => u.isActive).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage access, roles, and team members</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Invite User
        </button>
      </div>

      {(updateMutation.isError || deleteMutation.isError) && (
        <p role="alert" className="text-sm text-red-400">The user could not be updated. Check your permissions and connection, then try again.</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: users.length, color: 'text-white' },
          { label: 'Active', value: roleCounts.active, color: 'text-emerald-400' },
          { label: 'Admins', value: roleCounts.ADMIN, color: 'text-red-400' },
          { label: 'Operators', value: roleCounts.SECURITY_OPERATOR, color: 'text-amber-400' },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users…"
          className="w-full bg-slate-900/60 border border-slate-800/60 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/70 transition-all"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl overflow-hidden">
        {isError ? (
          <div role="alert" className="p-6 text-sm text-red-400">
            Unable to load users. Check your permissions and connection.
            <button onClick={() => void refetch()} className="ml-3 underline">Retry</button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
            <div className="w-5 h-5 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin mr-3" />
            Loading users…
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/60">
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">User</th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Auth</th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filtered.map((user) => {
                const Icon = ROLE_ICONS[user.role];
                const isSelf = user.id === currentUser?.id;
                return (
                  <tr key={user.id} className="hover:bg-slate-800/30 transition-colors group">
                    {/* User */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.name}
                            className="w-8 h-8 rounded-full border border-slate-700"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/20 flex items-center justify-center text-blue-300 text-xs font-bold">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-white">
                            {user.name}
                            {isSelf && (
                              <span className="ml-2 text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full font-semibold">YOU</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role selector */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${ROLE_COLORS[user.role]}`}>
                          <Icon className="w-3 h-3" />
                          {user.role === 'SECURITY_OPERATOR' ? 'Operator' : user.role.charAt(0) + user.role.slice(1).toLowerCase()}
                        </span>
                        {!isSelf && (
                          <select
                            value={user.role}
                            onChange={(e) => changeRole(user, e.target.value as UserRole)}
                            className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none"
                          >
                            <option value="VIEWER">Viewer</option>
                            <option value="SECURITY_OPERATOR">Operator</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <button
                        onClick={() => !isSelf && toggleActive(user)}
                        disabled={isSelf}
                        className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                          user.isActive ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-500 hover:text-slate-400'
                        } ${isSelf ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        title={isSelf ? "You can't deactivate yourself" : user.isActive ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {user.isActive
                          ? <><ToggleRight className="w-4 h-4" /> Active</>
                          : <><ToggleLeft className="w-4 h-4" /> Inactive</>
                        }
                      </button>
                    </td>

                    {/* Auth provider */}
                    <td className="px-6 py-4">
                      {user.oauth_provider === 'google' ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          Google
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Mail className="w-3.5 h-3.5" />
                          Email
                        </div>
                      )}
                    </td>

                    {/* Joined */}
                    <td className="px-6 py-4">
                      <span className="text-xs text-slate-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      {!isSelf && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${user.name}? This cannot be undone.`)) {
                              deleteMutation.mutate(user.id);
                            }
                          }}
                          className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-500 text-sm">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}
