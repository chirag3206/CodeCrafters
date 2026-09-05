import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Lock, Eye, EyeOff, ShieldCheck, CheckCircle2,
  AlertCircle, ArrowLeft, KeyRound
} from 'lucide-react';

function PasswordStrengthBar({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i <= score ? colors[score] : '#e2e8f0',
            }}
          />
        ))}
      </div>
      <p className="text-xs font-medium" style={{ color: colors[score] }}>
        {labels[score]}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-slate-500">
        {[
          ['8+ characters', checks[0]],
          ['Uppercase letter', checks[1]],
          ['Lowercase letter', checks[2]],
          ['Number', checks[3]],
          ['Special character', checks[4]],
        ].map(([label, passed]) => (
          <div key={label as string} className="flex items-center gap-1">
            <CheckCircle2
              size={10}
              className={passed ? 'text-green-500' : 'text-slate-300'}
            />
            <span className={passed ? 'text-slate-700' : ''}>{label as string}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  const { changePassword } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const msg = await changePassword(currentPassword, newPassword, confirmPassword);
      setSuccess(msg || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-8">
      {/* Back button */}
      <button
        id="change-pass-back-btn"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors group"
      >
        <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
        Back
      </button>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <KeyRound size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold">Change Password</h1>
              <p className="text-indigo-200 text-sm">Update your account security credentials</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Success state */}
          {success && (
            <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 animate-fade-in">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Password Updated!</p>
                <p className="text-sm text-emerald-700 mt-0.5">{success}</p>
                <button
                  onClick={() => navigate('/')}
                  className="mt-2 text-xs font-medium text-emerald-700 hover:text-emerald-900 underline underline-offset-2"
                >
                  Return to Dashboard →
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Current Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="change-pass-current"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  required
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-slate-200 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400
                             bg-slate-50 hover:bg-white transition-colors placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <ShieldCheck size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="change-pass-new"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-slate-200 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400
                             bg-slate-50 hover:bg-white transition-colors placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <PasswordStrengthBar password={newPassword} />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="change-pass-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  required
                  className={`w-full pl-9 pr-10 py-2.5 rounded-lg border text-sm
                             focus:outline-none focus:ring-2 focus:border-indigo-400
                             bg-slate-50 hover:bg-white transition-colors placeholder:text-slate-400 ${
                               confirmPassword && newPassword !== confirmPassword
                                 ? 'border-rose-300 focus:ring-rose-500/30'
                                 : 'border-slate-200 focus:ring-indigo-500/30'
                             }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="mt-1.5 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle size={11} />
                  Passwords do not match
                </p>
              )}
              {confirmPassword && newPassword === confirmPassword && newPassword.length >= 8 && (
                <p className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 size={11} />
                  Passwords match
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Tip */}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex gap-2">
              <ShieldCheck size={14} className="shrink-0 mt-0.5 text-amber-600" />
              <span>
                Use a combination of uppercase, lowercase, numbers, and symbols for a strong password.
                Never share your password with anyone.
              </span>
            </div>

            {/* Submit */}
            <button
              id="change-pass-submit"
              type="submit"
              disabled={loading || !currentPassword || !newPassword || !confirmPassword}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
                         bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800
                         text-white text-sm font-semibold shadow-sm
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-150"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <KeyRound size={15} />
              )}
              {loading ? 'Updating Password…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
