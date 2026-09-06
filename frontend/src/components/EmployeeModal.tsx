import React, { useState, useEffect } from 'react';
import { X, UserPlus, Save, AlertCircle, KeyRound, Eye, EyeOff, Copy, CheckCircle2, Calendar } from 'lucide-react';
import { employeesApi, leavesApi } from '../services/api';
import type { TimeOffType } from '../types';

interface Department {
  id: number;
  name: string;
}

interface JobPosition {
  id: number;
  title: string;
}

interface WorkingSchedule {
  id: number;
  name: string;
}

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employeeToEdit?: any | null;
}

export default function EmployeeModal({ isOpen, onClose, onSuccess, employeeToEdit }: EmployeeModalProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [schedules, setSchedules] = useState<WorkingSchedule[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<TimeOffType[]>([]);
  const [leaveAllocations, setLeaveAllocations] = useState<{ [key: number]: number }>({});
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);
  const [showCreatedPass, setShowCreatedPass] = useState(false);

  const [formData, setFormData] = useState({
    badge_id: '',
    first_name: '',
    last_name: '',
    work_email: '',
    work_phone: '',
    gender: 'Male',
    hire_date: new Date().toISOString().split('T')[0],
    status: 'Active',
    department_id: '',
    job_position_id: '',
    manager_id: '',
    working_schedule_id: '',
    employment_type: 'Full-Time',
    system_role: 'Employee',
    contract_wage: '',
    bank_name: '',
    bank_account_no: '',
    ifsc_swift: '',
    // New auth fields (create only)
    initial_password: '',
  });
  const [showInitialPass, setShowInitialPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanBadge = (badge?: string | null) => {
    if (!badge) return '';
    return badge.replace(/^EMP\s*-?\s*/i, '').trim();
  };

  useEffect(() => {
    if (!isOpen) return;

    // Load reference lists & leave types
    const loadRefs = async () => {
      try {
        const [deptRes, posRes, schedRes, empRes, typesRes] = await Promise.all([
          employeesApi.departments(),
          employeesApi.jobPositions(),
          employeesApi.workingSchedules(),
          employeesApi.list({ limit: 100 }),
          leavesApi.types(),
        ]);
        setDepartments(deptRes.data);
        setJobPositions(posRes.data);
        setSchedules(schedRes.data);
        setManagers(empRes.data);
        const types: TimeOffType[] = typesRes.data || [];
        setLeaveTypes(types);

        if (employeeToEdit) {
          try {
            const allocRes = await leavesApi.allocations(employeeToEdit.id);
            const allocMap: { [key: number]: number } = {};
            (allocRes.data || []).forEach((alloc: any) => {
              allocMap[alloc.leave_type_id] = alloc.allocated_days;
            });
            // Ensure all leave types exist in map
            types.forEach(t => {
              if (allocMap[t.id] === undefined) {
                allocMap[t.id] = t.max_days_per_year ?? 10;
              }
            });
            setLeaveAllocations(allocMap);
          } catch {
            const allocMap: { [key: number]: number } = {};
            types.forEach(t => { allocMap[t.id] = t.max_days_per_year ?? 10; });
            setLeaveAllocations(allocMap);
          }
        } else {
          const allocMap: { [key: number]: number } = {};
          types.forEach(t => {
            if (t.max_days_per_year != null) {
              allocMap[t.id] = t.max_days_per_year;
            } else {
              const nameLower = t.name.toLowerCase();
              allocMap[t.id] = nameLower.includes('annual') ? 12 : nameLower.includes('sick') ? 10 : nameLower.includes('casual') ? 6 : 10;
            }
          });
          setLeaveAllocations(allocMap);
        }
      } catch (err) {
        console.error('Failed to load reference data', err);
      }
    };
    loadRefs();

    if (employeeToEdit) {
      setFormData({
        badge_id: cleanBadge(employeeToEdit.badge_id),
        first_name: employeeToEdit.first_name || '',
        last_name: employeeToEdit.last_name || '',
        work_email: employeeToEdit.work_email || '',
        work_phone: employeeToEdit.work_phone || '',
        gender: employeeToEdit.gender || 'Male',
        hire_date: employeeToEdit.hire_date || new Date().toISOString().split('T')[0],
        status: employeeToEdit.status || 'Active',
        department_id: employeeToEdit.department_id ? String(employeeToEdit.department_id) : '',
        job_position_id: employeeToEdit.job_position_id ? String(employeeToEdit.job_position_id) : '',
        manager_id: employeeToEdit.manager_id ? String(employeeToEdit.manager_id) : '',
        working_schedule_id: employeeToEdit.working_schedule_id ? String(employeeToEdit.working_schedule_id) : '',
        employment_type: employeeToEdit.employment_type || 'Full-Time',
        system_role: employeeToEdit.system_role || 'Employee',
        contract_wage: '',
        bank_name: employeeToEdit.bank_name || '',
        bank_account_no: employeeToEdit.bank_account_no || '',
        ifsc_swift: employeeToEdit.ifsc_swift || '',
        initial_password: '',
      });
    } else {
      setFormData({
        badge_id: '',
        first_name: '',
        last_name: '',
        work_email: '',
        work_phone: '',
        gender: 'Male',
        hire_date: new Date().toISOString().split('T')[0],
        status: 'Active',
        department_id: '',
        job_position_id: '',
        manager_id: '',
        working_schedule_id: '',
        employment_type: 'Full-Time',
        system_role: 'Employee',
        contract_wage: '55000',
        bank_name: '',
        bank_account_no: '',
        ifsc_swift: '',
        initial_password: '',
      });
    }
    setError(null);
    setCreatedCredentials(null);
  }, [isOpen, employeeToEdit]);

  // Credentials success modal
  if (createdCredentials) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-br from-emerald-600 to-teal-600 p-5 text-white text-center">
            <CheckCircle2 size={36} className="mx-auto mb-2" />
            <h3 className="font-bold text-lg">Employee Created!</h3>
            <p className="text-emerald-100 text-sm">Login credentials have been set up</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Work Email (Login)</p>
                <p className="font-mono text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2">{createdCredentials.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Temporary Password</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 flex-1">
                    {showCreatedPass ? createdCredentials.password : '••••••••••••'}
                  </p>
                  <button onClick={() => setShowCreatedPass(v => !v)} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 transition-colors">
                    {showCreatedPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdCredentials.password);
                      setCopiedPass(true);
                      setTimeout(() => setCopiedPass(false), 2000);
                    }}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition-colors"
                  >
                    {copiedPass ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              ⚠️ <strong>Save this password now.</strong> It won't be shown again. The employee should change it on first login.
            </div>
            <button
              onClick={() => { setCreatedCredentials(null); onSuccess(); onClose(); }}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name || !formData.work_email) {
      setError('First name, last name, and work email are required.');
      return;
    }

    setLoading(true);
    setError(null);

    const finalBadgeId = formData.badge_id.trim()
      ? `EMP-${formData.badge_id.trim().toUpperCase()}`
      : null;

    const payload: any = {
      ...formData,
      badge_id: finalBadgeId,
      department_id: formData.department_id ? Number(formData.department_id) : null,
      job_position_id: formData.job_position_id ? Number(formData.job_position_id) : null,
      manager_id: formData.manager_id ? Number(formData.manager_id) : null,
      working_schedule_id: formData.working_schedule_id ? Number(formData.working_schedule_id) : null,
      initial_password: formData.initial_password.trim() || null,
      leave_allocations: Object.entries(leaveAllocations).map(([typeId, days]) => ({
        leave_type_id: Number(typeId),
        allocated_days: Number(days) || 0,
      })),
    };

    try {
      if (employeeToEdit) {
        await employeesApi.update(employeeToEdit.id, payload);
        onSuccess();
        onClose();
      } else {
        const res = await employeesApi.create(payload);
        // Show temp-password modal (show-once)
        const tempPass = res.data?.temp_password;
        if (tempPass) {
          setCreatedCredentials({ email: payload.work_email, password: tempPass });
        } else {
          onSuccess();
          onClose();
        }
      }
    } catch (err: any) {
      let msg = 'Failed to save employee. Please try again.';
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail)) {
        msg = detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2 text-indigo-600">
            <UserPlus size={20} />
            <h3 className="font-bold text-slate-900">
              {employeeToEdit ? 'Edit Employee Profile' : 'Add New Employee'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Personal Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Personal Information</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="field-label">Employee ID (Badge ID)</label>
                <div className="flex rounded-lg border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-600 bg-white">
                  <span className="inline-flex items-center px-3 text-xs font-mono font-bold text-slate-600 bg-slate-100 border-r border-slate-200 select-none">
                    EMP-
                  </span>
                  <input
                    type="text"
                    value={formData.badge_id}
                    onChange={(e) => {
                      const val = e.target.value.replace(/^EMP\s*-?\s*/i, '').replace(/\s+/g, '').toUpperCase();
                      setFormData({ ...formData, badge_id: val });
                    }}
                    placeholder="014 (Auto if blank)"
                    className="w-full px-3 py-2 text-slate-900 placeholder-slate-400 text-xs font-mono focus:outline-none bg-transparent"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">"EMP-" is fixed. Enter number only, or leave blank to auto-generate.</p>
              </div>
              <div>
                <label className="field-label">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="e.g. Sarah"
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="field-label">Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="e.g. Jenkins"
                  className="input-field text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="field-label">Work Email *</label>
                <input
                  type="email"
                  required
                  value={formData.work_email}
                  onChange={(e) => setFormData({ ...formData, work_email: e.target.value })}
                  placeholder="sarah@company.com"
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="field-label">Work Phone</label>
                <input
                  type="text"
                  value={formData.work_phone}
                  onChange={(e) => setFormData({ ...formData, work_phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="field-label">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="input-field text-xs"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>
          </div>

          {/* Job & Org */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Organization & Role</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label">Department *</label>
                <select
                  required
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="input-field text-xs"
                >
                  <option value="">Select Department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Position / Job Title *</label>
                <select
                  required
                  value={formData.job_position_id}
                  onChange={(e) => setFormData({ ...formData, job_position_id: e.target.value })}
                  className="input-field text-xs"
                >
                  <option value="">Select Job Position...</option>
                  {jobPositions.map((j) => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="field-label">Joining Date *</label>
                <input
                  type="date"
                  required
                  value={formData.hire_date}
                  onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="field-label">Employment Status *</label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="input-field text-xs"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="On Leave">On Leave</option>
                </select>
              </div>
              <div>
                <label className="field-label">Employee Type *</label>
                <select
                  required
                  value={formData.employment_type}
                  onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                  className="input-field text-xs"
                >
                  <option value="Full-Time">Full-Time</option>
                  <option value="Part-Time">Part-Time</option>
                  <option value="Contractor">Contractor</option>
                  <option value="Intern">Intern</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="field-label font-semibold text-indigo-700">System Account Role *</label>
                <select
                  required
                  value={formData.system_role}
                  onChange={(e) => setFormData({ ...formData, system_role: e.target.value })}
                  className="input-field text-xs font-semibold border-indigo-200 bg-indigo-50/50"
                >
                  <option value="Employee">Employee (Standard Portal)</option>
                  <option value="HR_Manager">HR Manager (Leave & Staff Admin)</option>
                  <option value="HR_Payroll_User">HR Payroll Specialist</option>
                  <option value="HR_Payroll_Manager">HR Payroll Manager</option>
                  <option value="Admin">Admin (Full System Control)</option>
                </select>
              </div>
              <div>
                <label className="field-label">Working Schedule</label>
                <select
                  value={formData.working_schedule_id}
                  onChange={(e) => setFormData({ ...formData, working_schedule_id: e.target.value })}
                  className="input-field text-xs"
                >
                  <option value="">Select Schedule...</option>
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Reports To (Manager)</label>
                <select
                  value={formData.manager_id}
                  onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                  className="input-field text-xs"
                >
                  <option value="">No Direct Manager</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.full_name} ({m.work_email})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Banking Details */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Banking & Payroll Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="field-label">Bank Name</label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="e.g. HDFC Bank"
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="field-label">Account No</label>
                <input
                  type="text"
                  value={formData.bank_account_no}
                  onChange={(e) => setFormData({ ...formData, bank_account_no: e.target.value })}
                  placeholder="9876543210"
                  className="input-field font-mono text-xs"
                />
              </div>
              <div>
                <label className="field-label">IFSC / SWIFT</label>
                <input
                  type="text"
                  value={formData.ifsc_swift}
                  onChange={(e) => setFormData({ ...formData, ifsc_swift: e.target.value.toUpperCase() })}
                  placeholder="HDFC0001234"
                  className="input-field font-mono text-xs uppercase"
                />
              </div>
            </div>
          </div>

          {/* Annual Leave Allocations Section */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-emerald-600" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Annual Leave Quotas (Calendar Year {new Date().getFullYear()})
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Max Days / Year</span>
            </div>

            <p className="text-xs text-slate-500">
              Specify the maximum number of leaves that can be allocated to this employee for each leave type in the current calendar year.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              {leaveTypes.length === 0 ? (
                <div className="text-xs text-slate-400 col-span-2 py-2 text-center">Loading leave types...</div>
              ) : (
                leaveTypes.map((lt) => (
                  <div key={lt.id} className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: lt.color || '#4F46E5' }}
                      />
                      <div className="truncate">
                        <span className="text-xs font-semibold text-slate-800 block truncate">{lt.name}</span>
                        <span className="text-[10px] text-slate-400">{lt.is_paid ? 'Paid Leave' : 'Unpaid LOP'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min="0"
                        max="365"
                        step="0.5"
                        value={leaveAllocations[lt.id] ?? 0}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setLeaveAllocations((prev) => ({ ...prev, [lt.id]: val }));
                        }}
                        className="w-20 px-2 py-1 text-xs font-mono text-center font-bold text-slate-900 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <span className="text-[11px] font-medium text-slate-500">Days</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Account Setup Section (create only) */}
          {!employeeToEdit && (
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <KeyRound size={15} className="text-indigo-500" />
                <h4 className="text-sm font-semibold text-slate-800">Login Account Setup</h4>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                <p className="text-xs text-indigo-700">
                  A login account will be created automatically using the work email above.
                  Set a temporary password below (or leave blank to auto-generate one).
                </p>
                <div>
                  <label className="field-label">Temporary Password</label>
                  <div className="relative">
                    <input
                      type={showInitialPass ? 'text' : 'password'}
                      value={formData.initial_password}
                      onChange={e => setFormData({ ...formData, initial_password: e.target.value })}
                      placeholder="Leave blank to auto-generate"
                      className="input-field pr-24 font-mono text-xs placeholder:font-sans"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
                          const pwd = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                          setFormData({ ...formData, initial_password: pwd });
                          setShowInitialPass(true);
                        }}
                        className="text-[10px] font-semibold text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-300 hover:bg-indigo-100 transition-colors"
                      >
                        GEN
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowInitialPass(v => !v)}
                        className="text-slate-400 hover:text-slate-600 p-0.5"
                        tabIndex={-1}
                      >
                        {showInitialPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <Save size={15} />
              <span>{loading ? 'Saving...' : employeeToEdit ? 'Update Employee' : 'Save Employee'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
