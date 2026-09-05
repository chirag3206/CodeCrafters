import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { employeesApi } from '../services/api';
import type { Employee } from '../types';
import {
  FileText, Clock, Calendar, BarChart3, Receipt,
  ArrowLeft, Building2, Briefcase, Mail, Phone,
  CreditCard, ShieldCheck, UserCheck, Edit3, Check
} from 'lucide-react';

export default function EmployeeDetailPage() {
  const { user } = useAuth();
  const canManageEmployees = user?.role === 'HR_Manager' || user?.role === 'Admin';
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'work' | 'personal' | 'bank' | 'hr'>('work');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});

  const loadEmployee = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const res = await employeesApi.get(Number(id));
      setEmployee(res.data);
      setEditData(res.data);
    } catch (err) {
      console.error('Failed to load employee details', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEmployee();
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    try {
      await employeesApi.update(Number(id), editData);
      setIsEditing(false);
      loadEmployee();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update employee');
    }
  };

  if (isLoading) {
    return <div className="text-center py-20 text-slate-400">Loading Employee Hub...</div>;
  }

  if (!employee) {
    return (
      <div className="bg-white p-10 text-center text-slate-500 rounded-xl border border-slate-200 shadow-xs">
        <p>Employee record not found.</p>
        <button
          onClick={() => navigate('/employees')}
          className="mt-4 btn-secondary text-xs"
        >
          Back to Directory
        </button>
      </div>
    );
  }

  const sb = employee.smart_buttons || {
    contracts: 0,
    attendances: 0,
    time_off_requests: 0,
    allocation_days: 0.0,
    payslips: 0,
  };

  return (
    <div className="space-y-6">
      {/* Top Bar with Back Button & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/employees')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium"
        >
          <ArrowLeft size={16} />
          Back to Directory
        </button>

        {canManageEmployees && (
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="btn-success text-xs font-semibold"
                >
                  <Check size={14} />
                  Save Changes
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="btn-secondary text-xs font-semibold"
              >
                <Edit3 size={14} />
                Edit Profile
              </button>
            )}
          </div>
        )}
      </div>

      {/* Hero Header + 5 Smart-Badge Buttons */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-white text-xl shadow-sm"
              style={{ backgroundColor: employee.avatar_color || '#4F46E5' }}
            >
              {employee.avatar_initials || 'EM'}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{employee.full_name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {employee.status}
                </span>
                {employee.badge_id && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                    {employee.badge_id}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {employee.job_position?.title || 'Staff'} • {employee.department?.name || 'General'}
              </p>
            </div>
          </div>
        </div>

        {/* ─── 5 INTERACTIVE SMART BUTTONS (Odoo-Style) ────────────────── */}
        <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {/* Smart Button 1: Contracts */}
          <button
            id="smart-btn-contracts"
            onClick={() => navigate(`/contracts?employee_id=${employee.id}`)}
            className="p-3.5 rounded-xl bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/80 hover:border-indigo-300 transition-all text-left group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-1.5">
              <FileText size={18} className="text-indigo-600 group-hover:scale-110 transition-transform" />
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-100 text-indigo-700">
                {sb.contracts}
              </span>
            </div>
            <span className="block text-xs font-semibold text-slate-800 group-hover:text-indigo-700">Contracts</span>
            <span className="text-[10px] text-slate-400">Terms & Base Wages</span>
          </button>

          {/* Smart Button 2: Attendance */}
          <button
            id="smart-btn-attendance"
            onClick={() => navigate(`/attendance?employee_id=${employee.id}`)}
            className="p-3.5 rounded-xl bg-slate-50 hover:bg-sky-50/50 border border-slate-200/80 hover:border-sky-300 transition-all text-left group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-1.5">
              <Clock size={18} className="text-sky-600 group-hover:scale-110 transition-transform" />
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-sky-100 text-sky-700">
                {sb.attendances}
              </span>
            </div>
            <span className="block text-xs font-semibold text-slate-800 group-hover:text-sky-700">Attendance</span>
            <span className="text-[10px] text-slate-400">Clock Logs & Overtime</span>
          </button>

          {/* Smart Button 3: Time Off Requests */}
          <button
            id="smart-btn-timeoff"
            onClick={() => navigate(`/time-off?employee_id=${employee.id}`)}
            className="p-3.5 rounded-xl bg-slate-50 hover:bg-emerald-50/50 border border-slate-200/80 hover:border-emerald-300 transition-all text-left group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-1.5">
              <Calendar size={18} className="text-emerald-600 group-hover:scale-110 transition-transform" />
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-700">
                {sb.time_off_requests}
              </span>
            </div>
            <span className="block text-xs font-semibold text-slate-800 group-hover:text-emerald-700">Time Off</span>
            <span className="text-[10px] text-slate-400">Requests & Status</span>
          </button>

          {/* Smart Button 4: Allocations Quotas */}
          <button
            id="smart-btn-allocations"
            onClick={() => navigate(`/time-off?tab=allocations&employee_id=${employee.id}`)}
            className="p-3.5 rounded-xl bg-slate-50 hover:bg-amber-50/50 border border-slate-200/80 hover:border-amber-300 transition-all text-left group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-1.5">
              <BarChart3 size={18} className="text-amber-600 group-hover:scale-110 transition-transform" />
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-700">
                {sb.allocation_days.toFixed(1)}d
              </span>
            </div>
            <span className="block text-xs font-semibold text-slate-800 group-hover:text-amber-700">Allocations</span>
            <span className="text-[10px] text-slate-400">Annual Leave Quotas</span>
          </button>

          {/* Smart Button 5: Payslips */}
          <button
            id="smart-btn-payslips"
            onClick={() => navigate(`/payslips?employee_id=${employee.id}`)}
            className="p-3.5 rounded-xl bg-slate-50 hover:bg-violet-50/50 border border-slate-200/80 hover:border-violet-300 transition-all text-left group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-1.5">
              <Receipt size={18} className="text-purple-600 group-hover:scale-110 transition-transform" />
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-purple-100 text-purple-700">
                {sb.payslips}
              </span>
            </div>
            <span className="block text-xs font-semibold text-slate-800 group-hover:text-purple-700">Payslips</span>
            <span className="text-[10px] text-slate-400">Historical Payroll</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {[
          { key: 'work', label: 'Work Information', icon: <Briefcase size={15} /> },
          { key: 'personal', label: 'Personal Information', icon: <UserCheck size={15} /> },
          { key: 'bank', label: 'Bank Credentials & IFSC', icon: <CreditCard size={15} /> },
          { key: 'hr', label: 'HR Settings & Schedule', icon: <ShieldCheck size={15} /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        {activeTab === 'work' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Work Email</label>
                <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Mail size={14} className="text-indigo-600" />
                  {employee.work_email}
                </p>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Work Phone</label>
                <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Phone size={14} className="text-indigo-600" />
                  {employee.work_phone || '+91 98765 43210'}
                </p>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Department</label>
                <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Building2 size={14} className="text-indigo-600" />
                  {employee.department?.name || 'Unassigned'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Job Position</label>
                <p className="text-sm font-semibold text-slate-900">{employee.job_position?.title || 'Staff'}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Employment Type</label>
                <p className="text-sm font-semibold text-slate-900">{employee.employment_type}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Hire Date</label>
                <p className="text-sm font-semibold text-slate-900">{employee.hire_date || '2024-01-15'}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'personal' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Gender</label>
                <p className="text-sm font-semibold text-slate-900">{employee.gender || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Date of Birth</label>
                <p className="text-sm font-semibold text-slate-900">{employee.date_of_birth || '1994-08-15'}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Residential Address</label>
                <p className="text-sm font-semibold text-slate-900">{employee.address || '402, High-Tech Towers, Indiranagar, Bengaluru, KA 560038'}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bank' && (
          <div className="space-y-4 max-w-xl">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Disbursement Bank Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.bank_name || ''}
                    onChange={(e) => setEditData({ ...editData, bank_name: e.target.value })}
                    className="input-field text-sm"
                  />
                ) : (
                  <p className="text-sm font-semibold text-slate-900">{employee.bank_name || 'HDFC Bank'}</p>
                )}
              </div>

              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Bank Account Number</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.bank_account_no || ''}
                    onChange={(e) => setEditData({ ...editData, bank_account_no: e.target.value })}
                    className="input-field text-sm font-mono"
                  />
                ) : (
                  <p className="text-sm font-semibold text-slate-900 font-mono">
                    {employee.bank_account_no ? `•••• •••• •••• ${employee.bank_account_no.slice(-4)}` : '⚠️ Missing Account Credentials'}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">IFSC Code / Branch Routing</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.ifsc_swift || ''}
                    onChange={(e) => setEditData({ ...editData, ifsc_swift: e.target.value })}
                    className="input-field text-sm font-mono uppercase"
                  />
                ) : (
                  <p className="text-sm font-semibold text-slate-900 font-mono">
                    {employee.ifsc_swift || '⚠️ Missing IFSC Code'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hr' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Working Schedule</label>
                <p className="text-sm font-semibold text-slate-900">
                  {employee.working_schedule?.name || 'Standard 40h/week (Mon-Fri 09:00-18:00)'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">8.0 net hrs/day × 5 work days = 40.0 hrs/week</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Reporting Manager</label>
                <p className="text-sm font-semibold text-slate-900">Priya Nair (HR Manager)</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">User Account Link</label>
                <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  Authenticated User ID #{employee.id}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
