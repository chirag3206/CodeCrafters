import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { contractsApi, employeesApi, salaryConfigApi } from '../services/api';
import type { Contract, Employee, SalaryStructure } from '../types';
import { FileText, Plus, Calendar, X } from 'lucide-react';

export default function ContractsPage() {
  const { user } = useAuth();
  const canManageContracts = user?.role === 'HR_Manager' || user?.role === 'Admin';
  const [searchParams] = useSearchParams();
  const filterEmpId = searchParams.get('employee_id');

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    reference: '',
    employee_id: filterEmpId ? Number(filterEmpId) : '',
    salary_structure_id: '',
    working_schedule_id: '',
    wage: '',
    start_date: '2026-01-01',
    end_date: '',
    notes: '',
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [cntRes, empRes, strRes] = await Promise.all([
        contractsApi.list({ employee_id: filterEmpId ? Number(filterEmpId) : undefined }),
        employeesApi.list(),
        salaryConfigApi.structures(),
      ]);
      setContracts(cntRes.data);
      setEmployees(empRes.data);
      setStructures(strRes.data);
    } catch (err) {
      console.error('Failed to load contracts', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterEmpId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await contractsApi.create({
        ...formData,
        employee_id: Number(formData.employee_id),
        salary_structure_id: formData.salary_structure_id ? Number(formData.salary_structure_id) : null,
        working_schedule_id: formData.working_schedule_id ? Number(formData.working_schedule_id) : null,
        wage: Number(formData.wage),
        end_date: formData.end_date || null,
      });
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create contract');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <FileText className="text-indigo-600" size={26} />
            Contract Management
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Date-based contract validity matching, historical compensation terms, and wage binding.
          </p>
        </div>

        {canManageContracts && (
          <button
            id="btn-new-contract"
            onClick={() => setIsModalOpen(true)}
            className="btn-primary text-xs font-semibold"
          >
            <Plus size={16} />
            New Contract
          </button>
        )}
      </div>

      {filterEmpId && (
        <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between text-xs text-indigo-700">
          <span>Filtering contracts for Employee #{filterEmpId}</span>
          <a href="/contracts" className="font-semibold underline hover:text-indigo-900">Clear Filter</a>
        </div>
      )}

      {/* Contracts Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="text-center py-16 text-slate-400">Loading contracts...</div>
        ) : contracts.length === 0 ? (
          <div className="p-10 text-center text-slate-500">No contracts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Reference</th>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Base Wage</th>
                  <th className="py-3.5 px-4">Validity Period</th>
                  <th className="py-3.5 px-4">Salary Structure</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-indigo-700">
                      {c.reference}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900">{c.employee?.full_name || `Emp #${c.employee_id}`}</p>
                      <p className="text-xs text-slate-400">{c.employee?.department?.name}</p>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-700 font-mono">
                      ₹{c.wage.toLocaleString('en-IN', { minimumFractionDigits: 2 })}/mo
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        <span>{c.start_date} → {c.end_date || 'Indefinite'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 font-medium">
                      {c.salary_structure?.name || 'Standard Regular Structure'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          c.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : c.status === 'Expired'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Contract Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white max-w-lg w-full p-6 rounded-2xl shadow-xl border border-slate-200 animate-slide-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <h2 className="text-lg font-bold text-slate-900">Create Employment Contract</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="field-label">Contract Reference *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CNT-2026-AARAV-01"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="input-field font-mono"
                />
              </div>

              <div>
                <label className="field-label">Employee *</label>
                <select
                  required
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select Employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.full_name} ({e.work_email})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Monthly Base Wage (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="65000.00"
                    value={formData.wage}
                    onChange={(e) => setFormData({ ...formData, wage: e.target.value })}
                    className="input-field font-mono"
                  />
                </div>
                <div>
                  <label className="field-label">Salary Structure</label>
                  <select
                    value={formData.salary_structure_id}
                    onChange={(e) => setFormData({ ...formData, salary_structure_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Default Structure</option>
                    {structures.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="field-label">End Date (Blank = Indefinite)</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="input-field"
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
                  Create Contract
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
