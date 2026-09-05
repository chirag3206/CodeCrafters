import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { payrunsApi, payslipsApi, grievancesApi } from '../services/api';
import type { Payrun, Payslip } from '../types';
import {
  Zap, Send, ShieldCheck, CreditCard,
  Mail, FileSpreadsheet, Download, AlertTriangle, ArrowLeft,
  X, MessageSquare, Eye, CheckCircle2, Clock, FileDown, ChevronDown
} from 'lucide-react';

export default function PayrunDetailPage() {
  const { user } = useAuth();
  const canApprovePayroll = user?.role === 'HR_Payroll_Manager' || user?.role === 'Admin';
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [payrun, setPayrun] = useState<Payrun | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Selected Payslip for breakdown modal
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  // Grievance Resolution Modal
  const [resolvingPayslip, setResolvingPayslip] = useState<Payslip | null>(null);
  const [resolutionAction, setResolutionAction] = useState<'accept_adjust' | 'reject'>('accept_adjust');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Download dropdown (PDF / CSV) per slip row
  const [downloadDropdownSlipId, setDownloadDropdownSlipId] = useState<number | null>(null);

  const loadData = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const [prRes, slRes] = await Promise.all([
        payrunsApi.get(Number(id)),
        payslipsApi.list({ payrun_id: Number(id) }),
      ]);
      setPayrun(prRes.data);
      setPayslips(slRes.data);
    } catch (err) {
      console.error('Failed to load payrun details', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleCompute = async () => {
    if (!id) return;
    try {
      setActionLoading(true);
      await payrunsApi.compute(Number(id));
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Calculation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendPreVerification = async () => {
    if (!id) return;
    try {
      setActionLoading(true);
      await payrunsApi.sendPreVerification(Number(id));
      alert('Pre-payroll operational verification statements distributed to employee portals.');
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to dispatch pre-statements');
    } finally {
      setActionLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!id) return;
    try {
      setActionLoading(true);
      await payrunsApi.validate(Number(id));
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Validation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!id) return;
    try {
      setActionLoading(true);
      await payrunsApi.markPaid(Number(id));
      alert('Final Sign-Off Complete! The HR Payroll Manager has authorized this payrun. Status is marked as PAID, ReportLab PDFs are generated, and email notifications have been dispatched to all staff. No Admin approval required.');
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Mark paid failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendEmails = async () => {
    if (!id) return;
    try {
      setActionLoading(true);
      await payrunsApi.sendPayslips(Number(id));
      alert('Bulk payslip notification emails dispatched and logged to Outbox!');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Email dispatch failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveGrievance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingPayslip) return;
    try {
      await grievancesApi.resolve(resolvingPayslip.id, {
        action: resolutionAction,
        resolution_notes: resolutionNotes,
      });
      setResolvingPayslip(null);
      setResolutionNotes('');
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Grievance resolution failed');
    }
  };

  if (isLoading) {
    return <div className="text-center py-20 text-slate-400">Loading Payrun Control Center...</div>;
  }

  if (!payrun) {
    return (
      <div className="bg-white p-10 text-center text-slate-500 rounded-xl border border-slate-200">
        <p>Payrun batch not found.</p>
        <button onClick={() => navigate('/payroll')} className="mt-4 btn-secondary text-xs">
          Back to Payroll
        </button>
      </div>
    );
  }

  // Parse all anomaly warnings across slips
  const allWarnings: string[] = [];
  payslips.forEach(s => {
    if (s.warnings_json) {
      try {
        const parsed = JSON.parse(s.warnings_json);
        parsed.forEach((w: string) => {
          allWarnings.push(`${s.employee?.full_name || 'Staff'}: ${w}`);
        });
      } catch {}
    }
  });

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/payroll')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium"
        >
          <ArrowLeft size={16} />
          Back to Payruns
        </button>

        <span
          className={`px-3 py-1 rounded-full text-xs font-bold border ${
            payrun.status === 'Paid'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : payrun.status === 'Validated'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : payrun.status === 'Pre_Verification'
              ? 'bg-purple-50 text-purple-700 border-purple-200'
              : payrun.status === 'Computed'
              ? 'bg-sky-50 text-sky-700 border-sky-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          STATUS: {payrun.status.replace('_', ' ')}
        </span>
      </div>

      {/* Control Center Header Hero */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="font-mono text-xs font-bold text-indigo-700">{payrun.reference}</span>
            <h1 className="text-2xl font-bold text-slate-900 mt-0.5">{payrun.name}</h1>
            <p className="text-xs text-slate-500 mt-1">
              Period: <span className="font-mono text-slate-800 font-semibold">{payrun.period_start} to {payrun.period_end}</span> • Structure:{' '}
              <span className="text-slate-800 font-medium">{payrun.salary_structure?.name || 'Standard Regular'}</span>
            </p>
          </div>

          <div className="flex items-center gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Net Payout</span>
              <span className="text-xl font-bold font-mono text-emerald-700">
                ₹{payrun.total_net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Deductions</span>
              <span className="text-sm font-semibold font-mono text-rose-700">
                ₹{payrun.total_deductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* ─── 4-STAGE PAYRUN WORKFLOW STEPPER ──────────────────────── */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            {/* Stage 1 */}
            <div className={`p-2.5 rounded-lg flex items-center gap-2 ${
              payrun.status !== 'Draft'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}>
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>
              <div>
                <p className="font-bold text-[11px]">1. Payroll Processing</p>
                <p className="text-[10px] text-slate-500 font-normal">Candidate scope &amp; rule computation</p>
              </div>
            </div>

            {/* Stage 2 */}
            <div className={`p-2.5 rounded-lg flex items-center gap-2 ${
              payrun.status === 'Validated' || payrun.status === 'Paid'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold'
                : payrun.status === 'Computed'
                ? 'bg-indigo-50 text-indigo-900 border border-indigo-300 font-bold shadow-xs ring-1 ring-indigo-200'
                : 'bg-white text-slate-400 border border-slate-200'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                payrun.status === 'Validated' || payrun.status === 'Paid'
                  ? 'bg-emerald-600 text-white'
                  : payrun.status === 'Computed'
                  ? 'bg-indigo-600 text-white animate-pulse'
                  : 'bg-slate-200 text-slate-600'
              }`}>
                {payrun.status === 'Validated' || payrun.status === 'Paid' ? '✓' : '2'}
              </span>
              <div>
                <p className="font-bold text-[11px]">2. Manager Approval</p>
                <p className="text-[10px] text-slate-500 font-normal">
                  {payrun.status === 'Validated' || payrun.status === 'Paid' ? 'Approved & Signed Off' : 'Pending Manager Sign-Off'}
                </p>
              </div>
            </div>

            {/* Stage 3 */}
            <div className={`p-2.5 rounded-lg flex items-center gap-2 ${
              payrun.status === 'Paid'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold'
                : payrun.status === 'Validated'
                ? 'bg-indigo-50 text-indigo-900 border border-indigo-300 font-bold shadow-xs ring-1 ring-indigo-200'
                : 'bg-white text-slate-400 border border-slate-200'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                payrun.status === 'Paid'
                  ? 'bg-emerald-600 text-white'
                  : payrun.status === 'Validated'
                  ? 'bg-indigo-600 text-white animate-pulse'
                  : 'bg-slate-200 text-slate-600'
              }`}>
                {payrun.status === 'Paid' ? '✓' : '3'}
              </span>
              <div>
                <p className="font-bold text-[11px]">3. Final Approval &amp; Pay</p>
                <p className="text-[10px] text-slate-500 font-normal">
                  {payrun.status === 'Paid' ? 'Paid & Distributed' : 'HR Payroll Mgr Sign-Off'}
                </p>
              </div>
            </div>

            {/* Stage 4 */}
            <div className={`p-2.5 rounded-lg flex items-center gap-2 ${
              payrun.status === 'Paid'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold'
                : 'bg-white text-slate-400 border border-slate-200'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                payrun.status === 'Paid' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {payrun.status === 'Paid' ? '✓' : '4'}
              </span>
              <div>
                <p className="font-bold text-[11px]">4. Banking &amp; Files</p>
                <p className="text-[10px] text-slate-500 font-normal">
                  {payrun.status === 'Paid' ? 'NEFT/ACH & PDFs Ready' : 'Unlocks after Sign-Off'}
                </p>
              </div>
            </div>
          </div>

          {/* Workflow Role Guidance Banners */}
          {payrun.status === 'Computed' && !canApprovePayroll && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
              <div className="flex items-start gap-2">
                <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-950">Submitted to Payroll Manager for Sign-Off</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Payroll calculations are complete. This batch is awaiting review and validation by <b>Payroll Manager (Sunita Rao)</b>.
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded font-semibold shrink-0">
                Switch to Sunita (Payroll Mgr) to Approve
              </span>
            </div>
          )}

          {payrun.status === 'Computed' && canApprovePayroll && (
            <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-indigo-900">
              <div className="flex items-start gap-2">
                <ShieldCheck size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-indigo-950">Manager Action Required: Validate &amp; Approve Batch</p>
                  <p className="text-[11px] text-indigo-800 mt-0.5">
                    As HR Payroll Manager, review the itemized deductions and net payouts. Click <b>"Validate Batch (Payroll Manager)"</b> below to approve.
                  </p>
                </div>
              </div>
            </div>
          )}

          {payrun.status === 'Validated' && canApprovePayroll && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-900">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-950">Batch Validated: Ready for Final HR Payroll Manager Sign-Off</p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    As HR Payroll Manager, your approval is the final sign-off. Click <b>"Final Approval: Mark Paid, Distribute Payslips &amp; Notify Staff"</b> below. This marks the batch as Paid, generates official ReportLab PDF payslips, distributes them to employee portals, and automatically dispatches email notifications. <b>No Admin approval is required.</b>
                  </p>
                </div>
              </div>
            </div>
          )}

          {payrun.status === 'Paid' && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-950 shadow-2xs">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-950">✓ Final Approval Complete (HR Payroll Manager Authority)</p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Full sign-off has been executed by the <b>HR Payroll Manager</b>. All payslips are published to employee portals, email notifications have been dispatched, and Indian Bank NEFT/ACH export files are ready. <b>No further Admin approval needed.</b>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── PRIMARY ACTIONS TOOLBAR ─────────────────────────────── */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
          {/* Action 1: Compute */}
          <button
            id="btn-compute-payrun"
            disabled={actionLoading || payrun.status === 'Paid'}
            onClick={handleCompute}
            className="btn-primary text-xs font-semibold py-2"
          >
            <Zap size={14} />
            Re-Compute ({payslips.length} Slips)
          </button>

          {/* Action 2: Send Pre-Statement */}
          <button
            id="btn-pre-verification"
            disabled={actionLoading || payrun.status === 'Draft' || payrun.status === 'Paid'}
            onClick={handleSendPreVerification}
            className="px-3.5 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
          >
            <Send size={14} />
            Send Pre-Payroll Statement
          </button>

          {/* Action 3: Validate (Payroll Manager Only) */}
          {canApprovePayroll && (
            <button
              id="btn-validate-payrun"
              disabled={actionLoading || payrun.status === 'Draft' || payrun.status === 'Validated' || payrun.status === 'Paid'}
              onClick={handleValidate}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs ${
                payrun.status === 'Computed'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white ring-2 ring-blue-300'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 disabled:opacity-50'
              }`}
            >
              <ShieldCheck size={14} />
              Validate Batch (Payroll Manager)
            </button>
          )}

          {/* Action 4: Final Sign-Off & Distribution (HR Payroll Manager) */}
          {canApprovePayroll && (
            <button
              id="btn-mark-paid"
              disabled={actionLoading || payrun.status !== 'Validated'}
              onClick={handleMarkPaid}
              className={`text-xs font-semibold py-2 px-3.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs ${
                payrun.status === 'Validated'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-300'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 disabled:opacity-50'
              }`}
            >
              <CreditCard size={14} />
              Final Approval: Mark Paid, Distribute Payslips &amp; Notify Staff
            </button>
          )}

          {/* Action 5: Resend / Audit Email Notifications (HR Payroll Manager) */}
          {canApprovePayroll && (
            <button
              id="btn-send-emails"
              disabled={actionLoading || payrun.status !== 'Paid'}
              onClick={handleSendEmails}
              className="px-3.5 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
            >
              <Mail size={14} />
              Resend Email Notifications
            </button>
          )}

          {/* ─── HR FINANCIAL EXPORTS ──────────────────────────────── */}
          <div className="ml-auto flex items-center gap-2">
            <a
              href={payrunsApi.exportExcelUrl(payrun.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors shadow-2xs"
              title="Download full payroll register Excel file"
            >
              <FileSpreadsheet size={13} className="text-emerald-600" />
              Excel (.xlsx)
            </a>
            <a
              href={payrunsApi.exportCsvUrl(payrun.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors shadow-2xs"
              title="Download CSV register"
            >
              <Download size={13} />
              CSV
            </a>
            {canApprovePayroll && (
              <a
                href={payrunsApi.exportBankCsvUrl(payrun.id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition-colors shadow-2xs"
                title="Direct NEFT/RTGS Indian bank disbursement batch file (Payroll Manager only)"
              >
                <CreditCard size={13} />
                Bank NEFT File
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 5 Pre-Validation Anomaly Warning Banners */}
      {allWarnings.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 border-l-4 border-l-amber-500 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle size={15} />
            Pre-Validation Anomaly Warnings Detected ({allWarnings.length})
          </div>
          <div className="space-y-1 pl-6">
            {allWarnings.map((w, idx) => (
              <p key={idx} className="text-xs text-amber-800 font-mono">
                • {w}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Payslips Summary Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs space-y-3">
        <div className="p-4 pb-0 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Batch Payslips ({payslips.length} Staff)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Scheduled</th>
                <th className="py-3 px-4">Worked</th>
                <th className="py-3 px-4">LOP (Unpaid)</th>
                <th className="py-3 px-4">Gross Pay</th>
                <th className="py-3 px-4">Deductions</th>
                <th className="py-3 px-4">Net Take-Home</th>
                <th className="py-3 px-4">Pre-Review</th>
                <th className="py-3 px-4 text-right">Drilldown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payslips.map((slip) => (
                <tr key={slip.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span>{slip.employee?.full_name || `Emp #${slip.employee_id}`}</span>
                      {slip.employee?.badge_id && (
                        <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                          {slip.employee.badge_id}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                      <span>{slip.employee?.department?.name}</span>
                      {slip.contract && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-indigo-600 font-semibold">{slip.contract.reference}</span>
                          {slip.contract.salary_structure?.name && (
                            <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold border border-emerald-200">
                              {slip.contract.salary_structure.name}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-slate-600">{slip.scheduled_days}d</td>
                  <td className="py-3 px-4 text-xs font-mono text-slate-800">{slip.worked_days}d</td>
                  <td className="py-3 px-4 text-xs font-mono text-rose-600 font-semibold">
                    {slip.unpaid_leave_days > 0 ? `${slip.unpaid_leave_days}d LOP` : '0d'}
                  </td>
                  <td className="py-3 px-4 text-xs font-mono font-medium text-slate-900">
                    ₹{slip.gross_pay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-rose-600">
                    ₹{slip.total_deductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                    ₹{slip.net_pay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4">
                    {slip.verification_status === 'Disputed' ? (
                      <button
                        onClick={() => setResolvingPayslip(slip)}
                        className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 animate-pulse"
                      >
                        <MessageSquare size={11} /> Disputed
                      </button>
                    ) : slip.verification_status === 'Confirmed' ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Confirmed
                      </span>
                    ) : slip.verification_status === 'Resolved' ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        Resolved
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">Pending</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Inspect breakdown modal */}
                      <button
                        onClick={() => setSelectedPayslip(slip)}
                        className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                        title="Inspect Sequenced Breakdown"
                      >
                        <Eye size={15} />
                      </button>

                      {/* PDF / CSV download dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => setDownloadDropdownSlipId(downloadDropdownSlipId === slip.id ? null : slip.id)}
                          className="flex items-center gap-0.5 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                          title="Download Payslip"
                        >
                          <FileDown size={15} />
                          <ChevronDown size={10} />
                        </button>
                        {downloadDropdownSlipId === slip.id && (
                          <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                            <a
                              href={payslipsApi.pdfUrl(slip.id)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => setDownloadDropdownSlipId(null)}
                              className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                            >
                              <Download size={12} />
                              Download PDF
                            </a>
                            <a
                              href={payslipsApi.csvUrl(slip.id)}
                              onClick={() => setDownloadDropdownSlipId(null)}
                              className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                            >
                              <FileSpreadsheet size={12} />
                              Download CSV
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── PAYSLIP SEQUENCED BREAKDOWN MODAL ────────────────────── */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white max-w-xl w-full p-6 rounded-2xl shadow-xl border border-slate-200 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <span className="text-[11px] font-bold text-indigo-600 uppercase">Sequenced Salary Rule Breakdown</span>
                <h2 className="text-base font-bold text-slate-900">
                  {selectedPayslip.employee?.full_name}
                  {selectedPayslip.employee?.badge_id && (
                    <span className="ml-2 font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                      {selectedPayslip.employee.badge_id}
                    </span>
                  )}
                  {' '}({selectedPayslip.period_start} to {selectedPayslip.period_end})
                </h2>
              </div>
              <button onClick={() => setSelectedPayslip(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Contract & Structure Provenance */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Contract Reference</span>
                  <span className="font-mono font-bold text-indigo-700">{selectedPayslip.contract?.reference || 'Direct / Fallback'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Salary Structure</span>
                  <span className="font-semibold text-slate-800">
                    {selectedPayslip.contract?.salary_structure?.name || selectedPayslip.payrun?.salary_structure?.name || 'Standard Regular Structure'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Base Contract Wage</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedPayslip.contract?.wage ? `₹${selectedPayslip.contract.wage.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block">Gross Salary</span>
                  <span className="font-bold text-slate-900 font-mono">₹{selectedPayslip.gross_pay.toFixed(2)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block">Deductions</span>
                  <span className="font-bold text-rose-600 font-mono">-₹{selectedPayslip.total_deductions.toFixed(2)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-emerald-700 block font-semibold">Net Take-Home</span>
                  <span className="font-bold text-emerald-800 font-mono">₹{selectedPayslip.net_pay.toFixed(2)}</span>
                </div>
              </div>

              {/* Evaluated Lines Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="py-2 px-3 font-mono">Seq</th>
                      <th className="py-2 px-3">Rule Name</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedPayslip.lines?.map((line) => (
                      <tr key={line.id}>
                        <td className="py-2 px-3 font-mono text-slate-400">{line.sequence}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">{line.rule_name}</td>
                        <td className="py-2 px-3 text-slate-500">{line.category}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                          ₹{line.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <a
                    href={payslipsApi.pdfUrl(selectedPayslip.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold hover:underline"
                  >
                    <Download size={13} /> PDF
                  </a>
                  <span className="text-slate-200">|</span>
                  <a
                    href={payslipsApi.csvUrl(selectedPayslip.id)}
                    className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold hover:underline"
                  >
                    <FileSpreadsheet size={13} /> CSV
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPayslip(null)}
                  className="btn-secondary text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── HR GRIEVANCE RESOLUTION CENTER MODAL ─────────────────── */}
      {resolvingPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl shadow-xl border border-slate-200 animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare size={16} className="text-rose-600" />
                HR Grievance Resolution Center
              </h2>
              <button onClick={() => setResolvingPayslip(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleResolveGrievance} className="space-y-4">
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                <p className="font-bold text-slate-900 mb-1">
                  Employee: {resolvingPayslip.employee?.full_name}
                </p>
                <p><b>Dispute Category:</b> {resolvingPayslip.grievance_category || 'Attendance / LOP'}</p>
                <p className="mt-1"><b>Remarks:</b> "{resolvingPayslip.grievance_remarks || 'Claiming 1-day unrecorded attendance on Sep 18.'}"</p>
              </div>

              <div>
                <label className="field-label">HR Decision *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResolutionAction('accept_adjust')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      resolutionAction === 'accept_adjust'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-1 ring-emerald-300'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    ✅ Accept & Adjust
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolutionAction('reject')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      resolutionAction === 'reject'
                        ? 'bg-rose-50 border-rose-300 text-rose-800 ring-1 ring-rose-300'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    ❌ Reject with Explanation
                  </button>
                </div>
              </div>

              <div>
                <label className="field-label">Audit Resolution Notes *</label>
                <textarea
                  required
                  rows={2}
                  value={resolutionNotes}
                  placeholder="e.g. Verified client site gate log for Sep 18. Removed 1-day LOP deduction and recalculated salary."
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResolvingPayslip(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs font-semibold"
                >
                  Submit Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
