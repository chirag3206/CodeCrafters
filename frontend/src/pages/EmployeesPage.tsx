import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { employeesApi } from '../services/api';
import type { Employee, Department, JobPosition } from '../types';
import {
  Users, LayoutGrid, List as ListIcon, Plus, Search,
  Building2, Mail, ChevronRight, X
} from 'lucide-react';

export default function EmployeesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManageEmployees = user?.role === 'HR_Manager' || user?.role === 'Admin';
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<number | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    work_email: '',
    work_phone: '',
    department_id: '',
    job_position_id: '',
    employment_type: 'Full-Time',
    bank_name: '',
    bank_account_no: '',
    ifsc_swift: '',
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [empRes, deptRes, posRes] = await Promise.all([
        employeesApi.list({
          q: searchQuery || undefined,
          department_id: selectedDept ? Number(selectedDept) : undefined,
          status: selectedStatus || undefined,
        }),
        employeesApi.departments(),
        employeesApi.jobPositions(),
      ]);
      setEmployees(empRes.data);
      setDepartments(deptRes.data);
      setJobPositions(posRes.data);
    } catch (err) {
      console.error('Failed to load employees', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchQuery, selectedDept, selectedStatus]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await employeesApi.create({
        ...formData,
        department_id: formData.department_id ? Number(formData.department_id) : null,
        job_position_id: formData.job_position_id ? Number(formData.job_position_id) : null,
      });
      setIsModalOpen(false);
      setFormData({
        first_name: '',
        last_name: '',
        work_email: '',
        work_phone: '',
        department_id: '',
        job_position_id: '',
        employment_type: 'Full-Time',
        bank_name: '',
        bank_account_no: '',
        ifsc_swift: '',
      });
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create employee');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Users className="text-indigo-600" size={26} />
            Employee Master Directory
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Centralized profile repository, employment terms, and smart operational counters.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'kanban' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Kanban Cards"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'list' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Table List"
            >
              <ListIcon size={16} />
            </button>
          </div>

          {canManageEmployees && (
            <button
              id="btn-new-employee"
              onClick={() => setIsModalOpen(true)}
              className="btn-primary text-xs font-semibold"
            >
              <Plus size={16} />
              New Employee
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value ? Number(e.target.value) : '')}
          className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="On Leave">On Leave</option>
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400">Loading directory...</div>
      ) : employees.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-400 rounded-xl border border-slate-200 shadow-xs">
          <Users size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-lg font-medium text-slate-700">No employees found</p>
          <p className="text-xs text-slate-500 mt-1">Try refining your search filters or add a new staff member.</p>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <div
              key={emp.id}
              onClick={() => navigate(`/employees/${emp.id}`)}
              className="bg-white p-5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all duration-200 group flex flex-col justify-between space-y-4 shadow-xs"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white shadow-xs"
                    style={{ backgroundColor: emp.avatar_color || '#4F46E5' }}
                  >
                    {emp.avatar_initials || 'EM'}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {emp.full_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-slate-500">{emp.job_position?.title || 'Staff Member'}</p>
                      {emp.badge_id && (
                        <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                          {emp.badge_id}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {emp.status}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Building2 size={13} className="text-slate-400 shrink-0" />
                  <span>{emp.department?.name || 'Unassigned Dept'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={13} className="text-slate-400 shrink-0" />
                  <span className="truncate">{emp.work_email}</span>
                </div>
              </div>

              {/* 5 Smart Buttons Mini Strip */}
              <div className="pt-3 border-t border-slate-100 grid grid-cols-5 gap-1 text-center text-[10px]">
                <div className="p-1 rounded bg-slate-50 border border-slate-100">
                  <span className="block font-bold text-slate-800">{emp.smart_buttons?.contracts ?? 0}</span>
                  <span className="text-slate-400">Cnt</span>
                </div>
                <div className="p-1 rounded bg-slate-50 border border-slate-100">
                  <span className="block font-bold text-slate-800">{emp.smart_buttons?.attendances ?? 0}</span>
                  <span className="text-slate-400">Att</span>
                </div>
                <div className="p-1 rounded bg-slate-50 border border-slate-100">
                  <span className="block font-bold text-slate-800">{emp.smart_buttons?.time_off_requests ?? 0}</span>
                  <span className="text-slate-400">Off</span>
                </div>
                <div className="p-1 rounded bg-slate-50 border border-slate-100">
                  <span className="block font-bold text-slate-800">{emp.smart_buttons?.allocation_days ?? 0}d</span>
                  <span className="text-slate-400">Aloc</span>
                </div>
                <div className="p-1 rounded bg-slate-50 border border-slate-100">
                  <span className="block font-bold text-slate-800">{emp.smart_buttons?.payslips ?? 0}</span>
                  <span className="text-slate-400">Slips</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">ID</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Job Position</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr
                    key={emp.id}
                    onClick={() => navigate(`/employees/${emp.id}`)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs"
                          style={{ backgroundColor: emp.avatar_color || '#4F46E5' }}
                        >
                          {emp.avatar_initials || 'EM'}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{emp.full_name}</p>
                          <p className="text-xs text-slate-400">{emp.work_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {emp.badge_id || `EMP-${String(emp.id).padStart(3, '0')}`}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{emp.department?.name || '—'}</td>
                    <td className="py-3 px-4 text-slate-700">{emp.job_position?.title || '—'}</td>
                    <td className="py-3 px-4 text-slate-500 text-xs">{emp.employment_type}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {emp.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <ChevronRight size={16} className="inline text-slate-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white max-w-lg w-full p-6 rounded-2xl shadow-xl border border-slate-200 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <h2 className="text-lg font-bold text-slate-900">Add New Employee</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">First Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikram"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="field-label">Last Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Singhania"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Work Email *</label>
                <input
                  type="email"
                  required
                  placeholder="vikram.s@peoplepay360.com"
                  value={formData.work_email}
                  onChange={(e) => setFormData({ ...formData, work_email: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Department</label>
                  <select
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Job Position</label>
                  <select
                    value={formData.job_position_id}
                    onChange={(e) => setFormData({ ...formData, job_position_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Select Position</option>
                    {jobPositions.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Indian Bank Account Details</h4>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Bank (e.g. HDFC)"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    className="input-field text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Account Number"
                    value={formData.bank_account_no}
                    onChange={(e) => setFormData({ ...formData, bank_account_no: e.target.value })}
                    className="input-field text-xs font-mono"
                  />
                  <input
                    type="text"
                    placeholder="IFSC Code"
                    value={formData.ifsc_swift}
                    onChange={(e) => setFormData({ ...formData, ifsc_swift: e.target.value })}
                    className="input-field text-xs font-mono uppercase"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs font-semibold"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
