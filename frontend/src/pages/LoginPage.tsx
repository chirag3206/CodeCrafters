import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Eye, EyeOff, ShieldCheck, Lock, Info } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative selection:bg-indigo-100 selection:text-indigo-900">
      {/* Subtle Corporate Background Decoration */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] bg-indigo-100/50 rounded-full blur-3xl" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[500px] h-[500px] bg-sky-100/50 rounded-full blur-3xl" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-200 mb-4 ring-4 ring-indigo-50">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          PeoplePay360
        </h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Enterprise Payroll &amp; Workforce Governance System
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Sign in to your account</h2>
            <p className="text-xs text-slate-500 mt-0.5">Enter your corporate credentials to access your portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="field-label">Work Email</label>
              <input
                id="login-email"
                type="email"
                className="input-field"
                placeholder="your.name@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="field-label mb-0">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgot(v => !v)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Forgot Password Hint */}
            {showForgot && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-start gap-2 animate-fade-in">
                <Info size={14} className="shrink-0 mt-0.5 text-blue-500" />
                <span>
                  Password resets are managed by your system administrator.
                  Please contact your <strong>Admin</strong> to reset your password.
                </span>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2 animate-fade-in">
                <Lock size={16} className="shrink-0 mt-0.5 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-2.5 text-sm font-semibold shadow-sm hover:shadow"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <LogIn size={16} />
                )}
                {loading ? 'Authenticating…' : 'Sign In'}
              </button>
            </div>
          </form>

          {/* Role hints */}
          <div className="mt-5 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">System Roles</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Admin', color: '#7c3aed' },
                { label: 'HR Manager', color: '#0369a1' },
                { label: 'Payroll Manager', color: '#047857' },
                { label: 'Payroll User', color: '#b45309' },
                { label: 'Employee', color: '#be123c' },
              ].map(r => (
                <span
                  key={r.label}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                  style={{ color: r.color, borderColor: r.color + '50', backgroundColor: r.color + '12' }}
                >
                  {r.label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Secure 256-bit SSL Session</span>
            <span>v2.4 Enterprise</span>
          </div>
        </div>
      </div>
    </div>
  );
}
