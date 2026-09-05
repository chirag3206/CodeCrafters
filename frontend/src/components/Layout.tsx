import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PersonaSwitcher from './PersonaSwitcher';
import {
  Users, FileText, Clock, Calendar, DollarSign,
  Receipt, LayoutDashboard, LogOut, ChevronDown, Shield,
  X
} from 'lucide-react';

import { useState, useRef, useEffect } from 'react';
import { schedulesApi } from '../services/api';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/employees', label: 'Employees',  icon: <Users size={16} />,         roles: ['HR_Manager', 'HR_Payroll_User', 'HR_Payroll_Manager', 'Admin'] },
  { to: '/contracts', label: 'Contracts',  icon: <FileText size={16} />,      roles: ['HR_Manager', 'HR_Payroll_User', 'HR_Payroll_Manager', 'Admin'] },
  { to: '/attendance',label: 'Attendance', icon: <Clock size={16} />,         roles: ['Employee', 'HR_Manager', 'HR_Payroll_User', 'HR_Payroll_Manager', 'Admin'] },
  { to: '/time-off',  label: 'Time Off',   icon: <Calendar size={16} />,      roles: ['Employee', 'HR_Manager', 'HR_Payroll_User', 'HR_Payroll_Manager', 'Admin'] },
  { to: '/payroll',   label: 'Payroll',    icon: <DollarSign size={16} />,    roles: ['HR_Payroll_User', 'HR_Payroll_Manager', 'Admin'] },
  { to: '/salary-structures', label: 'Salary Rules', icon: <FileText size={16} />, roles: ['HR_Payroll_User', 'HR_Payroll_Manager', 'Admin'] },
  { to: '/payslips',  label: 'Payslips',   icon: <Receipt size={16} />,       roles: ['Employee', 'HR_Manager', 'HR_Payroll_User', 'HR_Payroll_Manager', 'Admin'] },
  { to: '/dashboard', label: 'Dashboard',  icon: <LayoutDashboard size={16} />,roles: ['HR_Payroll_User', 'HR_Payroll_Manager', 'Admin'] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<number[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch active company office hours broadcast alerts
  const loadNotifications = async () => {
    try {
      const res = await schedulesApi.activeNotifications();
      setActiveAlerts(res.data || []);
    } catch {
      // Ignore if unauthenticated
    }
  };

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const visibleItems = NAV_ITEMS.filter(item =>
    !item.roles || item.roles.includes(user?.role || '')
  );

  const unreadAlerts = activeAlerts.filter(a => !dismissedAlertIds.includes(a.id));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Persona Switcher Bar */}
      <PersonaSwitcher />

      {/* ─── 3-DAY BROADCAST ALERT BANNER (OFFICE HOURS POLICY UPDATE) ─── */}
      {unreadAlerts.map(alert => (
        <div
          key={alert.id}
          className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white px-4 py-2.5 shadow-sm border-b border-amber-600/30 flex items-center justify-between text-xs animate-fade-in z-30"
        >
          <div className="flex items-center gap-2.5 max-w-5xl">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Clock size={14} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded text-[10px]">
                  ⏰ Company Policy Alert
                </span>
                <span className="font-semibold text-white">
                  Office Hours: {alert.new_start_time} - {alert.new_end_time} (Effective {alert.effective_date})
                </span>
              </div>
              <p className="text-white/90 text-[11px] mt-0.5">
                {alert.reason} • <b>Policy:</b> ±{alert.grace_minutes} min early or late punch is exempted from salary deductions.
                <span className="opacity-80 ml-1.5">(Updated by {alert.updated_by_name} • Active for 3 days)</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => setDismissedAlertIds(prev => [...prev, alert.id])}
            className="p-1 rounded hover:bg-white/20 text-white transition-colors shrink-0 ml-3"
            title="Acknowledge Alert"
          >
            <X size={16} />
          </button>
        </div>
      ))}

      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm shadow-xs">
        <div className="flex items-center h-14 px-4 sm:px-6 gap-4 max-w-7xl mx-auto w-full">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2.5 mr-2 shrink-0 group">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:bg-indigo-700 transition-colors">
              P
            </div>
            <span className="font-bold text-slate-900 hidden sm:block text-base tracking-tight">PeoplePay360</span>
          </NavLink>

          {/* Nav Items */}
          <nav className="flex items-center gap-1 flex-1 overflow-x-auto no-scrollbar py-1">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                id={`nav-${item.label.toLowerCase().replace(/\s+/, '-')}`}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap
                   transition-all duration-150 ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* User Menu */}
          {user && (
            <div className="relative shrink-0 ml-auto" ref={menuRef}>
              <button
                id="user-menu-btn"
                onClick={() => setUserMenuOpen(v => !v)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50
                           transition-all duration-150 text-sm text-slate-700 shadow-2xs"
              >
                <div className="w-7 h-7 rounded-md bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700">
                  {user.full_name ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'U'}
                </div>
                <span className="hidden sm:block max-w-[130px] truncate font-medium text-slate-800 text-xs">
                  {user.full_name ? user.full_name.split(' ')[0] : 'Account'}
                </span>
                <ChevronDown size={12} className={`text-slate-400 transition-transform duration-150 ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 animate-slide-up z-50">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <p className="text-xs font-semibold text-slate-900 truncate">{user.full_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <Shield size={10} className="text-indigo-500" />
                      <p className="text-[11px] text-slate-500 font-medium">{user.role.replace(/_/g, ' ')}</p>
                      {user.badge_id && (
                        <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                          {user.badge_id}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    id="logout-btn"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-rose-600
                               hover:bg-rose-50 transition-colors"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
