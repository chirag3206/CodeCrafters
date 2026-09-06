import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { employeesApi } from '../services/api';
import type { Employee, Department } from '../types';
import EmployeeModal from '../components/EmployeeModal';
import {
  Users, LayoutGrid, List as ListIcon, Plus, Search,
  Building2, Mail, Edit3, Trash2, AlertTriangle
} from 'lucide-react';

export default function EmployeesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManageEmployees = user?.role === 'HR_Manager' || user?.role === 'Admin';
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<number | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('Active');
  const [sortBy, setSortBy] = useState<'newest' | 'name'>('newest');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [deletingEmpId, setDeletingEmpId] = useState<number | null>(null);
  const [offboardReason, setOffboardReason] = useState<string>('Resigned');
  const [offboardNotes, setOffboardNotes] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [empRes, deptRes] = await Promise.all([
        employeesApi.list({
          q: searchQuery || undefined,
          department_id: selectedDept ? Number(selectedDept) : undefined,
          status: selectedStatus || undefined,
        }),
        employeesApi.departments(),
      ]);
      setEmployees(empRes.data);
      setDepartments(deptRes.data);
    } catch (err) {
      console.error('Failed to load employees', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchQuery, selectedDept, selectedStatus]);

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEmployee(emp);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (empId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeletingEmpId(empId);
    setOffboardReason('Resigned');
    setOffboardNotes('');
  };

  const handleConfirmDelete = async () => {
    if (!deletingEmpId) return;
    try {
      setIsDeleting(true);
      await employeesApi.offboard(deletingEmpId, {
        reason: offboardReason,
        notes: offboardNotes.trim() || undefined,
      });
      toast.success('Employee offboarded successfully.');
      setDeletingEmpId(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to offboard employee');
    } finally {
      setIsDeleting(false);
    }
  };

  const displayedEmployees = [...employees].sort((a, b) => {
    if (sortBy === 'newest') return b.id - a.id;
    return a.full_name.localeCompare(b.full_name);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Users className="text-indigo-600" size={26} />
            Employee Directory
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {employees.length} {employees.length === 1 ? 'Employee' : 'Employees'}
            </span>
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Manage employee profiles, roles, organization hierarchy, and bank details.
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
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 text-white font-medium text-xs shadow-glow transition-all duration-200"
            >
              <Plus size={16} />
              Add Employee
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
            placeholder="Search by name, email, or badge ID (e.g. EMP-013)..."
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
          <option value="Retired">Retired</option>
          <option value="Terminated">Terminated</option>
          <option value="Left Job">Left Job</option>
          <option value="Resigned">Resigned</option>
          <option value="On Leave">On Leave</option>
          <option value="Inactive">Inactive</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'newest' | 'name')}
          className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
        >
          <option value="newest">Sort: Newest First</option>
          <option value="name">Sort: Name (A–Z)</option>
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400">Loading directory...</div>
      ) : displayedEmployees.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-400 rounded-xl border border-slate-200 shadow-xs">
          <Users size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-lg font-medium text-slate-700">No employees found</p>
          <p className="text-xs text-slate-500 mt-1">Try refining your search filters or add a new staff member.</p>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedEmployees.map((emp) => (
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
                      {emp.system_role && emp.system_role !== 'Employee' && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          {emp.system_role.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                    emp.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : emp.status === 'Retired'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : emp.status === 'Terminated'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : emp.status === 'Left Job' || emp.status === 'Resigned'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {emp.status}
                  </span>
                  {canManageEmployees && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleOpenEdit(emp, e)}
                        title="Edit Employee"
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-indigo-600"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={(e) => handleOpenDelete(emp.id, e)}
                        title="Offboard / Remove Employee"
                        className="p-1 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
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
                {displayedEmployees.map((emp) => (
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
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                        emp.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : emp.status === 'Retired'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : emp.status === 'Terminated'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : emp.status === 'Left Job' || emp.status === 'Resigned'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {canManageEmployees && (
                          <>
                            <button
                              onClick={(e) => handleOpenEdit(emp, e)}
                              className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Edit"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={(e) => handleOpenDelete(emp.id, e)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Offboard / Remove"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Employee Modal */}
      <EmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
        employeeToEdit={editingEmployee}
      />

      {/* Delete / Offboard Employee Modal */}
      {deletingEmpId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Offboard / Remove Employee</h3>
                <p className="text-xs text-slate-500">Record employee exit and automatically conclude contracts.</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
              <p className="font-semibold">⚠️ Automatic Actions on Confirmation:</p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-700 text-[11px]">
                <li>Employee status will be updated to selected departure state</li>
                <li>All <b>active and draft contracts</b> will automatically move to <b>Expired</b> (end date set to today)</li>
                <li>All unused <b>Earned Leaves (EL / Paid Leaves)</b> will be counted and <b>encashed</b> into the final salary settlement</li>
                <li>User portal login will be disabled; payroll history remains preserved</li>
              </ul>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Departure Reason *
                </label>
                <select
                  value={offboardReason}
                  onChange={(e) => setOffboardReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Resigned">Resigned</option>
                  <option value="Retired">Retired</option>
                  <option value="Terminated">Terminated</option>
                  <option value="Left Job">Left Job</option>
                  <option value="Contract Ended">Contract Ended</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Departure Notes / Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={offboardNotes}
                  onChange={(e) => setOffboardNotes(e.target.value)}
                  placeholder="e.g. Completed exit interview, handed over laptop and credentials..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setDeletingEmpId(null)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="btn-danger text-xs font-semibold"
              >
                {isDeleting ? 'Offboarding...' : 'Confirm Offboard & Expire Contracts'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
