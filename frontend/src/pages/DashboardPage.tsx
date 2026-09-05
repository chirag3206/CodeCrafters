import { useState, useEffect } from 'react';
import { dashboardApi, employeesApi } from '../services/api';
import type { Department } from '../types';
import {
  LayoutDashboard, DollarSign, Receipt, TrendingUp,
  Calendar, Activity, Mail, Clock, Filter,
  PieChart as PieIcon, X
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts';

interface EmailOutboxItem {
  id: number;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body_html: string;
  email_type: string;
  status: string;
  sent_at: string | null;
  created_at: string;
}

const DONUT_COLORS = ['#4F46E5', '#0284C7', '#059669', '#D97706', '#DB2777'];

export default function DashboardPage() {
  const [kpiData, setKpiData] = useState<any>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [periodStart, setPeriodStart] = useState<string>('2026-09-01');
  const [periodEnd, setPeriodEnd] = useState<string>('2026-09-30');

  // Email Outbox Modal
  const [isOutboxOpen, setIsOutboxOpen] = useState(false);
  const [outboxEmails, setOutboxEmails] = useState<EmailOutboxItem[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailOutboxItem | null>(null);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const [kpiRes, deptRes] = await Promise.all([
        dashboardApi.kpis({
          period_start: periodStart || undefined,
          period_end: periodEnd || undefined,
          department_id: selectedDept ? Number(selectedDept) : undefined,
          employee_type: selectedType || undefined,
        }),
        employeesApi.departments(),
      ]);
      setKpiData(kpiRes.data);
      setDepartments(deptRes.data);
    } catch (err) {
      console.error('Failed to load dashboard KPIs', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [selectedDept, selectedType, periodStart, periodEnd]);

  const handleOpenOutbox = async () => {
    try {
      setIsOutboxOpen(true);
      const res = await dashboardApi.outbox();
      setOutboxEmails(res.data);
      if (res.data.length > 0) {
        setSelectedEmail(res.data[0]);
      }
    } catch (err) {
      console.error('Failed to load email outbox', err);
    }
  };

  if (isLoading || !kpiData) {
    return <div className="text-center py-20 text-slate-400">Loading Executive Analytics Dashboard...</div>;
  }

  const att = kpiData.attendance || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <LayoutDashboard className="text-indigo-600" size={26} />
            Executive Payroll & HR Analytics
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Live transactional aggregation, attendance health indicators, and multi-tier expenditure tracking.
          </p>
        </div>

        <button
          onClick={handleOpenOutbox}
          className="btn-secondary text-xs font-semibold shadow-2xs"
        >
          <Mail size={14} className="text-indigo-600" />
          In-App Email Outbox
        </button>
      </div>

      {/* Global Slicing Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Filter size={14} className="text-slate-400" />
          <span>Filters:</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="input-field py-1 text-xs"
          />
          <span className="text-xs text-slate-400 font-medium">to</span>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="input-field py-1 text-xs"
          />
        </div>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="input-field py-1 text-xs max-w-[180px]"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="input-field py-1 text-xs max-w-[180px]"
        >
          <option value="All">All Employee Types</option>
          <option value="Full-Time">Full-Time Staff</option>
          <option value="Part-Time">Part-Time Staff</option>
          <option value="Contractor">Contractors</option>
        </select>
      </div>

      {/* ─── 5 REQUIRED CORE EXECUTIVE KPI CARDS ───────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* KPI 1: Total Net Salary Paid */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-200 border-l-4 border-l-emerald-600 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Net Paid</span>
            <DollarSign size={16} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-700">
            ₹{kpiData.total_net_salary_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400 font-medium block">Finalized Net Payroll</span>
        </div>

        {/* KPI 2: Payslips Generated */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-200 border-l-4 border-l-indigo-600 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Payslips Generated</span>
            <Receipt size={16} className="text-indigo-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900">
            {kpiData.payslips_generated}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] font-medium">
            <span className="text-emerald-700">{kpiData.payslips_paid} Paid</span>
            <span className="text-slate-300">•</span>
            <span className="text-blue-700">{kpiData.payslips_validated} Val</span>
            <span className="text-slate-300">•</span>
            <span className="text-amber-700">{kpiData.payslips_draft} Draft</span>
          </div>
        </div>

        {/* KPI 3: Average Salary */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-200 border-l-4 border-l-sky-600 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Average Net Wage</span>
            <TrendingUp size={16} className="text-sky-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-sky-700">
            ₹{kpiData.average_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400 font-medium block">Per Validated Employee</span>
        </div>

        {/* KPI 4: Approved Time Off */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-200 border-l-4 border-l-amber-600 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Approved Time Off</span>
            <Calendar size={16} className="text-amber-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-amber-700">
            {kpiData.approved_time_off_days.toFixed(1)} <span className="text-xs font-normal">Days</span>
          </p>
          <span className="text-[10px] text-slate-400 font-medium block">Consolidated Leave Quota</span>
        </div>

        {/* KPI 5: Attendance Health Score */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-200 border-l-4 border-l-purple-600 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Attendance Health</span>
            <Activity size={16} className="text-purple-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-purple-700">
            {kpiData.attendance_health_score.toFixed(1)}%
          </p>
          <span className="text-[10px] text-slate-400 font-medium block">Shift Compliance Index</span>
        </div>
      </div>

      {/* ─── 7 ATTENDANCE OPERATIONS METRICS OVERVIEW ──────────────── */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <Clock size={14} className="text-sky-600" />
          Attendance Operations Health Overview (7 Metrics)
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-center">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-xs text-slate-500 font-medium block">Present</span>
            <span className="text-lg font-bold font-mono text-emerald-700">{att.present ?? 0}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-xs text-slate-500 font-medium block">Late Arrivals</span>
            <span className="text-lg font-bold font-mono text-amber-700">{att.late ?? 0}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-xs text-slate-500 font-medium block">Absent (Derived)</span>
            <span className="text-lg font-bold font-mono text-rose-700">{att.absent ?? 0}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-xs text-slate-500 font-medium block">Overtime Shifts</span>
            <span className="text-lg font-bold font-mono text-sky-700">{att.overtime_count ?? 0}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-xs text-slate-500 font-medium block">Missing Checkouts</span>
            <span className="text-lg font-bold font-mono text-purple-700">{att.missing_checkouts ?? 0}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-xs text-slate-500 font-medium block">Manual Edits</span>
            <span className="text-lg font-bold font-mono text-indigo-700">{att.manual_edits ?? 0}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-xs text-slate-500 font-medium block">Coverage</span>
            <span className="text-lg font-bold font-mono text-slate-900">{att.attendance_coverage_pct ?? 100}%</span>
          </div>
        </div>
      </div>

      {/* ─── RECHARTS VISUALIZATIONS ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Salary by Department Donut */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <PieIcon size={14} className="text-indigo-600" />
            Salary Expenditure by Department
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={kpiData.salary_by_department}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                >
                  {kpiData.salary_by_department?.map((_entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: '0.75rem', color: '#0F172A', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)' }}
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Net Salary']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
            {kpiData.salary_by_department?.map((d: any, idx: number) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
                <span className="text-slate-600">{d.name} (₹{d.value.toLocaleString('en-IN')})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Monthly Net Trend vs Headcount */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 lg:col-span-2">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-600" />
            Monthly Net Salary Trend vs Headcount
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={kpiData.monthly_net_trend}>
                <defs>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(val) => `₹${val / 1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: '0.75rem', color: '#0F172A', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)' }}
                  formatter={(val: any, name: any) => [name === 'net_salary' ? `₹${Number(val).toLocaleString('en-IN')}` : val, name === 'net_salary' ? 'Net Payout' : 'Headcount']}
                />
                <Area type="monotone" dataKey="net_salary" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorNet)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ─── IN-APP EMAIL OUTBOX VIEWER MODAL ─────────────────────── */}
      {isOutboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white max-w-3xl w-full p-6 rounded-2xl shadow-xl border border-slate-200 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Mail size={18} className="text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">In-App Email Outbox Dispatch Viewer</h2>
              </div>
              <button onClick={() => setIsOutboxOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {outboxEmails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedEmail?.id === email.id
                        ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-900">{email.recipient_name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {email.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium truncate">{email.subject}</p>
                    <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                      {new Date(email.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>

              {selectedEmail && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                  <div>
                    <span className="text-slate-500 font-medium block">Recipient:</span>
                    <span className="font-semibold text-slate-900">{selectedEmail.recipient_name} ({selectedEmail.recipient_email})</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Subject:</span>
                    <span className="font-semibold text-slate-900">{selectedEmail.subject}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-slate-500 font-medium block mb-1">HTML Body Payload:</span>
                    <div
                      className="p-3 rounded-lg bg-white border border-slate-200 text-slate-800 text-[11px] max-h-[220px] overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
