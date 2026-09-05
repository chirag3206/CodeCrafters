import { useAuth } from '../contexts/AuthContext';
import { Zap, Users } from 'lucide-react';
import { useState } from 'react';

const PERSONAS = [
  { key: 'aarav',  label: 'Aarav',  role: 'Employee',       color: '#4F46E5', initial: 'AS' },
  { key: 'priya',  label: 'Priya',  role: 'HR Mgr',         color: '#0284C7', initial: 'PN' },
  { key: 'rajesh', label: 'Rajesh', role: 'Payroll',        color: '#059669', initial: 'RK' },
  { key: 'sunita', label: 'Sunita', role: 'Pay Mgr',        color: '#D97706', initial: 'SR' },
  { key: 'amit',   label: 'Amit',   role: 'Admin',          color: '#DC2626', initial: 'AV' },
];

export default function PersonaSwitcher() {
  const { user, switchPersona } = useAuth();
  const [switching, setSwitching] = useState<string | null>(null);

  const handleSwitch = async (key: string) => {
    if (switching) return;
    setSwitching(key);
    try {
      await switchPersona(key);
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-100/80 border-b border-slate-200 backdrop-blur-sm z-20">
      <div className="flex items-center gap-1.5 mr-2">
        <Zap size={13} className="text-amber-500 fill-amber-500" />
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden sm:block">
          Demo Persona Switcher:
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {PERSONAS.map((p) => {
          const isActive = user?.full_name?.toLowerCase().includes(p.label.toLowerCase());
          return (
            <button
              key={p.key}
              id={`persona-switch-${p.key}`}
              onClick={() => handleSwitch(p.key)}
              disabled={switching !== null}
              title={`Switch to ${p.label} (${p.role})`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
                          transition-all duration-150 border disabled:opacity-60
                          ${isActive
                            ? 'bg-white shadow-sm font-semibold border-slate-300 ring-1 ring-slate-200'
                            : 'bg-transparent border-transparent hover:bg-white/60 text-slate-600 hover:text-slate-900'
                          }`}
            >
              <div
                className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0"
                style={{
                  backgroundColor: p.color + '18',
                  color: p.color,
                  border: `1px solid ${p.color}30`
                }}
              >
                {switching === p.key ? (
                  <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  p.initial[0]
                )}
              </div>
              <span className="text-slate-800 font-medium">{p.label}</span>
              <span className="text-[10px] text-slate-500 font-normal hidden md:inline">({p.role})</span>
            </button>
          );
        })}
      </div>
      {user && (
        <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-white px-2.5 py-0.5 rounded-full border border-slate-200 shadow-2xs">
          <Users size={12} className="text-slate-400" />
          <span className="hidden sm:inline">Active:</span>
          <span className="text-slate-800 font-semibold">{user.role}</span>
        </div>
      )}
    </div>
  );
}
