import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { grievancesApi, attendanceApi, dashboardApi } from '../services/api';
import type { Attendance } from '../types';
import {
  Users, DollarSign, Clock, Calendar,
  CheckCircle2, AlertTriangle,
  Sparkles, X, MessageSquare, ArrowRight,
  LogIn, LogOut, Building2, UserCheck, Activity, ShieldAlert, ShieldCheck, Zap,
  ChevronRight

} from 'lucide-react';

function formatTime(dtStr: string | null | undefined): string {
  if (!dtStr) return '—';
  try {
    const str = dtStr.trim();
    const clean = str.replace(' ', 'T').replace('Z', '').split('+')[0].split('.')[0];
    const parts = clean.split('T');
    if (parts.length >= 2) {
      const [y, m, d] = parts[0].split('-').map(Number);
      const [hr, min, sec = 0] = parts[1].split(':').map(Number);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d) && !isNaN(hr) && !isNaN(min)) {
        const localDate = new Date(y, m - 1, d, hr, min, sec);
        return localDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      }
    }
    const fallback = new Date(dtStr);
    return isNaN(fallback.getTime()) ? '—' : fallback.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isManagement = user?.role !== 'Employee';
  const [selectedScope, setSelectedScope] = useState<'company' | 'personal'>(isManagement ? 'company' : 'personal');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [homeKpiData, setHomeKpiData] = useState<any>(null);
  const [kpiLoading, setKpiLoading] = useState(false);

  // Grievance Dispute State
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState('Attendance / LOP');
  const [disputeRemarks, setDisputeRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline Punch widget
  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null);
  const [punchLoading, setPunchLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Step 2 HR Manager Lock Attendance Modal on HomePage
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [lockNotes, setLockNotes] = useState('Audited all punch exceptions, verified approved time-offs, and approved for payroll.');
  const [isLocking, setIsLocking] = useState(false);

  const handleLockPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLocking(true);
      const res = await attendanceApi.lockPeriod({
        month: selectedMonth,
        approval_notes: lockNotes,
      });
      alert(res.data.message || `Attendance for ${homeKpiData?.month_label || selectedMonth} has been approved and locked for payroll processing.`);
      setIsLockModalOpen(false);
      await loadKpis();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to lock attendance period');
    } finally {
      setIsLocking(false);
    }
  };

  // Automatically adjust scope when switching persona
  useEffect(() => {
    if (user?.role === 'Employee') {
      setSelectedScope('personal');
    } else {
      setSelectedScope('company');
    }
  }, [user?.role]);

  // Live ticking clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadTodayRecord = async () => {
    try {
      const res = await attendanceApi.today();
      setTodayRecord(res.data);
    } catch {
      setTodayRecord(null);
    }
  };

  const loadKpis = async () => {
    try {
      setKpiLoading(true);
      const res = await dashboardApi.homeKpis({
        month: selectedMonth,
        scope: user?.role === 'Employee' ? 'personal' : selectedScope,
      });
      setHomeKpiData(res.data);
    } catch (err) {
      console.error('Failed to load home KPIs', err);
    } finally {
      setKpiLoading(false);
    }
  };

  const handlePunch = async (action: 'check_in' | 'check_out') => {
    try {
      setPunchLoading(true);
      await attendanceApi.punch(action);
      await loadTodayRecord();
      await loadKpis();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Punch failed. Please try again.');
    } finally {
      setPunchLoading(false);
    }
  };

  useEffect(() => {
    loadKpis();
    loadTodayRecord();
  }, [selectedMonth, selectedScope, user?.user_id]);

  const handleConfirmStatement = async () => {
    try {
      const slipId = homeKpiData?.personal?.payslip_id;
      if (slipId) {
        await grievancesApi.confirm(slipId);
      } else {
        await grievancesApi.confirmMonth(selectedMonth);
      }
      alert(`Operational attendance record for ${homeKpiData?.month_label || selectedMonth} confirmed successfully!`);

      // Automatically transition to the live current month (September 2026) attendance
      if (selectedMonth !== '2026-09') {
        setSelectedMonth('2026-09');
      } else {
        await loadKpis();
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Confirmation failed');
    }
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const slipId = homeKpiData?.personal?.payslip_id;
      if (slipId) {
        await grievancesApi.dispute(slipId, {
          grievance_category: disputeCategory,
          grievance_remarks: disputeRemarks,
        });
      } else {
        await grievancesApi.disputeMonth(selectedMonth, {
          grievance_category: disputeCategory,
          grievance_remarks: disputeRemarks,
        });
      }
      alert(`Grievance raised for ${homeKpiData?.month_label || selectedMonth}. HR & Payroll teams have been notified to review and adjust your attendance.`);
      setIsDisputeOpen(false);
      setDisputeRemarks('');

      // Transition to live current month (September 2026) attendance
      if (selectedMonth !== '2026-09') {
        setSelectedMonth('2026-09');
      } else {
        await loadKpis();
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Dispute submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 p-6 rounded-2xl border border-indigo-100 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={14} className="text-indigo-500" />
              PeoplePay360 Operations Platform
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Hello, {user?.full_name}!
            </h1>
            <p className="text-xs text-slate-600">
              Active Persona: <span className="font-semibold text-indigo-700">{user?.role.replace(/_/g, ' ')}</span> • Connected to Unified HR &amp; Payroll Pipeline.
            </p>
          </div>

          {/* ── Inline Punch Widget ── */}
          <div className="flex flex-col items-end gap-3 shrink-0">
            {/* Live clock display */}
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-mono font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs">
                {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            {/* Single toggling Punch button */}
            {!todayRecord?.check_in ? (
              <button
                disabled={punchLoading}
                onClick={() => handlePunch('check_in')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <LogIn size={16} />
                {punchLoading ? 'Punching In...' : 'Punch In'}
              </button>
            ) : !todayRecord?.check_out ? (
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  ✓ Punched In at {formatTime(todayRecord.check_in)}
                </span>
                <button
                  disabled={punchLoading}
                  onClick={() => handlePunch('check_out')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <LogOut size={16} />
                  {punchLoading ? 'Punching Out...' : 'Punch Out'}
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-right leading-5">
                ✓ In: <span className="font-semibold">{formatTime(todayRecord.check_in)}</span>
                &nbsp;→&nbsp;Out: <span className="font-semibold">{formatTime(todayRecord.check_out)}</span>
                <br /><span className="text-emerald-700 font-bold">{todayRecord.worked_hours.toFixed(1)}h worked</span> today
              </div>
            )}

            {user?.role !== 'Employee' && (
              <button
                onClick={() => navigate('/payroll')}
                className="btn-primary py-2 text-xs font-semibold"
              >
                <DollarSign size={14} /> Payroll Wizard
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── DYNAMIC KPI BAR (SCOPE + MONTH PERIOD SELECTORS) ─── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Activity size={18} className="text-indigo-600 shrink-0" />
          <span className="font-bold text-slate-800 text-sm">
            {selectedScope === 'company'
              ? 'Company Operational Pulse'
              : `Personal Shift Statement — ${user?.full_name}`}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            {homeKpiData?.month_label || 'August 2026'}
          </span>
          {kpiLoading && (
            <span className="text-[11px] text-slate-400 italic">Updating…</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Scope Selector (Only for HR / Managers / Admins) */}
          {user?.role !== 'Employee' && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                id="btn-scope-company"
                onClick={() => setSelectedScope('company')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedScope === 'company'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 size={13} />
                Overall Company
              </button>
              <button
                id="btn-scope-personal"
                onClick={() => setSelectedScope('personal')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedScope === 'personal'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck size={13} />
                My Records
              </button>
            </div>
          )}

          {/* Month / Pay Period Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <Calendar size={14} className="text-slate-500 shrink-0" />
            <select
              id="select-kpi-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              {(homeKpiData?.available_months || [
                { key: '2026-09', label: 'September 2026 (Live Current)' },
                { key: '2026-08', label: 'August 2026 (Unrun Payrun Cycle)' },
                { key: '2026-07', label: 'July 2026 (Historical Paid)' },
                { key: '2026-06', label: 'June 2026 (Historical Paid)' },
                { key: '2026-05', label: 'May 2026 (Historical Paid)' },
                { key: '2026-04', label: 'April 2026 (Historical Paid)' },
                { key: '2026-03', label: 'March 2026 (Historical Paid)' },
              ]).map((m: any) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── SCOPE 1: COMPANY-WIDE OPERATIONAL KPIS (FOR HR / MANAGERS / ADMINS) ─── */}
      {selectedScope === 'company' && homeKpiData?.company && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium block">Total Headcount</span>
              <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                {homeKpiData.company.headcount} Staff
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Active across departments</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium block">Workforce Coverage</span>
              <span className="text-xl font-bold font-mono text-emerald-700 mt-1 block">
                {homeKpiData.company.coverage_pct}%
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                {homeKpiData.company.clocked_shifts} / {homeKpiData.company.scheduled_shifts} Shifts
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium block">Company Paid Leaves</span>
              <span className="text-xl font-bold font-mono text-sky-700 mt-1 block">
                {homeKpiData.company.paid_leaves_taken} Days
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Approved PTO utilized</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs border-l-4 border-l-rose-500">
              <span className="text-xs text-slate-500 font-medium block">Unpaid Absences (LOP)</span>
              <span className="text-xl font-bold font-mono text-rose-700 mt-1 block">
                {homeKpiData.company.unpaid_absences_lop} Days
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">LOP leaves &amp; deficits</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium block">Overtime Hours</span>
              <span className="text-xl font-bold font-mono text-indigo-700 mt-1 block">
                {homeKpiData.company.overtime_hours} hrs
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Approved overtime pool</span>
            </div>
          </div>

          {/* HR / Manager Action Items Strip */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-900 font-semibold">
              <ShieldAlert size={16} className="text-amber-600 shrink-0" />
              <span>HR Operations Queue for {homeKpiData.month_label}:</span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => navigate('/time-off')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 font-medium transition-all"
              >
                <span><b>{homeKpiData.company.pending_leave_approvals}</b> Pending Leave Requests</span>
                <ChevronRight size={13} />
              </button>

              <button
                onClick={() => navigate('/attendance')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 font-medium transition-all"
              >
                <span><b>{homeKpiData.company.pending_attendance_audits}</b> Exceptions to Audit</span>
                <ChevronRight size={13} />
              </button>

              {/* Step 2 HR Manager Lock Action */}
              {(user?.role === 'HR_Manager' || user?.role === 'Admin') && (
                <button
                  id="btn-home-lock-attendance"
                  onClick={() => setIsLockModalOpen(true)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition-all shadow-xs ${
                    homeKpiData.company.is_attendance_locked
                      ? 'bg-emerald-100 border border-emerald-300 text-emerald-800'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  <ShieldCheck size={14} />
                  <span>
                    {homeKpiData.company.is_attendance_locked
                      ? `✓ Attendance Locked (${homeKpiData.month_label})`
                      : `Approve & Lock Attendance (${homeKpiData.month_label})`}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Step 5: Payroll User Period Ready Notification Banner */}
          {(user?.role === 'HR_Payroll_User' || user?.role === 'HR_Payroll_Manager' || user?.role === 'Admin') && (
            <div
              className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs ${
                homeKpiData.company.is_attendance_locked
                  ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-emerald-300 text-emerald-950'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {homeKpiData.company.is_attendance_locked ? (
                  <Zap size={18} className="text-emerald-600 shrink-0 mt-0.5 animate-pulse" />
                ) : (
                  <Clock size={18} className="text-slate-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold text-sm">
                    {homeKpiData.company.is_attendance_locked
                      ? `Step 5: ${homeKpiData.month_label} Ready for Payroll Processing`
                      : `Awaiting HR Attendance Approval for ${homeKpiData.month_label}`}
                  </p>
                  <p className="mt-0.5">
                    {homeKpiData.company.is_attendance_locked
                      ? 'HR Manager has verified and locked the attendance data. Operational payroll users may now launch the Payroll Wizard.'
                      : 'HR Manager has not yet locked attendance for this period. Exceptional punches are still being audited.'}
                  </p>
                </div>
              </div>

              {homeKpiData.company.is_attendance_locked && (
                <button
                  id="btn-launch-payroll-wizard-home"
                  onClick={() => navigate('/payroll')}
                  className="btn-primary text-xs font-semibold py-2 px-4 shrink-0 flex items-center gap-1.5"
                >
                  <DollarSign size={14} />
                  Launch Payroll Wizard →
                </button>
              )}
            </div>
          )}
        </div>
      )}


      {/* ─── SCOPE 2: PERSONAL OPERATIONAL STATEMENT (FOR EMPLOYEE OR MANAGER PERSONAL VIEW) ─── */}
      {(selectedScope === 'personal' || user?.role === 'Employee') && homeKpiData?.personal && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 border-l-4 border-l-indigo-600 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">
                Pre-Payroll Operational Verification Review
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Attendance &amp; Shift Statement for {homeKpiData.month_label} ({homeKpiData.period_start} to {homeKpiData.period_end})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ZERO SALARY DISCLOSURE: Please verify your scheduled business days, clocked hours, and approved leaves prior to payroll finalization.
              </p>
            </div>

            <div className="shrink-0">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  homeKpiData.personal.verification_status === 'Confirmed'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : homeKpiData.personal.verification_status === 'Disputed'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : homeKpiData.personal.verification_status === 'Resolved'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {homeKpiData.personal.verification_status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs text-slate-500 font-medium block">Scheduled Days</span>
              <span className="text-lg font-bold font-mono text-slate-900">
                {homeKpiData.personal.scheduled_days} Days
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs text-slate-500 font-medium block">Actual Clocked</span>
              <span className="text-lg font-bold font-mono text-emerald-700">
                {homeKpiData.personal.actual_clocked_days} Days
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs text-slate-500 font-medium block">Paid Leaves</span>
              <span className="text-lg font-bold font-mono text-sky-700">
                {homeKpiData.personal.paid_leave_days} Day(s)
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 border-l-2 border-l-rose-500">
              <span className="text-xs text-slate-500 font-medium block">Unpaid Absences (LOP)</span>
              <span className="text-lg font-bold font-mono text-rose-700">
                {homeKpiData.personal.unpaid_leave_days} Day(s)
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs text-slate-500 font-medium block">Overtime Hours</span>
              <span className="text-lg font-bold font-mono text-indigo-700">
                {homeKpiData.personal.overtime_hours} hrs
              </span>
            </div>
          </div>

          {/* Status Banners & Actions */}
          {homeKpiData.personal.verification_status === 'Pending Review' && (
            <div>
              {homeKpiData.personal.grievance_resolution_notes && (
                <div className="mb-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">HR Resolution Note: </span>
                    <span>{homeKpiData.personal.grievance_resolution_notes}</span>
                    <span className="block mt-0.5 text-blue-700 font-medium">Please review the updated attendance metrics above and re-confirm your record.</span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  id="btn-raise-grievance"
                  onClick={() => setIsDisputeOpen(true)}
                  className="btn-danger text-xs font-semibold py-2"
                >
                  <AlertTriangle size={14} />
                  Raise Grievance / Dispute Absence
                </button>

                <button
                  id="btn-confirm-statement"
                  onClick={handleConfirmStatement}
                  className="btn-success text-xs font-semibold py-2"
                >
                  <CheckCircle2 size={14} />
                  Confirm Record (Zero Discrepancies)
                </button>
              </div>
            </div>
          )}

          {homeKpiData.personal.verification_status === 'Disputed' && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={17} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Grievance Raised for {homeKpiData.month_label}</span>
                  {homeKpiData.personal.grievance_category && (
                    <span className="ml-1 text-rose-700 font-medium">[{homeKpiData.personal.grievance_category}]</span>
                  )}
                  <p className="text-rose-700 mt-0.5 italic">
                    "{homeKpiData.personal.grievance_remarks || 'Attendance dispute logged'}"
                  </p>
                  <span className="text-[11px] text-rose-600 mt-0.5 block">
                    HR & Payroll managers have been notified. Once HR adjusts your attendance, this record will prompt you for confirmation.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedMonth('2026-09')}
                className="btn-secondary text-xs shrink-0 self-start sm:self-center font-medium"
              >
                View Live Month (Sep 2026) →
              </button>
            </div>
          )}

          {homeKpiData.personal.verification_status === 'Confirmed' && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>
                  Statement for <b>{homeKpiData.month_label}</b> is <b>Confirmed</b> with zero discrepancies.
                </span>
              </div>
              {selectedMonth !== '2026-09' && (
                <button
                  onClick={() => setSelectedMonth('2026-09')}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline shrink-0"
                >
                  Switch to Live Current Month (Sep 2026) →
                </button>
              )}
            </div>
          )}
        </div>
      )}


      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => navigate('/employees')}
          className="bg-white p-5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all group shadow-xs"
        >
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3">
            <Users size={20} className="text-indigo-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Employee Hub</h3>
            <ArrowRight size={14} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
          </div>
          <p className="text-xs text-slate-500 mt-1">Directory with 5 smart-badge buttons & tabbed employee profiles.</p>
        </div>

        <div
          onClick={() => navigate('/attendance')}
          className="bg-white p-5 rounded-xl border border-slate-200 hover:border-sky-300 hover:shadow-md cursor-pointer transition-all group shadow-xs"
        >
          <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center mb-3">
            <Clock size={20} className="text-sky-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Attendance Punch</h3>
            <ArrowRight size={14} className="text-slate-400 group-hover:text-sky-600 transition-colors" />
          </div>
          <p className="text-xs text-slate-500 mt-1">Daily clock logs, 7 operations metrics, and audited notes.</p>
        </div>

        <div
          onClick={() => navigate('/time-off')}
          className="bg-white p-5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md cursor-pointer transition-all group shadow-xs"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-3">
            <Calendar size={20} className="text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Time Off Ledger</h3>
            <ArrowRight size={14} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
          </div>
          <p className="text-xs text-slate-500 mt-1">Allocation quotas, requests, and 1-click approvals.</p>
        </div>

        <div
          onClick={() => navigate('/dashboard')}
          className="bg-white p-5 rounded-xl border border-slate-200 hover:border-purple-300 hover:shadow-md cursor-pointer transition-all group shadow-xs"
        >
          <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center mb-3">
            <DollarSign size={20} className="text-purple-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Executive Dashboard</h3>
            <ArrowRight size={14} className="text-slate-400 group-hover:text-purple-600 transition-colors" />
          </div>
          <p className="text-xs text-slate-500 mt-1">5 Core KPIs, Recharts graphs, and Email Outbox status.</p>
        </div>
      </div>

      {/* Raise Grievance Modal */}
      {isDisputeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl shadow-xl border border-slate-200 animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare size={16} className="text-rose-600" />
                Submit Pre-Payroll Grievance
              </h2>
              <button onClick={() => setIsDisputeOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleDisputeSubmit} className="space-y-4">
              <div>
                <label className="field-label">Dispute Category *</label>
                <select
                  value={disputeCategory}
                  onChange={(e) => setDisputeCategory(e.target.value)}
                  className="input-field"
                >
                  <option value="Attendance / LOP">Unrecorded Attendance / False LOP</option>
                  <option value="Paid Leave Balance">Approved Leave Not Recorded</option>
                  <option value="Overtime Calculation">Overtime Hours Discrepancy</option>
                  <option value="Other">Other Discrepancy</option>
                </select>
              </div>

              <div>
                <label className="field-label">Detailed Remarks / Context *</label>
                <textarea
                  required
                  rows={3}
                  value={disputeRemarks}
                  placeholder="e.g. Worked at client site on Sep 18. Badge scanner did not record entry. Please adjust LOP deduction."
                  onChange={(e) => setDisputeRemarks(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDisputeOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-danger text-xs font-semibold"
                >
                  {isSubmitting ? 'Logging...' : 'Submit Grievance to HR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Step 2: HR Manager Attendance Approval & Lock Modal on HomePage */}
      {isLockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl shadow-xl border border-slate-200 animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Approve &amp; Lock Attendance ({homeKpiData?.month_label || selectedMonth})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsLockModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleLockPeriod} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-indigo-700">
                  <CheckCircle2 size={14} /> Step 2: HR Manager Governance Protocol
                </span>
                <p>
                  Approving and locking attendance for <b>{homeKpiData?.month_label || selectedMonth}</b> confirms that all employee punches, exceptions, and approved leaves have been audited.
                </p>
                <p className="text-[11px] text-indigo-800">
                  Once locked, attendance statements are finalized and the <b>Payroll Processing Team</b> is authorized to compile the monthly payrun.
                </p>
              </div>

              {homeKpiData?.company?.is_attendance_locked && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  <p className="font-bold">Currently Locked for Payroll</p>
                  <p className="text-[11px] mt-0.5">
                    Approved by: <b>{homeKpiData.locked_by_name || 'HR Manager'}</b>
                    {homeKpiData.locked_at && ` on ${homeKpiData.locked_at.slice(0, 10)}`}.
                  </p>
                </div>
              )}

              <div>
                <label className="field-label">Audit Approval Notes *</label>
                <textarea
                  required
                  rows={3}
                  value={lockNotes}
                  onChange={(e) => setLockNotes(e.target.value)}
                  placeholder="e.g. Audited all exceptions and LOP calculations. Verified with department managers. Approved for payroll."
                  className="input-field text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLockModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLocking}
                  className="btn-primary text-xs font-semibold"
                >
                  {isLocking
                    ? 'Locking Attendance...'
                    : homeKpiData?.company?.is_attendance_locked
                    ? 'Re-Confirm & Update Lock'
                    : 'Approve & Lock Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
