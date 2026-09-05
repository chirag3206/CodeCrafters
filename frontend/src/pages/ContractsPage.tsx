import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { contractsApi, employeesApi, salaryConfigApi } from '../services/api';
import type { Contract, Employee, SalaryStructure, Department, JobPosition, WorkingSchedule } from '../types';
import { FileText, Plus, Calendar, X, AlertCircle, Edit3, Trash2, Search } from 'lucide-react';

export default function ContractsPage() {
  const { user } = useAuth();
  // Contract Creation can be initiated by HR_Manager, HR_Payroll_Manager, Admin
  const canCreateContracts = user?.role === 'HR_Manager' || user?.role === 'HR_Payroll_Manager' || user?.role === 'Admin';
  // Contract Edit and Deletion strictly restricted to Payroll Manager and Admin only
  const canManageContractTerms = user?.role === 'HR_Payroll_Manager' || user?.role === 'Admin';
  const [searchParams] = useSearchParams();
  const filterEmpId = searchParams.get('employee_id');

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [schedules, setSchedules] = useState<WorkingSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<number | ''>('');
  const [selectedStructureFilter, setSelectedStructureFilter] = useState<number | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Modals & Actions
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [deletingContractId, setDeletingContractId] = useState<number | null>(null);
  const [isTerminating, setIsTerminating] = useState(false);
  const [contractSeq, setContractSeq] = useState('001');
  const [formData, setFormData] = useState({
    reference: '',
    name: '',
    employee_id: filterEmpId ? Number(filterEmpId) : '',
    contract_type: 'Permanent',
    department_id: '',
    job_position_id: '',
    working_schedule_id: '',
    salary_structure_id: '',
    wage: '',
    payment_frequency: 'Monthly',
    start_date: '2026-01-01',
    end_date: '',
    status: 'Active',
    notes: '',
  });

  const getEmployeeBadge = (emp?: Employee | null) => {
    if (!emp) return '';
    return emp.badge_id || `EMP-${String(emp.id).padStart(3, '0')}`;
  };

  const selectedEmp = employees.find((e) => e.id === Number(formData.employee_id));
  const selectedEmpBadge = getEmployeeBadge(selectedEmp);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [cntRes, empRes, strRes, deptRes, posRes, schedRes] = await Promise.all([
        contractsApi.list({
          employee_id: filterEmpId ? Number(filterEmpId) : undefined,
          q: searchQuery || undefined,
          department_id: selectedDept ? Number(selectedDept) : undefined,
          salary_structure_id: selectedStructureFilter ? Number(selectedStructureFilter) : undefined,
          status: selectedStatus || undefined,
        }),
        employeesApi.list({ limit: 100 }),
        salaryConfigApi.structures(),
        employeesApi.departments(),
        employeesApi.jobPositions(),
        employeesApi.workingSchedules(),
      ]);
      setContracts(cntRes.data);
      setEmployees(empRes.data);
      setStructures(strRes.data);
      setDepartments(deptRes.data);
      setJobPositions(posRes.data);
      setSchedules(schedRes.data);
    } catch (err) {
      console.error('Failed to load contracts', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterEmpId, searchQuery, selectedDept, selectedStructureFilter, selectedStatus]);

  // Salary structure allowance customization states
  const [hraEnabled, setHraEnabled] = useState(true);
  const [hraPercent, setHraPercent] = useState(40);
  const [conveyanceEnabled, setConveyanceEnabled] = useState(true);
  const [conveyanceAmount, setConveyanceAmount] = useState(2000);
  const [specialEnabled, setSpecialEnabled] = useState(false);
  const [specialPercent, setSpecialPercent] = useState(15);
  const [pfEnabled, setPfEnabled] = useState(true);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxPercent, setTaxPercent] = useState(10);
  const [isCustomized, setIsCustomized] = useState(false);

  const selectedStructure = structures.find((s) => s.id === Number(formData.salary_structure_id));

  // Live Compensation Calculation
  const numericWage = Number(formData.wage) || 0;
  const hraAmount = hraEnabled ? (numericWage * (hraPercent / 100)) : 0;
  const conveyanceVal = conveyanceEnabled ? conveyanceAmount : 0;
  const specialAmount = specialEnabled ? (numericWage * (specialPercent / 100)) : 0;
  const totalAllowances = hraAmount + conveyanceVal + specialAmount;
  const computedGross = numericWage + totalAllowances;
  const pfAmount = pfEnabled ? (numericWage * 0.12) : 0;
  const taxAmount = (taxEnabled && taxPercent > 0) ? (computedGross * (taxPercent / 100)) : 0;
  const computedDeductions = pfAmount + taxAmount;
  const computedNet = Math.max(0, computedGross - computedDeductions);

  const handleStructureChange = (structIdStr: string) => {
    const structId = Number(structIdStr);
    const struct = structures.find((s) => s.id === structId);
    setFormData((prev) => ({ ...prev, salary_structure_id: structIdStr }));
    setIsCustomized(false);

    if (!struct) return;

    if (struct.code === 'EXECUTIVE_LEADERSHIP') {
      setHraEnabled(true);
      setHraPercent(50);
      setSpecialEnabled(true);
      setSpecialPercent(25);
      setConveyanceEnabled(true);
      setConveyanceAmount(5000);
      setPfEnabled(true);
      setTaxEnabled(true);
      setTaxPercent(15);
    } else if (struct.code === 'TECH_SPECIALIST') {
      setHraEnabled(true);
      setHraPercent(40);
      setSpecialEnabled(true);
      setSpecialPercent(10);
      setConveyanceEnabled(true);
      setConveyanceAmount(2000);
      setPfEnabled(true);
      setTaxEnabled(true);
      setTaxPercent(10);
    } else if (struct.code === 'SALES_FIELD') {
      setHraEnabled(true);
      setHraPercent(40);
      setSpecialEnabled(true);
      setSpecialPercent(15);
      setConveyanceEnabled(true);
      setConveyanceAmount(5000);
      setPfEnabled(true);
      setTaxEnabled(true);
      setTaxPercent(10);
    } else if (struct.code === 'INTERN_STIPEND') {
      setHraEnabled(false);
      setHraPercent(0);
      setSpecialEnabled(false);
      setSpecialPercent(0);
      setConveyanceEnabled(false);
      setConveyanceAmount(0);
      setPfEnabled(false);
      setTaxEnabled(false);
      setTaxPercent(0);
    } else if (struct.code === 'CONTRACTOR_TDS') {
      setHraEnabled(false);
      setHraPercent(0);
      setSpecialEnabled(false);
      setSpecialPercent(0);
      setConveyanceEnabled(false);
      setConveyanceAmount(0);
      setPfEnabled(false);
      setTaxEnabled(true);
      setTaxPercent(10);
    } else {
      // STANDARD_REGULAR
      setHraEnabled(true);
      setHraPercent(40);
      setSpecialEnabled(false);
      setSpecialPercent(10);
      setConveyanceEnabled(true);
      setConveyanceAmount(2000);
      setPfEnabled(true);
      setTaxEnabled(true);
      setTaxPercent(10);
    }
  };

  const handleOpenNewContract = () => {
    setFormError(null);
    const nextSeq = String(contracts.length + 1).padStart(3, '0');
    setContractSeq(nextSeq);
    setHraEnabled(true);
    setHraPercent(40);
    setConveyanceEnabled(true);
    setConveyanceAmount(2000);
    setSpecialEnabled(false);
    setSpecialPercent(15);
    setPfEnabled(true);
    setTaxEnabled(true);
    setTaxPercent(10);
    setIsCustomized(false);
    setFormData({
      reference: '',
      name: '',
      employee_id: filterEmpId ? Number(filterEmpId) : '',
      contract_type: 'Permanent',
      department_id: '',
      job_position_id: '',
      working_schedule_id: '',
      salary_structure_id: structures[0]?.id ? String(structures[0].id) : '',
      wage: '65000.00',
      payment_frequency: 'Monthly',
      start_date: '2026-01-01',
      end_date: '',
      status: 'Active',
      notes: '',
    });
    setIsModalOpen(true);
  };

  // When an employee is selected, automatically pre-fill department and position from their profile
  const handleEmployeeChange = (empIdStr: string) => {
    const empId = Number(empIdStr);
    const emp = employees.find((e) => e.id === empId);
    setFormData((prev) => ({
      ...prev,
      employee_id: empIdStr,
      name: emp ? `${emp.first_name} – Employment Contract` : prev.name,
      department_id: emp?.department?.id ? String(emp.department.id) : prev.department_id,
      job_position_id: emp?.job_position?.id ? String(emp.job_position.id) : prev.job_position_id,
      working_schedule_id: emp?.working_schedule?.id ? String(emp.working_schedule.id) : prev.working_schedule_id,
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.employee_id) {
      setFormError('Please select an employee.');
      return;
    }
    const finalBadge = selectedEmpBadge || 'EMP-001';
    const finalSeq = (contractSeq.trim() || '001').padStart(3, '0');
    const finalRef = `CNT.${finalSeq}.${finalBadge}`;

    let finalStructureId: number | null = formData.salary_structure_id ? Number(formData.salary_structure_id) : null;

    try {
      // If user customized allowances/deductions away from presets, generate a dedicated structure
      if (isCustomized) {
        try {
          const customCode = `CUST_${finalBadge.replace(/[^A-Za-z0-9]/g, '')}_${Date.now().toString().slice(-4)}`;
          const customName = `Custom Plan – ${selectedEmp?.first_name || 'Staff'} (${finalBadge})`;
          const structRes = await salaryConfigApi.createStructure({
            name: customName,
            code: customCode,
            is_active: true,
          });
          const nId = structRes.data.id;
          finalStructureId = nId;

          // Rule 1: BASIC
          await salaryConfigApi.createRule({
            structure_id: nId, name: 'Basic Salary', code: 'BASIC',
            category: 'BASIC', sequence: 10, computation_type: 'formula', formula_expression: 'contract.wage', is_active: true
          });
          // Rule 2: HRA
          if (hraEnabled) {
            await salaryConfigApi.createRule({
              structure_id: nId, name: `House Rent Allowance (${hraPercent}%)`, code: 'HRA',
              category: 'ALLOWANCE', sequence: 20, computation_type: 'percentage', percentage_base_code: 'BASIC', percentage_value: hraPercent, is_active: true
            });
          }
          // Rule 3: Conveyance
          if (conveyanceEnabled) {
            await salaryConfigApi.createRule({
              structure_id: nId, name: 'Conveyance Allowance', code: 'CONVEYANCE',
              category: 'ALLOWANCE', sequence: 30, computation_type: 'fixed', fixed_amount: conveyanceAmount, is_active: true
            });
          }
          // Rule 4: Special Allowance
          if (specialEnabled) {
            await salaryConfigApi.createRule({
              structure_id: nId, name: `Special Allowance (${specialPercent}%)`, code: 'SPECIAL_ALLOWANCE',
              category: 'ALLOWANCE', sequence: 35, computation_type: 'percentage', percentage_base_code: 'BASIC', percentage_value: specialPercent, is_active: true
            });
          }
          // Rule 5: Gross Before LOP
          const grossParts = ["rules['BASIC']"];
          if (hraEnabled) grossParts.push("rules['HRA']");
          if (conveyanceEnabled) grossParts.push("rules['CONVEYANCE']");
          if (specialEnabled) grossParts.push("rules['SPECIAL_ALLOWANCE']");
          await salaryConfigApi.createRule({
            structure_id: nId, name: 'Gross Before LOP', code: 'GROSS_BEFORE_LOP',
            category: 'GROSS', sequence: 40, computation_type: 'formula', formula_expression: grossParts.join(' + '), is_active: true
          });
          // Rule 6: LOP
          await salaryConfigApi.createRule({
            structure_id: nId, name: 'Loss of Pay Deduction', code: 'LOP_DEDUCTION',
            category: 'DEDUCTION', sequence: 50, computation_type: 'formula', formula_expression: "(rules['BASIC'] / total_working_days) * unpaid_leave_days", is_active: true
          });
          // Rule 7: Gross After LOP
          await salaryConfigApi.createRule({
            structure_id: nId, name: 'Gross After LOP', code: 'GROSS_AFTER_LOP',
            category: 'GROSS', sequence: 60, computation_type: 'formula', formula_expression: "rules['GROSS_BEFORE_LOP'] - rules['LOP_DEDUCTION']", is_active: true
          });
          // Rule 8: PF
          if (pfEnabled) {
            await salaryConfigApi.createRule({
              structure_id: nId, name: 'Provident Fund (PF)', code: 'PF_DEDUCTION',
              category: 'DEDUCTION', sequence: 70, computation_type: 'percentage', percentage_base_code: 'BASIC', percentage_value: 12.0, is_active: true
            });
          }
          // Rule 9: Tax
          if (taxEnabled && taxPercent > 0) {
            await salaryConfigApi.createRule({
              structure_id: nId, name: `Income Tax / TDS (${taxPercent}%)`, code: 'TAX_DEDUCTION',
              category: 'DEDUCTION', sequence: 80, computation_type: 'percentage', percentage_base_code: 'GROSS_AFTER_LOP', percentage_value: taxPercent, is_active: true
            });
          }
          // Rule 10: Total Deductions
          const dedParts = [];
          if (pfEnabled) dedParts.push("rules['PF_DEDUCTION']");
          if (taxEnabled && taxPercent > 0) dedParts.push("rules['TAX_DEDUCTION']");
          await salaryConfigApi.createRule({
            structure_id: nId, name: 'Total Statutory Deductions', code: 'TOTAL_STATUTORY_DEDUCTIONS',
            category: 'DEDUCTION', sequence: 90, computation_type: 'formula', formula_expression: dedParts.length > 0 ? dedParts.join(' + ') : '0.0', is_active: true
          });
          // Rule 11: Net
          await salaryConfigApi.createRule({
            structure_id: nId, name: 'Net Salary', code: 'NET_SALARY',
            category: 'NET', sequence: 100, computation_type: 'formula', formula_expression: "rules['GROSS_AFTER_LOP'] - rules['TOTAL_STATUTORY_DEDUCTIONS']", is_active: true
          });
        } catch (e) {
          console.error('Failed to create customized structure, using fallback', e);
        }
      }

      if (editingContract) {
        // Update existing contract (Payroll Manager & Admin only)
        await contractsApi.update(editingContract.id, {
          name: formData.name.trim() || undefined,
          salary_structure_id: finalStructureId,
          wage: Number(formData.wage),
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          status: formData.status,
          notes: formData.notes || null,
          department_id: formData.department_id ? Number(formData.department_id) : null,
          job_position_id: formData.job_position_id ? Number(formData.job_position_id) : null,
          working_schedule_id: formData.working_schedule_id ? Number(formData.working_schedule_id) : null,
        });
      } else {
        // Create new contract
        await contractsApi.create({
          ...formData,
          reference: finalRef,
          name: formData.name.trim() || `Contract - ${finalRef}`,
          employee_id: Number(formData.employee_id),
          department_id: formData.department_id ? Number(formData.department_id) : null,
          job_position_id: formData.job_position_id ? Number(formData.job_position_id) : null,
          working_schedule_id: formData.working_schedule_id ? Number(formData.working_schedule_id) : null,
          salary_structure_id: finalStructureId,
          wage: Number(formData.wage),
          end_date: formData.end_date || null,
        });
      }
      setIsModalOpen(false);
      setEditingContract(null);
      loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || (editingContract ? 'Failed to update contract' : 'Failed to create contract'));
    }
  };

  const handleOpenEditContract = (c: Contract) => {
    setFormError(null);
    setEditingContract(c);
    // Parse seq from reference e.g. CNT.001.EMP-001 or use 001
    const parts = c.reference.split('.');
    const seq = parts.length >= 2 ? parts[1] : '001';
    setContractSeq(seq);

    setFormData({
      reference: c.reference,
      name: c.name || '',
      employee_id: c.employee_id,
      contract_type: c.contract_type || 'Permanent',
      department_id: c.department_id ? String(c.department_id) : (c.employee?.department_id ? String(c.employee.department_id) : ''),
      job_position_id: c.job_position_id ? String(c.job_position_id) : (c.employee?.job_position_id ? String(c.employee.job_position_id) : ''),
      working_schedule_id: c.working_schedule_id ? String(c.working_schedule_id) : (c.employee?.working_schedule_id ? String(c.employee.working_schedule_id) : ''),
      salary_structure_id: c.salary_structure_id ? String(c.salary_structure_id) : '',
      wage: String(c.wage),
      payment_frequency: c.payment_frequency || 'Monthly',
      start_date: c.start_date,
      end_date: c.end_date || '',
      status: c.status,
      notes: c.notes || '',
    });

    if (c.salary_structure_id) {
      handleStructureChange(String(c.salary_structure_id));
    }
    setIsModalOpen(true);
  };

  const handleConfirmTerminate = async () => {
    if (!deletingContractId) return;
    try {
      setIsTerminating(true);
      await contractsApi.terminate(deletingContractId);
      setDeletingContractId(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to terminate contract');
    } finally {
      setIsTerminating(false);
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
            Decoupled contract hierarchy: <b>Employee → Contract → Salary Structure</b>. Overlap prevention enforced.
          </p>
        </div>

        {canCreateContracts && (
          <button
            id="btn-new-contract"
            onClick={handleOpenNewContract}
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

      {/* Contract Search & Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by contract reference, employee name, or badge ID..."
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
          value={selectedStructureFilter}
          onChange={(e) => setSelectedStructureFilter(e.target.value ? Number(e.target.value) : '')}
          className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Salary Structures</option>
          {structures.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Expired">Expired</option>
          <option value="Terminated">Terminated</option>
          <option value="Draft">Draft</option>
        </select>
      </div>

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
                  <th className="py-3.5 px-4">Contract ID / Ref</th>
                  <th className="py-3.5 px-4">Contract Name</th>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Base Wage</th>
                  <th className="py-3.5 px-4">Salary Structure</th>
                  <th className="py-3.5 px-4">Validity Period</th>
                  <th className="py-3.5 px-4">Status</th>
                  {canManageContractTerms && (
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-indigo-700">
                      {c.reference}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {c.name || 'Employment Contract'}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900">{c.employee?.full_name || `Emp #${c.employee_id}`}</p>
                      <p className="text-xs text-slate-400">{c.department?.name || c.employee?.department?.name}</p>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {c.contract_type || 'Permanent'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-700 font-mono">
                      ₹{c.wage.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      <span className="text-[10px] text-slate-400 font-normal"> / {c.payment_frequency || 'mo'}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {c.salary_structure?.name || 'Standard Structure'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Calendar size={13} className="text-slate-400" />
                        <span>{c.start_date} → {c.end_date || 'Indefinite'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          c.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : c.status === 'Expired'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : c.status === 'Terminated'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    {canManageContractTerms && (
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditContract(c)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Contract Terms (Payroll Manager & Admin only)"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => setDeletingContractId(c.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Terminate Contract (Payroll Manager & Admin only)"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Contract Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white max-w-xl w-full p-6 rounded-2xl shadow-xl border border-slate-200 animate-slide-up my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingContract ? 'Edit Employment Contract' : 'Create Employment Contract'}
                </h2>
                <p className="text-xs text-slate-500">
                  {editingContract
                    ? 'Modify compensation terms and structure binding. (Payroll Manager & Admin only)'
                    : 'Bind an employee to their contract-specific salary structure.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingContract(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Employee *</label>
                  <select
                    required
                    value={formData.employee_id}
                    onChange={(e) => handleEmployeeChange(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select Employee</option>
                    {employees.map((e) => {
                      const badge = e.badge_id || `EMP-${String(e.id).padStart(3, '0')}`;
                      return (
                        <option key={e.id} value={e.id}>
                          {e.first_name}({badge})
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="field-label">Contract ID / Reference *</label>
                  <div className="flex rounded-lg border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-600 bg-white">
                    <span className="inline-flex items-center px-2.5 text-xs font-mono font-bold text-slate-600 bg-slate-100 border-r border-slate-200 select-none">
                      CNT.
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="012"
                      value={contractSeq}
                      onChange={(e) => {
                        let val = e.target.value.replace(/^CNT\./i, '');
                        val = val.replace(/\.EMP.*$/i, '').replace(/[^0-9A-Za-z]/g, '');
                        setContractSeq(val);
                      }}
                      className="w-full px-2 py-2 text-slate-900 placeholder-slate-400 text-xs font-mono focus:outline-none bg-transparent"
                    />
                    <span className="inline-flex items-center px-2.5 text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border-l border-indigo-200 select-none whitespace-nowrap">
                      .{selectedEmpBadge || 'EMP-???'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">
                    Contract ID: <span className="font-bold text-indigo-600">CNT.{contractSeq || '012'}.{selectedEmpBadge || 'EMP-013'}</span>
                  </p>
                </div>
              </div>

              <div>
                <label className="field-label">Contract Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex – Senior Developer Contract"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Contract Type *</label>
                  <select
                    required
                    value={formData.contract_type}
                    onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })}
                    className="input-field"
                  >
                    <option value="Permanent">Permanent</option>
                    <option value="Temporary">Temporary</option>
                    <option value="Internship">Internship</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Working Schedule *</label>
                  <select
                    value={formData.working_schedule_id}
                    onChange={(e) => setFormData({ ...formData, working_schedule_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Default Schedule</option>
                    {schedules.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Department *</label>
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
                  <label className="field-label">Job Position *</label>
                  <select
                    value={formData.job_position_id}
                    onChange={(e) => setFormData({ ...formData, job_position_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Select Job Position</option>
                    {jobPositions.map((j) => (
                      <option key={j.id} value={j.id}>{j.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3.5 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                  Financial Terms &amp; Salary Structure Binding
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="field-label">Base Wage (₹) *</label>
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
                  <div className="col-span-1">
                    <label className="field-label">Salary Structure *</label>
                    <select
                      required
                      value={formData.salary_structure_id}
                      onChange={(e) => handleStructureChange(e.target.value)}
                      className="input-field font-semibold text-indigo-700"
                    >
                      <option value="">Select Structure</option>
                      {structures.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className="field-label">Frequency *</label>
                    <select
                      required
                      value={formData.payment_frequency}
                      onChange={(e) => setFormData({ ...formData, payment_frequency: e.target.value })}
                      className="input-field"
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Bi-Weekly">Bi-Weekly</option>
                    </select>
                  </div>
                </div>

                {/* Allowance & Deduction Component Customizer */}
                <div className="pt-3 border-t border-indigo-200/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">Allowance &amp; Deduction Components</span>
                      <p className="text-[10px] text-slate-500">Toggle allowances and customize percentages for this contract.</p>
                    </div>
                    {isCustomized ? (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Customized Plan
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        Preset: {selectedStructure?.name || 'Standard'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {/* HRA Component */}
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">House Rent Allowance (HRA)</span>
                        <button
                          type="button"
                          onClick={() => {
                            setHraEnabled(!hraEnabled);
                            setIsCustomized(true);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                            hraEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {hraEnabled ? 'YES' : 'NO'}
                        </button>
                      </div>
                      {hraEnabled ? (
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-slate-500 text-[11px]">Percentage:</span>
                          <div className="relative flex-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={hraPercent}
                              onChange={(e) => {
                                setHraPercent(Number(e.target.value));
                                setIsCustomized(true);
                              }}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono font-bold text-slate-800 pr-5"
                            />
                            <span className="absolute right-1.5 top-1 text-slate-400 font-bold text-[11px]">%</span>
                          </div>
                          <span className="font-mono text-emerald-700 font-semibold shrink-0 text-[11px]">
                            +₹{hraAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400">No HRA allowance applied.</p>
                      )}
                    </div>

                    {/* Conveyance Component */}
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">Conveyance / Travel</span>
                        <button
                          type="button"
                          onClick={() => {
                            setConveyanceEnabled(!conveyanceEnabled);
                            setIsCustomized(true);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                            conveyanceEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {conveyanceEnabled ? 'YES' : 'NO'}
                        </button>
                      </div>
                      {conveyanceEnabled ? (
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-slate-500 text-[11px]">Fixed Amount:</span>
                          <div className="relative flex-1">
                            <span className="absolute left-2 top-1 text-slate-400 text-xs font-mono">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="500"
                              value={conveyanceAmount}
                              onChange={(e) => {
                                setConveyanceAmount(Number(e.target.value));
                                setIsCustomized(true);
                              }}
                              className="w-full pl-5 pr-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono font-bold text-slate-800"
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400">No conveyance allowance applied.</p>
                      )}
                    </div>

                    {/* Special / Performance Allowance */}
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">Special / Incentive Allowance</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSpecialEnabled(!specialEnabled);
                            setIsCustomized(true);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                            specialEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {specialEnabled ? 'YES' : 'NO'}
                        </button>
                      </div>
                      {specialEnabled ? (
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-slate-500 text-[11px]">Percentage:</span>
                          <div className="relative flex-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={specialPercent}
                              onChange={(e) => {
                                setSpecialPercent(Number(e.target.value));
                                setIsCustomized(true);
                              }}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono font-bold text-slate-800 pr-5"
                            />
                            <span className="absolute right-1.5 top-1 text-slate-400 font-bold text-[11px]">%</span>
                          </div>
                          <span className="font-mono text-emerald-700 font-semibold shrink-0 text-[11px]">
                            +₹{specialAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400">No special allowance applied.</p>
                      )}
                    </div>

                    {/* Statutory Deductions: PF & TDS */}
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">Provident Fund (PF: 12%)</span>
                        <button
                          type="button"
                          onClick={() => {
                            setPfEnabled(!pfEnabled);
                            setIsCustomized(true);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                            pfEnabled ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {pfEnabled ? 'YES' : 'NO'}
                        </button>
                      </div>
                      <div className="flex items-center justify-between pt-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 text-[11px]">TDS / Tax:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setTaxEnabled(!taxEnabled);
                              setIsCustomized(true);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                              taxEnabled ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {taxEnabled ? 'YES' : 'NO'}
                          </button>
                        </div>
                        {taxEnabled && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="40"
                              value={taxPercent}
                              onChange={(e) => {
                                setTaxPercent(Number(e.target.value));
                                setIsCustomized(true);
                              }}
                              className="w-12 px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded text-xs font-mono font-bold text-slate-800 text-right"
                            />
                            <span className="text-slate-400 font-bold text-[11px]">%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Live Compensation Summary Strip */}
                  <div className="p-3 bg-white border border-indigo-200/80 rounded-xl flex items-center justify-between text-xs shadow-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Est. Gross</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        ₹{computedGross.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Est. Deductions</span>
                      <span className="font-mono font-bold text-rose-600 text-sm">
                        -₹{computedDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Est. In-Hand (Net)</span>
                      <span className="font-mono font-extrabold text-emerald-700 text-sm">
                        ₹{computedNet.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
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
                <div>
                  <label className="field-label">Contract Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="input-field"
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="Expired">Expired</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingContract(null);
                  }}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs font-semibold"
                >
                  {editingContract ? 'Save Contract Changes' : 'Create Contract'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Terminate Contract Confirmation Modal */}
      {deletingContractId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Terminate Contract</h3>
                <p className="text-xs text-slate-500">Authorized: Payroll Manager &amp; Admin only</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to terminate this contract? Its status will be moved to <span className="font-bold text-rose-600">Terminated</span> and it will no longer be eligible for future payroll generation.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeletingContractId(null)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmTerminate}
                disabled={isTerminating}
                className="btn-danger text-xs font-semibold"
              >
                {isTerminating ? 'Terminating...' : 'Confirm Termination'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
