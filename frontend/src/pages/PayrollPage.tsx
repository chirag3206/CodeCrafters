import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { payrunsApi, salaryConfigApi, employeesApi } from '../services/api';
import type { Payrun, SalaryStructure, Department } from '../types';
import {
  DollarSign, Plus, Calendar, AlertTriangle, ChevronRight,
  CheckCircle2, ArrowRight, X, ShieldAlert, FileText
} from 'lucide-react';

interface Candidate {
  employee_id: number;
  badge_id: string | null;
  full_name: string;
  department: string | null;
  job_position: string | null;
  contract_reference: string | null;
  contract_wage: number | null;
  contract_structure_name?: string | null;
  has_valid_contract: boolean;
  has_bank_details: boolean;
  has_duplicate_payslip: boolean;
  warnings: string[];
  verification_status?: string | null;
}

export default function PayrollPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [payruns, setPayruns] = useState<Payrun[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Two-Step Wizard State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);

  // Step 1 Form Data
  const [step1Data, setStep1Data] = useState({
    name: 'September 2026 Regular Payroll Batch',
    period_start: '2026-09-01',
    period_end: '2026-09-30',
    salary_structure_id: '',
    department_id: '',
    employee_type: 'Full-Time',
  });

  // Step 2 Candidates State
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [prRes, strRes, deptRes] = await Promise.all([
        payrunsApi.list(),
        salaryConfigApi.structures(),
        employeesApi.departments(),
      ]);
      setPayruns(prRes.data);
      setStructures(strRes.data);
      setDepartments(deptRes.data);
      if (strRes.data.length > 0 && !step1Data.salary_structure_id) {
        setStep1Data(prev => ({ ...prev, salary_structure_id: String(strRes.data[0].id) }));
      }
    } catch (err) {
      console.error('Failed to load payroll batches', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatErrorMessage = (err: any, fallback: string) => {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
    }
    if (detail && typeof detail === 'object') return JSON.stringify(detail);
    return err.message || fallback;
  };

  const handleStep1Next = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoadingCandidates(true);
      setWizardStep(2);
      const res = await payrunsApi.candidates({
        period_start: step1Data.period_start,
        period_end: step1Data.period_end,
        salary_structure_id: Number(step1Data.salary_structure_id),
        department_id: step1Data.department_id ? Number(step1Data.department_id) : undefined,
        employee_type: step1Data.employee_type || undefined,
      });
      setCandidates(res.data);
      // Default select all candidates
      setSelectedIds(res.data.map((c: Candidate) => c.employee_id));
    } catch (err: any) {
      toast.error(formatErrorMessage(err, 'Failed to load eligible candidates'));
      setWizardStep(1);
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  const handleToggleCandidate = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === candidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(candidates.map(c => c.employee_id));
    }
  };

  const handleCreateBatch = async () => {
    if (selectedIds.length === 0) {
      toast.error('Please select at least one employee for the payrun batch.');
      return;
    }
    try {
      setIsCreatingBatch(true);
      const res = await payrunsApi.createBatch({
        step1_data: {
          ...step1Data,
          salary_structure_id: Number(step1Data.salary_structure_id),
          department_id: step1Data.department_id ? Number(step1Data.department_id) : null,
        },
        selected_employee_ids: selectedIds,
      });
      toast.success('Payrun batch created and submitted for approval!');
      setIsWizardOpen(false);
      setWizardStep(1);
      // Navigate to Payrun Control Center
      navigate(`/payroll/${res.data.id}`);
    } catch (err: any) {
      toast.error(formatErrorMessage(err, 'Failed to create payrun batch'));
    } finally {
      setIsCreatingBatch(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <DollarSign className="text-indigo-600" size={26} />
            Payroll Processing Center
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Structured two-step payrun creation wizard, pre-validation anomaly flags, and batch execution control.
          </p>
        </div>

        <button
          onClick={() => {
            setIsWizardOpen(true);
            setWizardStep(1);
          }}
          className="btn-primary text-xs font-semibold"
        >
          <Plus size={16} />
          Create Payrun (Wizard)
        </button>
      </div>

      {/* Payruns List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="text-center py-16 text-slate-400">Loading payrun batches...</div>
        ) : payruns.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <DollarSign size={36} className="mx-auto text-slate-300" />
            <p className="text-base font-medium text-slate-700">No payruns created yet</p>
            <p className="text-xs text-slate-400">Click "Create Payrun (Wizard)" to launch a new payroll calculation cycle.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Payrun Reference</th>
                  <th className="py-3.5 px-4">Batch Name</th>
                  <th className="py-3.5 px-4">Period</th>
                  <th className="py-3.5 px-4">Total Net Payout</th>
                  <th className="py-3.5 px-4">Anomalies</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payruns.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/payroll/${p.id}`)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-indigo-700">
                      {p.reference}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {p.name}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Calendar size={13} className="text-slate-400" />
                        <span>{p.period_start} → {p.period_end}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      ₹{p.total_net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4">
                      {p.warnings_count > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 w-fit">
                          <AlertTriangle size={11} />
                          {p.warnings_count} Warning{p.warnings_count > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-700 flex items-center gap-1 font-medium">
                          <CheckCircle2 size={12} className="text-emerald-600" /> Clean
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          p.status === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : p.status === 'Validated'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : p.status === 'Pre_Verification'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : p.status === 'Computed'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {p.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-xs text-indigo-600 font-semibold hover:underline flex items-center justify-end gap-1">
                        Control Center <ChevronRight size={14} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── TWO-STEP PAYRUN CREATION WIZARD MODAL ────────────────── */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white max-w-2xl w-full p-6 rounded-2xl shadow-xl border border-slate-200 animate-slide-up max-h-[90vh] overflow-y-auto">
            {/* Wizard Progress Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                  Two-Step Payrun Creation Wizard
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  {wizardStep === 1 ? 'Step 1: Define Scope & Pay Period' : 'Step 2: Candidate Selection & Pre-Validation'}
                </h2>
              </div>
              <button onClick={() => setIsWizardOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-3 mb-6">
              <div className={`flex items-center gap-2 text-xs font-semibold ${wizardStep === 1 ? 'text-indigo-600' : 'text-slate-400'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${wizardStep === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  1
                </span>
                Scope & Structure
              </div>
              <div className="h-px w-8 bg-slate-200" />
              <div className={`flex items-center gap-2 text-xs font-semibold ${wizardStep === 2 ? 'text-indigo-600' : 'text-slate-400'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${wizardStep === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  2
                </span>
                Candidate Selection ({selectedIds.length} Selected)
              </div>
            </div>

            {/* STEP 1: SCOPE & PERIOD FORM */}
            {wizardStep === 1 && (
              <form onSubmit={handleStep1Next} className="space-y-4">
                <div>
                  <label className="field-label">Payrun Batch Name *</label>
                  <input
                    type="text"
                    required
                    value={step1Data.name}
                    onChange={(e) => setStep1Data({ ...step1Data, name: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Period Start Date *</label>
                    <input
                      type="date"
                      required
                      value={step1Data.period_start}
                      onChange={(e) => setStep1Data({ ...step1Data, period_start: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="field-label">Period End Date *</label>
                    <input
                      type="date"
                      required
                      value={step1Data.period_end}
                      onChange={(e) => setStep1Data({ ...step1Data, period_end: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Default Salary Structure (Fallback) *</label>
                    <select
                      required
                      value={step1Data.salary_structure_id}
                      onChange={(e) => setStep1Data({ ...step1Data, salary_structure_id: e.target.value })}
                      className="input-field"
                    >
                      {structures.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Individual contract structures take precedence; this is used as fallback.
                    </p>
                  </div>
                  <div>
                    <label className="field-label">Department Scope</label>
                    <select
                      value={step1Data.department_id}
                      onChange={(e) => setStep1Data({ ...step1Data, department_id: e.target.value })}
                      className="input-field"
                    >
                      <option value="">All Departments</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsWizardOpen(false)}
                    className="btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary text-xs font-semibold"
                  >
                    Next: Filter Candidates <ArrowRight size={14} />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: CANDIDATE SELECTION TABLE */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-2.5 text-xs text-indigo-900">
                  <CheckCircle2 size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-indigo-950">Step 2: Candidate Selection &amp; Pre-Validation</p>
                    <p className="text-indigo-800 text-[11px] mt-0.5">
                      Review all employees matching your selected scope. The system will compile attendance records, execute sequenced salary rules, and submit the batch for <b>Payroll Manager approval</b>.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pb-1">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-xs text-indigo-600 hover:underline font-semibold"
                  >
                    {selectedIds.length === candidates.length ? 'Deselect All' : 'Select All Eligible Staff'}
                  </button>
                  <span className="text-xs text-slate-500 font-medium">
                    {selectedIds.length} of {candidates.length} Staff Selected
                  </span>
                </div>

                {isLoadingCandidates ? (
                  <div className="text-center py-10 text-slate-400">Evaluating candidate eligibility & anomalies...</div>
                ) : candidates.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                    No employees found matching the selected filter criteria. Click "Back to Step 1" to adjust department or filters.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {candidates.map((c) => {
                      const isSelected = selectedIds.includes(c.employee_id);
                      return (
                        <div
                          key={c.employee_id}
                          onClick={() => handleToggleCandidate(c.employee_id)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                            isSelected
                              ? 'bg-indigo-50/50 border-indigo-200'
                              : 'bg-white border-slate-200 opacity-60'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleCandidate(c.employee_id)}
                              className="mt-1 rounded accent-indigo-600"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900 text-sm">{c.full_name}</span>
                                {c.badge_id && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                                    {c.badge_id}
                                  </span>
                                )}
                                <span className="text-xs text-slate-500">• {c.department}</span>
                                <span
                                  className={`ml-1 px-2 py-0.2 rounded-full text-[10px] font-bold border ${
                                    c.verification_status === 'Confirmed'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : c.verification_status === 'Disputed'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}
                                >
                                  {c.verification_status || 'Pending'}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                                <span>
                                  Contract: <span className="font-mono text-indigo-700 font-semibold">{c.contract_reference || 'N/A'}</span>
                                  {c.contract_wage && ` (₹${c.contract_wage.toLocaleString('en-IN', { minimumFractionDigits: 2 })}/mo)`}
                                </span>
                                <span className="text-slate-300">|</span>
                                <span className="flex items-center gap-1 font-medium text-slate-700">
                                  <FileText size={12} className="text-indigo-500" />
                                  {c.contract_structure_name ? (
                                    <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 text-[10px] font-bold">
                                      {c.contract_structure_name}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[10px]">Using Batch Default</span>
                                  )}
                                </span>
                              </div>

                              {/* Warning Anomaly Pills */}
                              {c.warnings.length > 0 && (
                                <div className="mt-1.5 space-y-1">
                                  {c.warnings.map((w, idx) => (
                                    <p key={idx} className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                                      <ShieldAlert size={11} className="shrink-0 text-amber-600" />
                                      {w}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>


                          <span className="text-xs font-mono font-semibold text-slate-800 shrink-0">
                            {c.contract_wage ? `₹${c.contract_wage.toFixed(2)}` : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="btn-secondary text-xs"
                  >
                    Back to Step 1
                  </button>
                  <button
                    type="button"
                    disabled={isCreatingBatch || selectedIds.length === 0}
                    onClick={handleCreateBatch}
                    className="btn-primary text-xs font-semibold"
                  >
                    {isCreatingBatch ? 'Computing & Forwarding to Manager...' : `Create Payrun Batch & Submit for Approval (${selectedIds.length} Staff)`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
