import { useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Users, Plus, Shield, ShieldCheck, UserCheck, UserX,
  KeyRound, Search, RefreshCw, Edit2, CheckCircle2,
  AlertCircle, X, Eye, EyeOff, Mail, User, Lock,
  Crown, ChevronDown
} from 'lucide-react';

const ROLE_OPTIONS = [
  { value: 'Admin', label: 'Admin', color: '#7c3aed', bg: '#f5f3ff' },
  { value: 'HR_Manager', label: 'HR Manager', color: '#0369a1', bg: '#e0f2fe' },
  { value: 'HR_Payroll_Manager', label: 'HR Payroll Manager', color: '#047857', bg: '#d1fae5' },
  { value: 'HR_Payroll_User', label: 'HR Payroll User', color: '#b45309', bg: '#fef3c7' },
  { value: 'Employee', label: 'Employee', color: '#be123c', bg: '#ffe4e6' },
];

function RoleBadge({ role }: { role: string }) {
  const opt = ROLE_OPTIONS.find(r => r.value === role) || ROLE_OPTIONS[4];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border"
      style={{ color: opt.color, backgroundColor: opt.bg, borderColor: opt.color + '40' }}
    >
      <Shield size={9} />
      {opt.label}
    </span>
  );
}

interface UserRecord {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
  full_name: string;
  badge_id: string | null;
  employee_id: number | null;
  created_at: string;
}

interface CreateUserFormData {
  email: string;
  full_name: string;
  password: string;
  role: string;
  employee_id?: number;
}

// ── Create User Modal ──────────────────────────────────────────────────────────
function CreateUserModal({
  onClose,
  onCreated,
  callerRole,
}: {
  onClose: () => void;
  onCreated: () => void;
  callerRole: string;
}) {
  const allowedRoles =
    callerRole === 'Admin'
      ? ROLE_OPTIONS
      : ROLE_OPTIONS.filter(r => r.value === 'Employee');

  const [form, setForm] = useState<CreateUserFormData>({
    email: '',
    full_name: '',
    password: '',
    role: allowedRoles[0]?.value || 'Employee',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdUser, setCreatedUser] = useState<UserRecord | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.createUser(form);
      setCreatedUser(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create user. Please check the details and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (createdUser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">User Created!</h3>
          <p className="text-sm text-slate-500 mb-4">
            The account for <strong>{createdUser.full_name}</strong> has been created successfully.
          </p>
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-left space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <Mail size={14} className="text-slate-400" />
              <span className="text-slate-600">Email:</span>
              <span className="font-mono font-medium text-slate-900">{createdUser.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Shield size={14} className="text-slate-400" />
              <span className="text-slate-600">Role:</span>
              <RoleBadge role={createdUser.role} />
            </div>
          </div>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
            ⚠️ Share the password with the user securely. They should change it on first login.
          </p>
          <button
            onClick={() => { onCreated(); onClose(); }}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <UserCheck size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base">Create New User</h3>
              <p className="text-indigo-200 text-xs">Add a user account to the system</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="create-user-name"
                type="text"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="e.g. Arjun Mehta"
                required
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Work Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="create-user-email"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="e.g. arjun.mehta@company.com"
                required
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Role</label>
            <div className="relative">
              <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                id="create-user-role"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 appearance-none bg-white"
              >
                {allowedRoles.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="create-user-password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Minimum 8 characters"
                required
                minLength={8}
                className="w-full pl-9 pr-20 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 font-mono placeholder:font-sans placeholder:text-slate-400"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
                    const pwd = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                    setForm(f => ({ ...f, password: pwd }));
                    setShowPassword(true);
                  }}
                  className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-1.5 py-0.5 rounded transition-colors"
                  title="Generate random password"
                >
                  GEN
                </button>
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="text-slate-400 hover:text-slate-600 p-0.5"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Share this password with the user securely — they can change it anytime.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              id="create-user-submit"
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Reset Password Modal ──────────────────────────────────────────────────────
function ResetPasswordModal({
  user,
  onClose,
}: {
  user: UserRecord;
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.resetPassword(user.id, newPassword);
      setSuccess(res.data.message || 'Password reset successfully.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <KeyRound size={18} />
            <div>
              <p className="font-bold text-sm">Reset Password</p>
              <p className="text-amber-100 text-xs">{user.full_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="p-5">
          {success ? (
            <div className="text-center py-4">
              <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-3" />
              <p className="font-semibold text-slate-800 text-sm mb-1">Password Reset!</p>
              <p className="text-xs text-slate-500 mb-4">{success}</p>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    id="reset-pass-input"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
                    className="w-full pl-3 pr-20 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 font-mono placeholder:font-sans placeholder:text-slate-400"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
                        setNewPassword(Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''));
                        setShowPassword(true);
                      }}
                      className="text-[10px] font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded transition-colors"
                    >
                      GEN
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="text-slate-400 hover:text-slate-600 p-0.5"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
              {error && (
                <p className="text-xs text-rose-600 flex items-center gap-1"><AlertCircle size={11} />{error}</p>
              )}
              <div className="flex gap-2.5">
                <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" disabled={loading || newPassword.length < 8} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {loading ? 'Resetting…' : 'Reset'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UserManagementPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRecord | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authApi.listUsers();
      setUsers(res.data);
    } catch {
      showToast('Failed to load users.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleActive = async (u: UserRecord) => {
    setUpdatingId(u.id);
    try {
      await authApi.updateUser(u.id, { is_active: !u.is_active });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: !x.is_active } : x));
      showToast(`${u.full_name} ${u.is_active ? 'deactivated' : 'activated'} successfully.`);
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Update failed.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const updateRole = async (u: UserRecord, newRole: string) => {
    setUpdatingId(u.id);
    try {
      await authApi.updateUser(u.id, { role: newRole });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x));
      showToast(`Role updated to ${newRole.replace(/_/g, ' ')}.`);
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Role update failed.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = !search ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.badge_id || '').toLowerCase().includes(search.toLowerCase());
    const matchesRole = !filterRole || u.role === filterRole;
    const matchesStatus = !filterStatus ||
      (filterStatus === 'active' && u.is_active) ||
      (filterStatus === 'inactive' && !u.is_active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const stats = {
    total: users.length,
    active: users.filter(u => u.is_active).length,
    inactive: users.filter(u => !u.is_active).length,
    admins: users.filter(u => u.role === 'Admin').length,
  };

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-up ${
          toastType === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          {toastType === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Crown size={18} className="text-indigo-600" />
            <h1 className="text-xl font-bold text-slate-900">User Management</h1>
          </div>
          <p className="text-sm text-slate-500">Manage user accounts, roles, and access across all {stats.total} accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="refresh-users-btn"
            onClick={fetchUsers}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            id="create-user-btn"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-all"
          >
            <Plus size={16} />
            Add User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: stats.total, color: '#6366f1', icon: <Users size={16} /> },
          { label: 'Active', value: stats.active, color: '#22c55e', icon: <UserCheck size={16} /> },
          { label: 'Inactive', value: stats.inactive, color: '#f97316', icon: <UserX size={16} /> },
          { label: 'Admins', value: stats.admins, color: '#7c3aed', icon: <ShieldCheck size={16} /> },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: s.color }}>
              {s.icon}
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="user-search"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or badge ID…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 placeholder:text-slate-400"
          />
        </div>
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="py-2 pl-3 pr-8 rounded-lg border border-slate-200 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 appearance-none bg-white"
        >
          <option value="">All Roles</option>
          {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="py-2 pl-3 pr-8 rounded-lg border border-slate-200 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 appearance-none bg-white"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw size={20} className="animate-spin mr-2" />
            Loading users…
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Users size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No users found</p>
            {search && <p className="text-xs mt-1">Try adjusting your search or filters.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Badge / Employee</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map(u => (
                  <tr key={u.id} className={`hover:bg-slate-50/60 transition-colors ${!u.is_active ? 'opacity-60' : ''}`}>
                    {/* User Info */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: ROLE_OPTIONS.find(r => r.value === u.role)?.color || '#6366f1' }}
                        >
                          {u.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm leading-none">{u.full_name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{u.email}</p>
                        </div>
                        {u.id === me?.user_id && (
                          <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full border border-indigo-200">You</span>
                        )}
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3.5">
                      <div className="relative inline-block">
                        <select
                          value={u.role}
                          onChange={e => updateRole(u, e.target.value)}
                          disabled={updatingId === u.id || u.id === me?.user_id}
                          className="appearance-none pl-2 pr-7 py-1 rounded-lg border border-slate-200 text-xs font-medium
                                     focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer bg-white
                                     disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {ROLE_OPTIONS.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                        <Edit2 size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        u.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Badge */}
                    <td className="px-4 py-3.5">
                      {u.badge_id ? (
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {u.badge_id}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No employee linked</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {/* Toggle Active */}
                        <button
                          id={`toggle-user-${u.id}`}
                          onClick={() => toggleActive(u)}
                          disabled={updatingId === u.id || u.id === me?.user_id}
                          title={u.is_active ? 'Deactivate account' : 'Activate account'}
                          className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                            u.is_active
                              ? 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                              : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'
                          }`}
                        >
                          {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>

                        {/* Reset Password */}
                        <button
                          id={`reset-pass-${u.id}`}
                          onClick={() => setResetTarget(u)}
                          disabled={updatingId === u.id}
                          title="Reset password"
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors disabled:opacity-40"
                        >
                          <KeyRound size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchUsers}
          callerRole={me?.role || 'Employee'}
        />
      )}
      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}
