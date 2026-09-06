import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { salaryConfigApi } from '../services/api';
import type { SalaryStructure, SalaryRule } from '../types';
import {
  Layers, Code, CheckCircle2, AlertCircle,
  Play, X, ShieldCheck, Lock, Plus, Edit2, Trash2, Save
} from 'lucide-react';

interface RuleFormData {
  name: string;
  code: string;
  category: 'BASIC' | 'ALLOWANCE' | 'GROSS' | 'DEDUCTION' | 'NET';
  sequence: number;
  computation_type: 'fixed' | 'percentage' | 'formula';
  fixed_amount: number;
  percentage_base_code: string;
  percentage_value: number;
  formula_expression: string;
  is_active: boolean;
}

const defaultRuleForm: RuleFormData = {
  name: '',
  code: '',
  category: 'ALLOWANCE',
  sequence: 50,
  computation_type: 'percentage',
  fixed_amount: 0,
  percentage_base_code: 'BASIC',
  percentage_value: 10,
  formula_expression: '',
  is_active: true,
};

export default function SalaryStructuresPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [selectedStructure, setSelectedStructure] = useState<SalaryStructure | null>(null);
  const [rules, setRules] = useState<SalaryRule[]>([]);
  const [isLoadingRules, setIsLoadingRules] = useState(false);

  // Strict RBAC: Step 6 requires that only HR Payroll Manager or Admin can create/modify rules
  const canModifyRules = user?.role === 'HR_Payroll_Manager' || user?.role === 'Admin';

  // Formula Sandbox Tester Modal
  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const [formulaInput, setFormulaInput] = useState("rules['BASIC'] * 0.40");
  const [testResult, setTestResult] = useState<{ valid: boolean; result?: number | null; error?: string | null } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Structure Creation Modal
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [structureForm, setStructureForm] = useState({ name: '', code: '' });
  const [isSavingStructure, setIsSavingStructure] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);

  // Rule Creation/Edit Modal
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SalaryRule | null>(null);
  const [ruleForm, setRuleForm] = useState<RuleFormData>(defaultRuleForm);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [ruleFormulaTestResult, setRuleFormulaTestResult] = useState<{ valid: boolean; result?: number | null; error?: string | null } | null>(null);
  const [isTestingRuleFormula, setIsTestingRuleFormula] = useState(false);

  const loadData = async () => {
    try {
      const res = await salaryConfigApi.structures();
      setStructures(res.data);
      if (res.data.length > 0) {
        const current = selectedStructure
          ? res.data.find((s: SalaryStructure) => s.id === selectedStructure.id) || res.data[0]
          : res.data[0];
        setSelectedStructure(current);
        await loadRules(current.id);
      } else {
        setSelectedStructure(null);
        setRules([]);
      }
    } catch (err) {
      console.error('Failed to load salary structures', err);
    }
  };

  const loadRules = async (structureId: number) => {
    try {
      setIsLoadingRules(true);
      const res = await salaryConfigApi.rules(structureId);
      setRules(res.data);
    } catch (err) {
      console.error('Failed to load rules', err);
    } finally {
      setIsLoadingRules(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectStructure = async (s: SalaryStructure) => {
    setSelectedStructure(s);
    await loadRules(s.id);
  };

  // Formula Sandbox Handler
  const handleTestFormula = async () => {
    try {
      setIsTesting(true);
      const res = await salaryConfigApi.validateFormula(formulaInput);
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({ valid: false, error: err.response?.data?.detail || 'Validation error' });
    } finally {
      setIsTesting(false);
    }
  };

  // Inline Formula validation for Rule modal
  const handleTestModalFormula = async () => {
    if (!ruleForm.formula_expression) return;
    try {
      setIsTestingRuleFormula(true);
      const res = await salaryConfigApi.validateFormula(ruleForm.formula_expression);
      setRuleFormulaTestResult(res.data);
    } catch (err: any) {
      setRuleFormulaTestResult({ valid: false, error: err.response?.data?.detail || 'Formula validation error' });
    } finally {
      setIsTestingRuleFormula(false);
    }
  };

  // Structure Handlers
  const handleOpenCreateStructure = () => {
    setStructureForm({ name: '', code: '' });
    setStructureError(null);
    setIsStructureModalOpen(true);
  };

  const handleSaveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!structureForm.name.trim() || !structureForm.code.trim()) {
      setStructureError('Structure Name and Code are required.');
      return;
    }
    try {
      setIsSavingStructure(true);
      setStructureError(null);
      const res = await salaryConfigApi.createStructure({
        name: structureForm.name.trim(),
        code: structureForm.code.trim().toUpperCase(),
        is_active: true,
      });
      setIsStructureModalOpen(false);
      await loadData();
      if (res.data) {
        setSelectedStructure(res.data);
        await loadRules(res.data.id);
      }
    } catch (err: any) {
      setStructureError(err.response?.data?.detail || 'Failed to create structure.');
    } finally {
      setIsSavingStructure(false);
    }
  };

  // Rule Handlers
  const handleOpenCreateRule = () => {
    const nextSeq = rules.length > 0 ? Math.max(...rules.map((r) => r.sequence)) + 10 : 10;
    setEditingRule(null);
    setRuleForm({
      ...defaultRuleForm,
      sequence: nextSeq,
    });
    setRuleError(null);
    setRuleFormulaTestResult(null);
    setIsRuleModalOpen(true);
  };

  const handleOpenEditRule = (rule: SalaryRule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      code: rule.code,
      category: rule.category,
      sequence: rule.sequence,
      computation_type: rule.computation_type,
      fixed_amount: rule.fixed_amount,
      percentage_base_code: rule.percentage_base_code || 'BASIC',
      percentage_value: rule.percentage_value,
      formula_expression: rule.formula_expression || '',
      is_active: rule.is_active,
    });
    setRuleError(null);
    setRuleFormulaTestResult(null);
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStructure) return;
    if (!ruleForm.name.trim() || !ruleForm.code.trim()) {
      setRuleError('Rule Name and Code are required.');
      return;
    }

    try {
      setIsSavingRule(true);
      setRuleError(null);

      const payload = {
        name: ruleForm.name.trim(),
        code: ruleForm.code.trim().toUpperCase(),
        category: ruleForm.category,
        sequence: Number(ruleForm.sequence),
        computation_type: ruleForm.computation_type,
        fixed_amount: ruleForm.computation_type === 'fixed' ? Number(ruleForm.fixed_amount) : 0.0,
        percentage_base_code: ruleForm.computation_type === 'percentage' ? ruleForm.percentage_base_code.trim() : null,
        percentage_value: ruleForm.computation_type === 'percentage' ? Number(ruleForm.percentage_value) : 0.0,
        formula_expression: ruleForm.computation_type === 'formula' ? ruleForm.formula_expression.trim() : null,
        is_active: ruleForm.is_active,
      };

      if (editingRule) {
        await salaryConfigApi.updateRule(editingRule.id, payload);
      } else {
        await salaryConfigApi.createRule({
          ...payload,
          structure_id: selectedStructure.id,
        });
      }

      setIsRuleModalOpen(false);
      await loadRules(selectedStructure.id);
      await loadData();
    } catch (err: any) {
      setRuleError(err.response?.data?.detail || 'Failed to save salary rule.');
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleDeleteRule = async (ruleId: number, ruleName: string) => {
    if (!selectedStructure) return;
    if (!window.confirm(`Are you sure you want to delete the rule "${ruleName}"? This cannot be undone.`)) {
      return;
    }
    try {
      await salaryConfigApi.deleteRule(ruleId);
      toast.success(`Rule "${ruleName}" deleted successfully.`);
      await loadRules(selectedStructure.id);
      await loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete rule');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Layers className="text-amber-600" size={26} />
            Salary Structures &amp; Sequenced Rule Engine
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Step 6 Governance: Ascending sequence execution, Indian statutory PF/ESI/TDS rules, and safe AST formula sandbox.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsSandboxOpen(true);
              setTestResult(null);
            }}
            className="btn-secondary text-xs font-semibold"
          >
            <Code size={16} />
            Formula Sandbox Tester
          </button>
        </div>
      </div>

      {/* Role Authority Indicator Banner */}
      <div
        className={`p-4 rounded-xl border flex items-start gap-3 text-xs shadow-2xs ${
          canModifyRules
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
            : 'bg-amber-50/80 border-amber-200 text-amber-900'
        }`}
      >
        {canModifyRules ? (
          <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
        ) : (
          <Lock size={18} className="text-amber-600 shrink-0 mt-0.5" />
        )}
        <div>
          <span className="font-bold">
            {canModifyRules
              ? '👑 Payroll Governance Authority: HR Payroll Manager Active'
              : '👁️ Operational Payroll User Mode: Read-Only Access'}
          </span>
          <p className="mt-0.5">
            {canModifyRules
              ? 'You have full authorization to modify salary structures, create rules, update percentage bases, and configure mathematical formulas.'
              : 'As an operational HR Payroll User, you can view structures, inspect sequenced rules, and test formulas in the sandbox. Only the HR Payroll Manager can modify live rules.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Structures Container List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Salary Structures</h2>
            {canModifyRules && (
              <button
                onClick={handleOpenCreateStructure}
                className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700"
              >
                <Plus size={13} />
                New Structure
              </button>
            )}
          </div>

          {structures.map((s) => (
            <div
              key={s.id}
              onClick={() => handleSelectStructure(s)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                selectedStructure?.id === s.id
                  ? 'border-indigo-300 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-200'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{s.name}</h3>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">{s.code}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                <span>{s.rules_count} Rules</span>
                <span>{s.contracts_count} Active Contracts</span>
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Sequenced Rules Table */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Sequenced Computation Rules ({selectedStructure?.name || 'None'})
            </h2>
            {canModifyRules && selectedStructure && (
              <button
                onClick={handleOpenCreateRule}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 font-semibold"
              >
                <Plus size={14} />
                Add Salary Rule
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3.5">Seq</th>
                    <th className="py-3 px-3.5">Rule Name</th>
                    <th className="py-3 px-3.5">Code</th>
                    <th className="py-3 px-3.5">Category</th>
                    <th className="py-3 px-3.5">Type</th>
                    <th className="py-3 px-3.5">Computation Expression</th>
                    {canModifyRules && <th className="py-3 px-3.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rules.length === 0 ? (
                    <tr>
                      <td colSpan={canModifyRules ? 7 : 6} className="py-8 text-center text-xs text-slate-400">
                        {isLoadingRules ? 'Loading rules...' : 'No rules defined in this structure yet.'}
                      </td>
                    </tr>
                  ) : (
                    rules.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3.5 font-mono text-xs font-bold text-amber-700">
                          {r.sequence}
                        </td>
                        <td className="py-3 px-3.5 font-semibold text-slate-900">
                          {r.name}
                          {!r.is_active && (
                            <span className="ml-2 text-[10px] text-slate-400 border border-slate-200 rounded px-1">
                              Disabled
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-xs text-slate-600">
                          {r.code}
                        </td>
                        <td className="py-3 px-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              r.category === 'BASIC'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : r.category === 'ALLOWANCE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : r.category === 'GROSS'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : r.category === 'DEDUCTION'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {r.category}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-xs text-slate-500 capitalize">
                          {r.computation_type}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-xs text-slate-700 max-w-[240px] truncate">
                          {r.computation_type === 'percentage'
                            ? `${r.percentage_value}% of ${r.percentage_base_code || 'BASIC'}`
                            : r.computation_type === 'fixed'
                            ? `₹${r.fixed_amount.toFixed(2)}`
                            : r.formula_expression || 'contract.wage'}
                        </td>
                        {canModifyRules && (
                          <td className="py-3 px-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditRule(r)}
                                title="Edit Salary Rule"
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteRule(r.id, r.name)}
                                title="Delete Salary Rule"
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* New Structure Modal */}
      {isStructureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl shadow-xl border border-slate-200 animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers size={18} className="text-indigo-600" />
                Create New Salary Structure
              </h2>
              <button
                onClick={() => setIsStructureModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveStructure} className="space-y-4">
              {structureError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{structureError}</span>
                </div>
              )}

              <div>
                <label className="field-label">Structure Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Executive Regular Structure"
                  value={structureForm.name}
                  onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })}
                  className="field-input text-xs"
                />
              </div>

              <div>
                <label className="field-label">Structure Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. EXEC_REG_2026"
                  value={structureForm.code}
                  onChange={(e) => setStructureForm({ ...structureForm, code: e.target.value.toUpperCase() })}
                  className="field-input text-xs font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">Must be unique across the organization.</p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsStructureModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingStructure}
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  <Save size={14} />
                  {isSavingStructure ? 'Saving...' : 'Create Structure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Create Rule Modal */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white max-w-xl w-full p-6 rounded-2xl shadow-xl border border-slate-200 animate-slide-up my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Code size={18} className="text-amber-600" />
                {editingRule ? `Edit Rule: ${editingRule.name}` : `Add Rule to ${selectedStructure?.name}`}
              </h2>
              <button onClick={() => setIsRuleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4">
              {ruleError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{ruleError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Rule Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Special Allowance"
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                    className="field-input text-xs"
                  />
                </div>
                <div>
                  <label className="field-label">Rule Code</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingRule}
                    placeholder="e.g. SPECIAL_ALW"
                    value={ruleForm.code}
                    onChange={(e) => setRuleForm({ ...ruleForm, code: e.target.value.toUpperCase() })}
                    className="field-input text-xs font-mono disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Rule Category</label>
                  <select
                    value={ruleForm.category}
                    onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value as any })}
                    className="field-input text-xs"
                  >
                    <option value="BASIC">BASIC (Wage Base)</option>
                    <option value="ALLOWANCE">ALLOWANCE (Additions)</option>
                    <option value="GROSS">GROSS (Subtotal)</option>
                    <option value="DEDUCTION">DEDUCTION (Statutory / LOP)</option>
                    <option value="NET">NET (Take Home Pay)</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Sequence (Execution Order)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={999}
                    value={ruleForm.sequence}
                    onChange={(e) => setRuleForm({ ...ruleForm, sequence: Number(e.target.value) })}
                    className="field-input text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Computation Type</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {(['percentage', 'fixed', 'formula'] as const).map((type) => (
                    <button
                      type="button"
                      key={type}
                      onClick={() => setRuleForm({ ...ruleForm, computation_type: type })}
                      className={`p-2 rounded-lg text-xs font-semibold capitalize border text-center transition-all ${
                        ruleForm.computation_type === type
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional configuration based on computation_type */}
              {ruleForm.computation_type === 'percentage' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-4">
                  <div>
                    <label className="field-label">Percentage Value (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={ruleForm.percentage_value}
                      onChange={(e) => setRuleForm({ ...ruleForm, percentage_value: parseFloat(e.target.value) || 0 })}
                      className="field-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="field-label">Percentage Base Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BASIC or GROSS_AFTER_LOP"
                      value={ruleForm.percentage_base_code}
                      onChange={(e) => setRuleForm({ ...ruleForm, percentage_base_code: e.target.value.toUpperCase() })}
                      className="field-input text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              {ruleForm.computation_type === 'fixed' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="field-label">Fixed Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={ruleForm.fixed_amount}
                    onChange={(e) => setRuleForm({ ...ruleForm, fixed_amount: parseFloat(e.target.value) || 0 })}
                    className="field-input text-xs"
                  />
                </div>
              )}

              {ruleForm.computation_type === 'formula' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="field-label">Python AST Formula</label>
                      <button
                        type="button"
                        onClick={handleTestModalFormula}
                        disabled={isTestingRuleFormula || !ruleForm.formula_expression}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                      >
                        <Play size={11} />
                        {isTestingRuleFormula ? 'Checking...' : 'Validate Formula'}
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      required
                      value={ruleForm.formula_expression}
                      onChange={(e) => {
                        setRuleForm({ ...ruleForm, formula_expression: e.target.value });
                        setRuleFormulaTestResult(null);
                      }}
                      className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-emerald-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g. rules['BASIC'] + rules['HRA']"
                    />
                  </div>

                  {ruleFormulaTestResult && (
                    <div
                      className={`p-2.5 rounded-lg border text-xs font-mono ${
                        ruleFormulaTestResult.valid
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      {ruleFormulaTestResult.valid ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                          <span>Valid expression! Test result: ₹{ruleFormulaTestResult.result?.toFixed(2)}</span>
                        </div>
                      ) : (
                        <div className="flex items-start gap-1.5">
                          <AlertCircle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                          <span>Syntax error: {ruleFormulaTestResult.error}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_active_toggle"
                  checked={ruleForm.is_active}
                  onChange={(e) => setRuleForm({ ...ruleForm, is_active: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <label htmlFor="is_active_toggle" className="text-xs text-slate-700 font-medium">
                  Rule is active and included in payroll calculations
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRule}
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  <Save size={14} />
                  {isSavingRule ? 'Saving...' : editingRule ? 'Update Rule' : 'Add Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Formula Sandbox Tester Modal */}
      {isSandboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white max-w-lg w-full p-6 rounded-2xl shadow-xl border border-slate-200 animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Code size={18} className="text-amber-600" />
                Safe Formula AST Evaluator
              </h2>
              <button onClick={() => setIsSandboxOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Test mathematical expressions against the mock sandbox context (Base Wage: ₹65,000.00, Worked Days: 20, Unpaid LOP: 1).
              </p>

              <div>
                <label className="field-label">Python Formula Expression</label>
                <textarea
                  rows={3}
                  value={formulaInput}
                  onChange={(e) => setFormulaInput(e.target.value)}
                  className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-emerald-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. (rules['BASIC'] / total_working_days) * unpaid_leave_days"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormulaInput("(rules['BASIC'] / total_working_days) * unpaid_leave_days")}
                    className="btn-secondary text-[11px] py-1 px-2"
                  >
                    LOP Sample
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormulaInput("rules['GROSS_BEFORE_LOP'] - rules['LOP_DEDUCTION']")}
                    className="btn-secondary text-[11px] py-1 px-2"
                  >
                    Gross After LOP
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isTesting}
                  onClick={handleTestFormula}
                  className="btn-primary text-xs font-semibold py-1.5"
                >
                  <Play size={13} />
                  Evaluate Formula
                </button>
              </div>

              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-mono ${
                    testResult.valid
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {testResult.valid ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                      <span>Syntax Valid ✅ Calculated Sandbox Result: <b>₹{testResult.result?.toFixed(2)}</b></span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                      <span>Error: {testResult.error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
