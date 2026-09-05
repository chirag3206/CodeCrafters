import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { payslipsApi, employeesApi, grievancesApi } from '../services/api';
import type { Payslip, Employee } from '../types';
import {
  Receipt, Download, Eye,
  Calendar, X, AlertTriangle, MessageSquare
} from 'lucide-react';


export default function PayslipsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const filterEmpId = searchParams.get('employee_id');

  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedEmp, setSelectedEmp] = useState<string>(filterEmpId || '');

  // Breakdown Modal
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  // Step 8: Post-Payroll Grievance State
  const [disputeSlip, setDisputeSlip] = useState<Payslip | null>(null);
  const [disputeCategory, setDisputeCategory] = useState('Net Pay Discrepancy');
  const [disputeRemarks, setDisputeRemarks] = useState('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

  // HR Payroll User Resolution State
  const [resolvingSlip, setResolvingSlip] = useState<Payslip | null>(null);
  const [resolutionAction, setResolutionAction] = useState<'accept_adjust' | 'reject'>('accept_adjust');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);


  const loadData = async () => {
    try {
      setIsLoading(true);
      const [psRes, empRes] = await Promise.all([
        payslipsApi.list({
          employee_id: selectedEmp ? Number(selectedEmp) : undefined,
          status: selectedStatus || undefined,
        }),
        employeesApi.list(),
      ]);
      setPayslips(psRes.data);
      setEmployees(empRes.data);
    } catch (err) {
      console.error('Failed to load global payslips', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedEmp, selectedStatus]);

  const handlePostPayrollDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeSlip) return;
    try {
      setIsSubmittingDispute(true);
      await grievancesApi.dispute(disputeSlip.id, {
        grievance_category: disputeCategory,
        grievance_remarks: disputeRemarks,
      });
      alert(`Post-payroll grievance filed for ${disputeSlip.period_start}. The HR Payroll team will audit your pay calculation.`);
      setDisputeSlip(null);
      setDisputeRemarks('');
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit post-payroll grievance');
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  const handleResolvePostPayrollDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingSlip) return;
    try {
      setIsSubmittingResolution(true);
      await grievancesApi.resolve(resolvingSlip.id, {
        action: resolutionAction,
        resolution_notes: resolutionNotes,
      });
      alert(`Post-payroll grievance resolved (${resolutionAction === 'accept_adjust' ? 'Accepted & Adjusted' : 'Rejected'}).`);
      setResolvingSlip(null);
      setResolutionNotes('');
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to resolve grievance');
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  const canResolvePostPayroll = user?.role === 'HR_Payroll_User' || user?.role === 'HR_Payroll_Manager' || user?.role === 'Admin';


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Receipt className="text-indigo-600" size={26} />
            Global Payslips & Remuneration Audit
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Dedicated cross-period payroll register, component drilldowns, and printable PDF downloads.
          </p>
        </div>
      </div>

      {/* Filter & Export Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {user?.role !== 'Employee' && (
            <select
              value={selectedEmp}
              onChange={(e) => setSelectedEmp(e.target.value)}
              className="input-field max-w-[220px]"
            >
              <option value="">All Employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.full_name}</option>
              ))}
            </select>
          )}

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="input-field max-w-[200px]"
          >
            <option value="">All Payout Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Validated">Validated</option>
            <option value="Computed">Computed</option>
            <option value="Draft">Draft</option>
          </select>
        </div>

        {user?.role !== 'Employee' && payslips.length > 0 && (
          <button
            onClick={() => {
              const headers = "Employee,Period,Gross,Deductions,Net,Status,Verification\n";
              const rows = payslips.map(s => `"${s.employee?.full_name}","${s.period_start} - ${s.period_end}",${s.gross_pay},${s.total_deductions},${s.net_pay},${s.status},${s.verification_status}`).join("\n");
              const blob = new Blob([headers + rows], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `Global_Payslips_Audit_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
            }}
            className="btn-secondary text-xs font-semibold"
          >
            <Download size={13} />
            Export Filtered CSV ({payslips.length})
          </button>
        )}
      </div>

      {/* Payslips Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="text-center py-16 text-slate-400">Loading payslip audit register...</div>
        ) : payslips.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Receipt size={36} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">No payslips found matching your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Pay Period</th>
                  <th className="py-3.5 px-4">Gross Earnings</th>
                  <th className="py-3.5 px-4">Deductions</th>
                  <th className="py-3.5 px-4">Net Take-Home</th>
                  <th className="py-3.5 px-4">Payout Status</th>
                  <th className="py-3.5 px-4">Pre-Review</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payslips.map((slip) => (
                  <tr key={slip.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{slip.employee?.full_name || `Emp #${slip.employee_id}`}</span>
                        {slip.employee?.badge_id && (
                          <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                            {slip.employee.badge_id}
                          </span>
                        )}
                      </div>
                      <span className="block text-xs font-normal text-slate-400">{slip.employee?.job_position?.title}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        <span>{slip.period_start} → {slip.period_end}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                      ₹{slip.gross_pay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-rose-600">
                      ₹{slip.total_deductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                      ₹{slip.net_pay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          slip.status === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : slip.status === 'Validated'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {slip.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          slip.verification_status === 'Confirmed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : slip.verification_status === 'Disputed'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {slip.verification_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Step 8: Employee Report Post-Payroll Discrepancy */}
                        {user?.role === 'Employee' && slip.status === 'Paid' && (
                          <button
                            onClick={() => {
                              setDisputeSlip(slip);
                              setDisputeRemarks(slip.grievance_remarks || '');
                            }}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 hover:text-rose-700 transition-colors"
                            title="Report Post-Payroll Discrepancy"
                          >
                            <AlertTriangle size={15} />
                          </button>
                        )}

                        {/* Step 8: HR Payroll User Resolve Post-Payroll Grievance */}
                        {canResolvePostPayroll && slip.verification_status === 'Disputed' && (
                          <button
                            onClick={() => {
                              setResolvingSlip(slip);
                              setResolutionNotes(slip.grievance_resolution_notes || '');
                            }}
                            className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1 animate-pulse"
                            title="Resolve Post-Payroll Grievance"
                          >
                            <MessageSquare size={13} /> Resolve
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedPayslip(slip)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                          title="View Salary Breakdown"
                        >
                          <Eye size={15} />
                        </button>
                        <a
                          href={payslipsApi.pdfUrl(slip.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700 transition-colors"
                          title="Download Printable PDF Payslip"
                        >
                          <Download size={15} />
                        </a>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payslip Breakdown Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white max-w-lg w-full p-6 rounded-2xl shadow-xl border border-slate-200 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <span className="text-[11px] font-bold text-indigo-600 uppercase">Payslip Breakdown</span>
                <h2 className="text-base font-bold text-slate-900">
                  {selectedPayslip.employee?.full_name}
                  {selectedPayslip.employee?.badge_id && (
                    <span className="ml-2 font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                      {selectedPayslip.employee.badge_id}
                    </span>
                  )}
                  {' '}({selectedPayslip.period_start})
                </h2>
              </div>
              <button onClick={() => setSelectedPayslip(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
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

              {/* Lines table */}
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
                <a
                  href={payslipsApi.pdfUrl(selectedPayslip.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold hover:underline"
                >
                  <Download size={13} /> Download ReportLab PDF
                </a>
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

      {/* Modal: Employee Report Post-Payroll Discrepancy (Step 8) */}
      {disputeSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={20} />
                <h3 className="font-bold text-slate-900 text-sm">
                  Report Post-Payroll Discrepancy
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDisputeSlip(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePostPayrollDispute} className="space-y-4 mt-4">
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                <p className="font-semibold">
                  Payslip Period: {disputeSlip.period_start} to {disputeSlip.period_end}
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Reported Net Pay: ₹{disputeSlip.net_pay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.
                  Our HR Payroll team will audit your pay calculation against attendance logs and tax rules.
                </p>
              </div>

              <div>
                <label className="field-label">Discrepancy Category *</label>
                <select
                  value={disputeCategory}
                  onChange={(e) => setDisputeCategory(e.target.value)}
                  className="input-field text-xs font-medium"
                >
                  <option value="Net Pay Discrepancy">Net Pay Discrepancy</option>
                  <option value="Tax Deduction Error">Tax Deduction Error (TDS/New Regime)</option>
                  <option value="LOP Adjustment">LOP / Unpaid Leave Deduction Dispute</option>
                  <option value="Overtime Calculation">Overtime Calculation Error</option>
                  <option value="Missing Allowance">Missing Allowance or Bonus</option>
                  <option value="Other">Other Compensation Query</option>
                </select>
              </div>

              <div>
                <label className="field-label">Explanation &amp; Remarks *</label>
                <textarea
                  required
                  rows={3}
                  value={disputeRemarks}
                  onChange={(e) => setDisputeRemarks(e.target.value)}
                  placeholder="Describe the discrepancy clearly (e.g. 'LOP was deducted for Aug 14 despite pre-approved casual leave')..."
                  className="input-field text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDisputeSlip(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDispute}
                  className="btn-primary bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                >
                  {isSubmittingDispute ? 'Submitting Discrepancy...' : 'Submit Grievance to Payroll'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: HR Payroll User Resolve Post-Payroll Grievance (Step 8) */}
      {resolvingSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MessageSquare className="text-indigo-600" size={20} />
                <h3 className="font-bold text-slate-900 text-sm">
                  Resolve Post-Payroll Grievance
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResolvingSlip(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResolvePostPayrollDispute} className="space-y-4 mt-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-900">{resolvingSlip.employee?.full_name}</span>
                  <span className="text-slate-500 font-mono">{resolvingSlip.period_start}</span>
                </div>
                <p className="text-[11px] text-indigo-700 font-semibold">
                  Category: {resolvingSlip.grievance_category || 'Discrepancy'}
                </p>
                <p className="text-slate-600 italic bg-white p-2 rounded border border-slate-100 mt-1">
                  "{resolvingSlip.grievance_remarks || 'No remarks provided'}"
                </p>
              </div>

              <div>
                <label className="field-label">Resolution Action *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResolutionAction('accept_adjust')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                      resolutionAction === 'accept_adjust'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Accept &amp; Adjust
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolutionAction('reject')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                      resolutionAction === 'reject'
                        ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Reject Discrepancy
                  </button>
                </div>
              </div>

              <div>
                <label className="field-label">Audit / Adjustment Notes *</label>
                <textarea
                  required
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder={
                    resolutionAction === 'accept_adjust'
                      ? 'e.g. Verified casual leave on Aug 14. Retroactive adjustment credit of ₹2,272.73 queued for next payrun.'
                      : 'e.g. Checked attendance logs; unexcused absence on Aug 14 confirmed with manager. LOP is valid.'
                  }
                  className="input-field text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResolvingSlip(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingResolution}
                  className="btn-primary text-xs font-semibold"
                >
                  {isSubmittingResolution ? 'Saving Resolution...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
