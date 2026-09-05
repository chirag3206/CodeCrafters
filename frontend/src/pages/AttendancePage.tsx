import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { attendanceApi, schedulesApi } from '../services/api';
import type { Attendance } from '../types';
import {
  Clock, LogIn, LogOut,
  Edit3, X, Settings, ShieldCheck, CheckCircle2, AlertCircle
} from 'lucide-react';

/**
 * Safely format a datetime string from the backend as LOCAL time.
 * Handles strings like "2026-09-05 15:15:39.220985" or "2026-09-05T09:00:00"
 * without letting browser timezone conversions shift the hour.
 */
function formatTime(dtStr: string | null | undefined): string {
  if (!dtStr) return '—';
  try {
    const str = dtStr.trim();
    // Normalize string to "YYYY-MM-DDTHH:MM:SS"
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

export default function AttendancePage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const filterEmpId = searchParams.get('employee_id');

  const [records, setRecords] = useState<Attendance[]>([]);
  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [punchLoading, setPunchLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Correction Modal
  const [correctingRecord, setCorrectingRecord] = useState<Attendance | null>(null);
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [correctedStatus, setCorrectedStatus] = useState<string>('Present');

  // Office Hours Configuration Modal (Admin Protocol)
  const [isHoursModalOpen, setIsHoursModalOpen] = useState(false);
  const [hoursData, setHoursData] = useState({
    start_time: '09:00',
    end_time: '18:00',
    break_hours: 1.0,
    grace_minutes: 45,
    effective_date: new Date().toISOString().slice(0, 10),
    reason: '',
  });
  const [hoursSubmitting, setHoursSubmitting] = useState(false);
  const [hoursSuccessMsg, setHoursSuccessMsg] = useState('');

  // Attendance Period Lock (Step 2: HR Manager Approval Protocol)
  const [selectedLockMonth, setSelectedLockMonth] = useState('2026-08');
  const [lockStatus, setLockStatus] = useState<any>(null);
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [lockNotes, setLockNotes] = useState('Monthly attendance audited and verified with zero discrepancy for payroll.');
  const [isLocking, setIsLocking] = useState(false);


  // Live ticking digital clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadLockStatus = async () => {
    try {
      const res = await attendanceApi.lockStatus(selectedLockMonth);
      setLockStatus(res.data);
    } catch {
      setLockStatus(null);
    }
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [recRes, todayRes, schRes] = await Promise.all([
        attendanceApi.list({ employee_id: filterEmpId ? Number(filterEmpId) : undefined }),
        attendanceApi.today(),
        schedulesApi.list(),
      ]);
      setRecords(recRes.data);
      setTodayRecord(todayRes.data);
      if (schRes.data && schRes.data.length > 0) {
        const prim = schRes.data[0];
        setSchedule(prim);
        if (prim.day_lines && prim.day_lines.length > 0) {
          setHoursData(prev => ({
            ...prev,
            start_time: prim.day_lines[0].start_time || '09:00',
            end_time: prim.day_lines[0].end_time || '18:00',
            break_hours: prim.day_lines[0].break_hours ?? 1.0,
          }));
        }
      }
      await loadLockStatus();
    } catch (err) {
      console.error('Failed to load attendance records', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLockStatus();
  }, [selectedLockMonth]);

  const handleLockPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLocking(true);
      const res = await attendanceApi.lockPeriod({
        month: selectedLockMonth,
        approval_notes: lockNotes,
      });
      alert(res.data.message || 'Attendance period approved and locked for payroll.');
      setIsLockModalOpen(false);
      await loadLockStatus();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to lock attendance period');
    } finally {
      setIsLocking(false);
    }
  };


  useEffect(() => {
    loadData();
  }, [filterEmpId, user?.user_id]);

  const handlePunch = async (action: 'check_in' | 'check_out') => {
    try {
      setPunchLoading(true);
      // Automatically send current live real-time ISO timestamp
      await attendanceApi.punch(action, new Date().toISOString());
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Punch failed');
    } finally {
      setPunchLoading(false);
    }
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingRecord) return;
    try {
      await attendanceApi.correct(correctingRecord.id, {
        status: correctedStatus,
        correction_notes: correctionNotes,
      });
      setCorrectingRecord(null);
      setCorrectionNotes('');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Correction failed');
    }
  };

  const handleOfficeHoursSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hoursData.reason || hoursData.reason.trim().length < 5) {
      alert('Please provide a mandatory protocol reason for changing company office hours.');
      return;
    }
    try {
      setHoursSubmitting(true);
      await schedulesApi.updateOfficeHours({
        start_time: hoursData.start_time,
        end_time: hoursData.end_time,
        break_hours: Number(hoursData.break_hours),
        grace_minutes: Number(hoursData.grace_minutes),
        effective_date: hoursData.effective_date,
        reason: hoursData.reason,
      });
      setHoursSuccessMsg('Office timings updated & 3-day company-wide broadcast alert published!');
      setTimeout(() => {
        setIsHoursModalOpen(false);
        setHoursSuccessMsg('');
        loadData();
      }, 1500);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update office hours');
    } finally {
      setHoursSubmitting(false);
    }
  };

  // Compute 7 metrics
  const presentCount = records.filter(r => r.status === 'Present').length;
  const lateCount = records.filter(r => r.status === 'Late').length;
  const missingCount = records.filter(r => r.status === 'Missing_Checkout').length;
  const manualCount = records.filter(r => r.is_manual_correction).length;
  const overtimeCount = records.filter(r => r.overtime_hours > 0).length;
  const totalWorked = records.reduce((acc, r) => acc + r.worked_hours, 0);

  const canAuditAttendance = user?.role === 'HR_Manager' || user?.role === 'Admin';
  const isAdmin = user?.role === 'Admin';
  const startDisplay = schedule?.day_lines?.[0]?.start_time || '09:00';
  const endDisplay = schedule?.day_lines?.[0]?.end_time || '18:00';

  // Punch widget is only shown when viewing YOUR OWN attendance.
  // If filterEmpId is set and does NOT match the logged-in user's own employee_id → read-only view.
  const isViewingOwnAttendance =
    !filterEmpId ||
    (user?.employee_id != null && Number(filterEmpId) === user.employee_id);

  // Name of employee being viewed (for HR/Admin read-only mode)
  const viewedEmployeeName = records[0]?.employee?.full_name || (filterEmpId ? `Employee #${filterEmpId}` : null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Clock className="text-indigo-600" size={26} />
            Daily Attendance & Exception Center
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Live punch tracking, working schedule cross-referencing, and audited manual correction ledger.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canAuditAttendance && (
            <button
              id="btn-lock-attendance-period"
              onClick={() => setIsLockModalOpen(true)}
              className={`text-xs font-semibold px-3.5 py-2 rounded-xl border transition-all flex items-center gap-1.5 shadow-2xs ${
                lockStatus?.is_locked
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent'
              }`}
            >
              <ShieldCheck size={15} />
              {lockStatus?.is_locked ? `✓ Locked for Payroll (${selectedLockMonth})` : `Approve & Lock Attendance (${selectedLockMonth})`}
            </button>
          )}

          {isAdmin && (
            <button
              id="btn-configure-office-hours"
              onClick={() => setIsHoursModalOpen(true)}
              className="btn-secondary text-xs font-semibold shadow-2xs"
            >
              <Settings size={14} className="text-indigo-600" />
              Configure Office Timings (Admin)
            </button>
          )}
        </div>
      </div>

      {/* Attendance Period Lock Banner (Step 2: HR Manager Approval) */}
      {lockStatus?.is_locked && (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-700 mt-0.5">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">
                Step 2 Complete — Attendance for {lockStatus.month} is Approved &amp; Locked for Payroll
              </p>
              <p className="text-emerald-800 mt-0.5">
                Approved by <b>{lockStatus.locked_by_name || 'HR Manager'}</b> on {lockStatus.locked_at?.slice(0, 10)}. Note: "{lockStatus.approval_notes}"
              </p>
              <span className="text-[11px] text-emerald-700 block mt-0.5">
                Eligible employees have been notified to verify their statements. Payroll processing batch is now unlocked.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={selectedLockMonth}
              onChange={(e) => setSelectedLockMonth(e.target.value)}
              className="bg-white text-xs font-bold text-emerald-800 border border-emerald-300 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer shadow-xs"
            >
              <option value="2026-08">August 2026</option>
              <option value="2026-09">September 2026</option>
              <option value="2026-07">July 2026</option>
            </select>
          </div>
        </div>
      )}


      {/* Daily Punch Card — only for own attendance */}
      {isViewingOwnAttendance ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 border-l-4 border-l-indigo-600 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row items-start justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                  {user?.role === 'Employee'
                    ? 'Live Attendance Clock'
                    : `My Personal Clock — ${user?.full_name} (${user?.badge_id || user?.role})`}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {currentTime.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h3>
              <p className="text-xs text-slate-500">
                {todayRecord?.check_in
                  ? `Punched in at ${formatTime(todayRecord.check_in)} ${
                      todayRecord.check_out
                        ? `• Punched out at ${formatTime(todayRecord.check_out)} • ${todayRecord.worked_hours.toFixed(1)}h worked`
                        : '• Active Working Shift'
                    }`
                  : `Official Shift: ${startDisplay} - ${endDisplay} • Ready to punch in`}
              </p>
              {user?.role !== 'Employee' && !filterEmpId && (
                <p className="text-[11px] text-amber-600 font-medium">
                  Note: This clock is strictly for your personal shift ({user?.full_name}). Company employees punch independently from their own accounts.
                </p>
              )}
            </div>

            {/* Single toggling Punch button */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              {!todayRecord?.check_in ? (
                <button
                  id="punch-checkin-btn"
                  disabled={punchLoading}
                  onClick={() => handlePunch('check_in')}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <LogIn size={16} />
                  {punchLoading ? 'Punching In…' : user?.role === 'Employee' ? 'Punch In' : 'Punch In (My Shift)'}
                </button>
              ) : !todayRecord?.check_out ? (
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    ✓ Punched In at {formatTime(todayRecord.check_in)}
                  </span>
                  <button
                    id="punch-checkout-btn"
                    disabled={punchLoading}
                    onClick={() => handlePunch('check_out')}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <LogOut size={16} />
                    {punchLoading ? 'Punching Out…' : user?.role === 'Employee' ? 'Punch Out' : 'Punch Out (My Shift)'}
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-right leading-6">
                  <div>
                    <span className="text-slate-500">In:</span>{' '}
                    <span className="font-semibold">{formatTime(todayRecord.check_in)}</span>
                    {'  →  '}
                    <span className="text-slate-500">Out:</span>{' '}
                    <span className="font-semibold">{formatTime(todayRecord.check_out!)}</span>
                  </div>
                  <span className="text-emerald-700 font-bold text-sm">{todayRecord.worked_hours.toFixed(1)}h worked</span>
                  <span className="text-slate-400"> today</span>
                </div>
              )}
            </div>
          </div>

          {/* Grace Window Policy Strip */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 font-medium">
              <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
              <span>
                <b>Grace Policy:</b> ±45 min early or late punch is exempted from salary deductions.
              </span>
            </div>
            <span className="text-slate-400 text-[11px]">
              Official Company Shift: {startDisplay} - {endDisplay} (1h Break)
            </span>
          </div>
        </div>
      ) : (
        /* HR/Admin read-only banner when viewing another employee's records */
        <div className="bg-white p-5 rounded-2xl border border-slate-200 border-l-4 border-l-amber-500 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                Read-Only View — Attendance Records for{' '}
                <span className="text-indigo-700">{viewedEmployeeName}</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                You are viewing this employee's attendance log as <b>{user?.role?.replace(/_/g, ' ')}</b>. 
                Punch In / Punch Out actions can only be performed by the employee themselves from their own login session.
                You may use the <b>Audit (pencil) button</b> on any row to apply an authorised manual correction.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 7 Attendance Operations Metrics Panel */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center shadow-2xs">
          <span className="block text-xl font-bold font-mono text-emerald-600">{presentCount}</span>
          <span className="text-xs text-slate-500 font-medium">Present Shifts</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center shadow-2xs">
          <span className="block text-xl font-bold font-mono text-amber-600">{lateCount}</span>
          <span className="text-xs text-slate-500 font-medium">Late Arrivals</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center shadow-2xs">
          <span className="block text-xl font-bold font-mono text-purple-600">{missingCount}</span>
          <span className="text-xs text-slate-500 font-medium">Missing Checkout</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center shadow-2xs">
          <span className="block text-xl font-bold font-mono text-sky-600">{overtimeCount}</span>
          <span className="text-xs text-slate-500 font-medium">Overtime Shifts</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center shadow-2xs">
          <span className="block text-xl font-bold font-mono text-indigo-600">{manualCount}</span>
          <span className="text-xs text-slate-500 font-medium">Manual Audits</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center shadow-2xs">
          <span className="block text-xl font-bold font-mono text-slate-900">{totalWorked.toFixed(1)}h</span>
          <span className="text-xs text-slate-500 font-medium">Total Clocked Hrs</span>
        </div>
      </div>

      {filterEmpId && (
        <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-between text-xs text-sky-700">
          <span>Filtering attendance logs for Employee #{filterEmpId}</span>
          <a href="/attendance" className="font-semibold underline hover:text-sky-900">Clear Filter</a>
        </div>
      )}

      {/* Attendance Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="text-center py-16 text-slate-400">Loading punch records...</div>
        ) : records.length === 0 ? (
          <div className="p-10 text-center text-slate-500">No attendance logs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Check In</th>
                  <th className="py-3.5 px-4">Check Out</th>
                  <th className="py-3.5 px-4">Worked (Net)</th>
                  <th className="py-3.5 px-4">Overtime</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-slate-800">
                      <span className={r.date === new Date().toISOString().slice(0, 10) ? 'font-bold text-indigo-700' : ''}>
                        {r.date}
                      </span>
                      {r.date === new Date().toISOString().slice(0, 10) && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Today
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {r.employee?.full_name || `Emp #${r.employee_id}`}
                        </span>
                        {r.employee?.badge_id && (
                          <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                            {r.employee.badge_id}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 font-mono">
                      {r.check_in ? formatTime(r.check_in) : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 font-mono">
                      {r.check_out ? formatTime(r.check_out) : (
                        <span className="text-purple-600 font-medium">Missing Checkout</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-800 font-mono">{r.worked_hours.toFixed(2)} hrs</td>
                    <td className="py-3 px-4 text-xs text-sky-700 font-mono">
                      {r.overtime_hours > 0 ? `+${r.overtime_hours.toFixed(2)} hrs` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          r.status === 'Present'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : r.status === 'Late'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : r.status === 'Missing_Checkout'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {r.status.replace('_', ' ')}
                      </span>
                      {r.is_manual_correction && (
                        <span className="ml-1.5 text-[10px] text-slate-400 italic" title={r.correction_notes || ''}>
                          (audited)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canAuditAttendance && (
                        <button
                          onClick={() => {
                            setCorrectingRecord(r);
                            setCorrectedStatus(r.status);
                            setCorrectionNotes(r.correction_notes || '');
                          }}
                          className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                          title="Manual Audited Correction (HR Manager / Admin)"
                        >
                          <Edit3 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Correction Modal */}
      {correctingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl shadow-xl border border-slate-200 animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900">Audited Attendance Correction</h2>
              <button onClick={() => setCorrectingRecord(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCorrectionSubmit} className="space-y-4">
              <div>
                <label className="field-label">Employee Record</label>
                <p className="text-sm font-semibold text-slate-900">
                  {correctingRecord.employee?.full_name} on {correctingRecord.date}
                </p>
              </div>

              <div>
                <label className="field-label">Status Override *</label>
                <select
                  value={correctedStatus}
                  onChange={(e) => setCorrectedStatus(e.target.value)}
                  className="input-field"
                >
                  <option value="Present">Present (Normal)</option>
                  <option value="Late">Late Arrival</option>
                  <option value="Missing_Checkout">Missing Checkout</option>
                  <option value="Excused">Excused Absence</option>
                </select>
              </div>

              <div>
                <label className="field-label">Mandatory Audit Justification *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="State reason for manual punch adjustment (e.g. biometric scanner hardware reset)..."
                  value={correctionNotes}
                  onChange={(e) => setCorrectionNotes(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCorrectingRecord(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs font-semibold"
                >
                  Save Audited Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CONFIGURE OFFICE HOURS MODAL (ADMIN PROTOCOL) ───────────── */}
      {isHoursModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white max-w-lg w-full p-6 rounded-2xl shadow-xl border border-slate-200 animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">Admin Protocol: Company Office Timings</h2>
              </div>
              <button onClick={() => setIsHoursModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            {hoursSuccessMsg ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-center space-y-2">
                <CheckCircle2 size={24} className="mx-auto text-emerald-600" />
                <p className="font-semibold text-sm">{hoursSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleOfficeHoursSubmit} className="space-y-4">
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-700">
                    <AlertCircle size={14} />
                    <span>Company-Wide Broadcast Protocol:</span>
                  </div>
                  <p>
                    Updating timings will automatically modify the primary working schedule in the database and publish a <b>3-day broadcast alert banner</b> to all Employee, HR, and Admin accounts on login.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Office Start Time *</label>
                    <input
                      type="time"
                      required
                      value={hoursData.start_time}
                      onChange={(e) => setHoursData({ ...hoursData, start_time: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="field-label">Office End Time *</label>
                    <input
                      type="time"
                      required
                      value={hoursData.end_time}
                      onChange={(e) => setHoursData({ ...hoursData, end_time: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Lunch Break (Hours) *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="3"
                      required
                      value={hoursData.break_hours}
                      onChange={(e) => setHoursData({ ...hoursData, break_hours: Number(e.target.value) })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="field-label">Grace Exemption (Minutes) *</label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      required
                      value={hoursData.grace_minutes}
                      onChange={(e) => setHoursData({ ...hoursData, grace_minutes: Number(e.target.value) })}
                      className="input-field"
                    />
                  </div>
                </div>

                <div>
                  <label className="field-label">Effective Date *</label>
                  <input
                    type="date"
                    required
                    value={hoursData.effective_date}
                    onChange={(e) => setHoursData({ ...hoursData, effective_date: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="field-label">Protocol Justification / Reason *</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="State administrative justification (e.g. Summer shift realignment, management policy revision)..."
                    value={hoursData.reason}
                    onChange={(e) => setHoursData({ ...hoursData, reason: e.target.value })}
                    className="input-field text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsHoursModalOpen(false)}
                    className="btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={hoursSubmitting}
                    className="btn-primary text-xs font-semibold"
                  >
                    {hoursSubmitting ? 'Updating & Broadcasting...' : 'Apply & Broadcast Schedule'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Attendance Approval & Period Lock Modal (Step 2: HR Manager Protocol) */}
      {isLockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl shadow-xl border border-slate-200 animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">Approve &amp; Lock Attendance for Payroll</h2>
              </div>
              <button onClick={() => setIsLockModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleLockPeriod} className="space-y-4">
              <div>
                <label className="field-label">Payroll Period Month *</label>
                <select
                  value={selectedLockMonth}
                  onChange={(e) => setSelectedLockMonth(e.target.value)}
                  className="input-field font-semibold"
                >
                  <option value="2026-08">August 2026 (Unrun Payrun Cycle)</option>
                  <option value="2026-09">September 2026 (Live Current)</option>
                  <option value="2026-07">July 2026 (Historical)</option>
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-indigo-700">
                  <CheckCircle2 size={14} /> HR Manager Approval Mandate
                </span>
                <p>
                  Locking attendance verifies that all missing checkouts, punch corrections, and approved time-off requests for <b>{selectedLockMonth}</b> are audited.
                </p>
                <p className="text-[11px] text-indigo-800">
                  Once approved, attendance records are frozen and the <b>Payroll Processing Team</b> receives authorization to compute payruns.
                </p>
              </div>

              <div>
                <label className="field-label">Audit Approval Notes *</label>
                <textarea
                  required
                  rows={2}
                  value={lockNotes}
                  onChange={(e) => setLockNotes(e.target.value)}
                  placeholder="e.g. Audited 2 missing checkouts on Aug 28. Verified LOP deductions. Approved for payroll."
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
                  {isLocking ? 'Locking Attendance...' : 'Approve & Lock Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

