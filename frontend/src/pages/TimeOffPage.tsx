import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '../contexts/ToastContext';
import { leavesApi, employeesApi } from '../services/api';
import type { TimeOffRequest, TimeOffAllocation, TimeOffType } from '../types';
import {
  Calendar, Plus, BarChart3, X, ChevronDown, ChevronUp, Layers, List
} from 'lucide-react';

export default function TimeOffPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') === 'allocations' ? 'allocations' : 'requests';
  const filterEmpId = searchParams.get('employee_id');

  const [activeTab, setActiveTab] = useState<'requests' | 'allocations'>(defaultTab);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [allocations, setAllocations] = useState<TimeOffAllocation[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<TimeOffType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Allocation View & Expand State
  const [allocationViewMode, setAllocationViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [expandedEmpIds, setExpandedEmpIds] = useState<number[]>([]);

  // New Request Modal
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestData, setRequestData] = useState({
    leave_type_id: '',
    start_date: '2026-09-01',
    end_date: '2026-09-01',
    reason: '',
  });

  // Refuse Request Modal
  const [refusalModal, setRefusalModal] = useState<{
    isOpen: boolean;
    requestId: number | null;
    employeeName: string;
    reason: string;
  }>({
    isOpen: false,
    requestId: null,
    employeeName: '',
    reason: '',
  });

  // Grant Quota Modal
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [grantScope, setGrantScope] = useState<'all' | 'single' | 'selected'>('all');
  const [singleEmpId, setSingleEmpId] = useState('');
  const [selectedEmpIds, setSelectedEmpIds] = useState<number[]>([]);
  const [grantLeaveTypeId, setGrantLeaveTypeId] = useState('');
  const [grantMode, setGrantMode] = useState<'add' | 'set'>('add');
  const [grantDays, setGrantDays] = useState('2.0');
  const [employeesList, setEmployeesList] = useState<any[]>([]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [reqRes, allocRes, typeRes] = await Promise.all([
        leavesApi.requests({ employee_id: filterEmpId ? Number(filterEmpId) : undefined }),
        leavesApi.allocations(filterEmpId ? Number(filterEmpId) : undefined),
        leavesApi.types(),
      ]);
      setRequests(reqRes.data);
      setAllocations(allocRes.data);
      setLeaveTypes(typeRes.data);
      if (typeRes.data.length > 0 && !requestData.leave_type_id) {
        setRequestData(prev => ({ ...prev, leave_type_id: String(typeRes.data[0].id) }));
      }
    } catch (err) {
      console.error('Failed to load leave data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterEmpId, user?.user_id]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await leavesApi.submitRequest({
        ...requestData,
        leave_type_id: Number(requestData.leave_type_id),
      });
      toast.success('Time off request submitted successfully!');
      setIsRequestModalOpen(false);
      setRequestData({
        leave_type_id: leaveTypes[0]?.id ? String(leaveTypes[0].id) : '',
        start_date: '2026-09-01',
        end_date: '2026-09-01',
        reason: '',
      });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to submit leave request');
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await leavesApi.approveRequest(id);
      toast.success('Request approved successfully');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Approval failed');
    }
  };

  const handleOpenRefuseModal = (req: TimeOffRequest) => {
    setRefusalModal({
      isOpen: true,
      requestId: req.id,
      employeeName: req.employee?.full_name || `Emp #${req.employee_id}`,
      reason: '',
    });
  };

  const handleConfirmRefuse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refusalModal.requestId) return;
    try {
      await leavesApi.refuseRequest(refusalModal.requestId, {
        rejection_reason: refusalModal.reason,
      });
      toast.info('Request refused');
      setRefusalModal({ isOpen: false, requestId: null, employeeName: '', reason: '' });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Refusal failed');
    }
  };

  const openGrantModal = async () => {
    setIsGrantModalOpen(true);
    if (leaveTypes.length > 0 && !grantLeaveTypeId) {
      setGrantLeaveTypeId(String(leaveTypes[0].id));
    }
    try {
      const res = await employeesApi.list({ limit: 100 });
      setEmployeesList(res.data || []);
    } catch { /* ignore */ }
  };

  const handleGrantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let empIds: number[] | undefined = undefined;
    if (grantScope === 'single') {
      if (!singleEmpId) {
        toast.error('Please select an employee');
        return;
      }
      empIds = [Number(singleEmpId)];
    } else if (grantScope === 'selected') {
      if (selectedEmpIds.length === 0) {
        toast.error('Please select at least one employee');
        return;
      }
      empIds = selectedEmpIds;
    }

    try {
      await leavesApi.grantBulkAllocation({
        employee_ids: empIds,
        leave_type_id: Number(grantLeaveTypeId),
        allocated_days: Number(grantDays),
        mode: grantMode,
      });
      toast.success('Quota granted successfully');
      setIsGrantModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to grant leave allocation');
    }
  };

  const toggleExpandEmployee = (empId: number) => {
    setExpandedEmpIds(prev =>
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  // Group allocations by employee
  const groupedAllocationsMap = new Map<number, {
    employee_id: number;
    employee: any;
    items: TimeOffAllocation[];
    total_allocated: number;
    total_approved_taken: number;
    total_pending: number;
    total_remaining: number;
  }>();

  allocations.forEach(a => {
    const empId = a.employee_id;
    if (!groupedAllocationsMap.has(empId)) {
      groupedAllocationsMap.set(empId, {
        employee_id: empId,
        employee: a.employee,
        items: [],
        total_allocated: 0,
        total_approved_taken: 0,
        total_pending: 0,
        total_remaining: 0,
      });
    }
    const group = groupedAllocationsMap.get(empId)!;
    group.items.push(a);
    group.total_allocated += a.allocated_days;
    group.total_approved_taken += a.approved_taken;
    group.total_pending += a.pending_days;
    group.total_remaining += a.remaining_balance;
  });

  const groupedAllocations = Array.from(groupedAllocationsMap.values());

  const isViewingOwnLeave =
    !filterEmpId ||
    (user?.employee_id != null && Number(filterEmpId) === user.employee_id);

  const canApproveLeaves = user?.role === 'HR_Manager' || user?.role === 'Admin';
  const viewedEmployee = requests[0]?.employee || (filterEmpId ? { full_name: `Employee #${filterEmpId}`, badge_id: `EMP-${filterEmpId}` } : null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Calendar className="text-emerald-600" size={26} />
            Time Off & Quota Ledger
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Leave allocation balances, business day calculations, and approval workflows.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canApproveLeaves && (
            <button
              onClick={openGrantModal}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Plus size={16} />
              Grant / Allocate Quota
            </button>
          )}
          {isViewingOwnLeave && (
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="btn-success text-xs font-semibold"
            >
              <Plus size={16} />
              {user?.role === 'Employee' ? 'Request Time Off' : 'Request My Time Off'}
            </button>
          )}
        </div>
      </div>

      {filterEmpId && (
        isViewingOwnLeave ? (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-700">
            <span>Viewing your personal leave ledger</span>
            <a href="/time-off" className="font-semibold underline hover:text-emerald-900">Clear Filter</a>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-amber-900">
              <Calendar size={18} className="text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">
                  Read-Only Inspection — Leave Ledger for {viewedEmployee?.full_name} ({viewedEmployee?.badge_id})
                </span>
                <p className="text-amber-700/80 text-[11px] mt-0.5">
                  Employees must submit their own time off requests. As {user?.role?.replace(/_/g, ' ')}, you can review, approve, or refuse requests below, or grant quota in the Allocations tab.
                </p>
              </div>
            </div>
            <a href="/time-off" className="font-semibold text-indigo-600 hover:text-indigo-800 underline shrink-0">Clear Filter (View All)</a>
          </div>
        )
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'requests'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar size={15} />
          Time Off Requests ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab('allocations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'allocations'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BarChart3 size={15} />
          Quota Allocation Ledger ({allocations.length})
        </button>
      </div>

      {/* Tab 1: Requests Table */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          {isLoading ? (
            <div className="text-center py-16 text-slate-400">Loading leave requests...</div>
          ) : requests.length === 0 ? (
            <div className="p-10 text-center text-slate-500">No time off requests recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Employee Name</th>
                    <th className="py-3.5 px-4">Leave Type</th>
                    <th className="py-3.5 px-4">Dates</th>
                    <th className="py-3.5 px-4">Duration</th>
                    <th className="py-3.5 px-4">Reason</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {r.employee?.full_name || `Emp #${r.employee_id}`}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className="px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                          style={{
                            backgroundColor: `${r.leave_type?.color || '#4F46E5'}15`,
                            color: r.leave_type?.color || '#4F46E5',
                            borderColor: `${r.leave_type?.color || '#4F46E5'}30`,
                          }}
                        >
                          {r.leave_type?.name || 'Leave'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 font-mono">
                        {r.start_date} → {r.end_date}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800 font-mono">
                        {r.duration_days} Day(s)
                      </td>
                      <td className="py-3.5 px-4 text-xs max-w-[220px]">
                        <div className="text-slate-700 font-medium">{r.reason || '—'}</div>
                        {r.status === 'Refused' && r.rejection_reason && (
                          <div className="mt-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] leading-snug">
                            <span className="font-bold text-rose-900 block mb-0.5">Rejection Reason:</span>
                            {r.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            r.status === 'Approved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : r.status === 'Submitted'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {canApproveLeaves && r.status === 'Submitted' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleApprove(r.id)}
                              className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleOpenRefuseModal(r)}
                              className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors"
                            >
                              Refuse
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Allocation Ledger Table */}
      {activeTab === 'allocations' && (
        <div className="space-y-3">
          {/* View Toggle Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <div className="text-xs text-slate-500 font-medium">
              Showing leave allocations for <span className="font-bold text-slate-800">{groupedAllocations.length}</span> employee(s)
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
              <button
                onClick={() => setAllocationViewMode('grouped')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  allocationViewMode === 'grouped'
                    ? 'bg-white text-indigo-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers size={14} />
                Grouped Employee View (1 row/emp)
              </button>
              <button
                onClick={() => setAllocationViewMode('flat')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  allocationViewMode === 'flat'
                    ? 'bg-white text-indigo-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List size={14} />
                Detailed Type View
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            {isLoading ? (
              <div className="text-center py-16 text-slate-400">Loading allocations...</div>
            ) : allocations.length === 0 ? (
              <div className="p-10 text-center text-slate-500">No time off allocations recorded.</div>
            ) : allocationViewMode === 'grouped' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Employee</th>
                      <th className="py-3.5 px-4">Leave Quotas Breakdown</th>
                      <th className="py-3.5 px-4">Total Quota</th>
                      <th className="py-3.5 px-4">Approved Taken</th>
                      <th className="py-3.5 px-4">Remaining Balance</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groupedAllocations.map((g) => {
                      const isExpanded = expandedEmpIds.includes(g.employee_id);
                      const empName = g.employee?.full_name || `Emp #${g.employee_id}`;
                      const badgeId = g.employee?.badge_id;
                      const deptName = g.employee?.department?.name;

                      return (
                        <React.Fragment key={g.employee_id}>
                          <tr className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-2xs"
                                  style={{ backgroundColor: g.employee?.avatar_color || '#4F46E5' }}
                                >
                                  {g.employee?.avatar_initials || empName.charAt(0)}
                                </div>
                                <div>
                                  <span className="font-bold text-slate-900 block">{empName}</span>
                                  <span className="text-[11px] text-slate-400">
                                    {badgeId || `ID #${g.employee_id}`} {deptName ? `• ${deptName}` : ''}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="flex flex-wrap gap-1.5 max-w-md">
                                {g.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 shadow-2xs bg-white"
                                    style={{
                                      borderColor: `${item.leave_type?.color || '#4F46E5'}40`,
                                    }}
                                  >
                                    <span
                                      className="w-2 h-2 rounded-full shrink-0"
                                      style={{ backgroundColor: item.leave_type?.color || '#4F46E5' }}
                                    />
                                    <span className="text-slate-700 font-medium">{item.leave_type?.name}:</span>
                                    <span className="font-bold font-mono text-emerald-700">{item.remaining_balance.toFixed(1)}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">/ {item.allocated_days.toFixed(1)}d</span>
                                  </div>
                                ))}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                              {g.total_allocated.toFixed(1)} Days
                            </td>
                            <td className="py-3.5 px-4 font-mono text-rose-600 font-semibold">
                              {g.total_approved_taken.toFixed(1)} Days
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-emerald-700 text-base">
                              {g.total_remaining.toFixed(1)} Days
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => toggleExpandEmployee(g.employee_id)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1 ml-auto"
                              >
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                {isExpanded ? 'Hide' : 'Details'}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Details Sub-Table */}
                          {isExpanded && (
                            <tr className="bg-slate-50/70 border-b border-slate-200">
                              <td colSpan={6} className="p-4">
                                <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs">
                                  <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                                    <BarChart3 size={14} className="text-indigo-600" />
                                    Detailed Quota Ledger for {empName}
                                  </h5>
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500 uppercase">
                                      <tr>
                                        <th className="py-2 px-3">Leave Type</th>
                                        <th className="py-2 px-3">Allocated Quota</th>
                                        <th className="py-2 px-3">Approved Taken</th>
                                        <th className="py-2 px-3">Pending Requests</th>
                                        <th className="py-2 px-3">Remaining Balance</th>
                                        <th className="py-2 px-3">Validity</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {g.items.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/50">
                                          <td className="py-2 px-3 font-semibold text-slate-800 flex items-center gap-2">
                                            <span
                                              className="w-2.5 h-2.5 rounded-full shrink-0"
                                              style={{ backgroundColor: item.leave_type?.color || '#4F46E5' }}
                                            />
                                            {item.leave_type?.name} ({item.leave_type?.is_paid ? 'Paid' : 'Unpaid LOP'})
                                          </td>
                                          <td className="py-2 px-3 font-mono font-medium text-slate-800">{item.allocated_days.toFixed(1)} Days</td>
                                          <td className="py-2 px-3 font-mono text-rose-600 font-semibold">{item.approved_taken.toFixed(1)} Days</td>
                                          <td className="py-2 px-3 font-mono text-amber-600">{item.pending_days.toFixed(1)} Days</td>
                                          <td className="py-2 px-3 font-mono font-bold text-emerald-700">{item.remaining_balance.toFixed(1)} Days</td>
                                          <td className="py-2 px-3 text-slate-400 font-mono">{item.valid_from} → {item.valid_to}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Flat Detailed Type View */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Employee</th>
                      <th className="py-3.5 px-4">Leave Type</th>
                      <th className="py-3.5 px-4">Allocated Quota</th>
                      <th className="py-3.5 px-4">Approved Taken</th>
                      <th className="py-3.5 px-4">Pending Requests</th>
                      <th className="py-3.5 px-4">Remaining Balance</th>
                      <th className="py-3.5 px-4">Validity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allocations.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {a.employee?.full_name || `Emp #${a.employee_id}`}
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-700">{a.leave_type?.name}</td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-800">{a.allocated_days.toFixed(1)} Days</td>
                        <td className="py-3 px-4 font-mono text-rose-600 font-semibold">{a.approved_taken.toFixed(1)} Days</td>
                        <td className="py-3 px-4 font-mono text-amber-600">{a.pending_days.toFixed(1)} Days</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                          {a.remaining_balance.toFixed(1)} Days
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400">
                          {a.valid_from} → {a.valid_to}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Request Leave Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl shadow-xl border border-slate-200 animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900">Submit Time Off Request</h2>
              <button onClick={() => setIsRequestModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900">
                <span className="font-bold block">Applicant: {user?.full_name} ({user?.badge_id || user?.role})</span>
                <span className="text-[11px] text-indigo-700">Self-Service Policy: Leaves are submitted under your personal profile only.</span>
              </div>

              <div>
                <label className="field-label">Leave Type *</label>
                <select
                  required
                  value={requestData.leave_type_id}
                  onChange={(e) => setRequestData({ ...requestData, leave_type_id: e.target.value })}
                  className="input-field"
                >
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.is_paid ? 'Paid Leave' : 'Unpaid LOP'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={requestData.start_date}
                    onChange={(e) => setRequestData({ ...requestData, start_date: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="field-label">End Date *</label>
                  <input
                    type="date"
                    required
                    value={requestData.end_date}
                    onChange={(e) => setRequestData({ ...requestData, end_date: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Reason / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Medical appointment, Diwali festival vacation..."
                  value={requestData.reason}
                  onChange={(e) => setRequestData({ ...requestData, reason: e.target.value })}
                  className="input-field text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-success text-xs font-semibold"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refuse Leave Modal */}
      {refusalModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl shadow-xl border border-slate-200 animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-rose-700 flex items-center gap-2">
                Refuse Time Off Request
              </h2>
              <button
                onClick={() => setRefusalModal({ isOpen: false, requestId: null, employeeName: '', reason: '' })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmRefuse} className="space-y-4">
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
                <span className="font-bold block mb-0.5">Refusing Request for: {refusalModal.employeeName}</span>
                <span className="text-[11px] text-rose-700">
                  Please specify the reason for rejecting this request. The employee will see this explanation on their leave dashboard.
                </span>
              </div>

              <div>
                <label className="field-label">Rejection Reason *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Critical project milestone scheduled during this period, insufficient team coverage..."
                  value={refusalModal.reason}
                  onChange={(e) => setRefusalModal({ ...refusalModal, reason: e.target.value })}
                  className="input-field text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRefusalModal({ isOpen: false, requestId: null, employeeName: '', reason: '' })}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  Confirm Refusal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grant / Allocate Quota Modal */}
      {isGrantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white max-w-lg w-full p-6 rounded-2xl shadow-xl border border-slate-200 animate-slide-up my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="text-indigo-600" size={20} />
                Grant & Allocate Leave Quota
              </h2>
              <button
                onClick={() => setIsGrantModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleGrantSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900">
                <span className="font-bold block mb-0.5">HR Quota Management Policy</span>
                <span className="text-[11px] text-indigo-700">
                  Grant or adjust leave balances (Annual, Sick, Casual, Unpaid LOP, etc.) for individual or multiple employees. Remaining balances and payroll calculations will update automatically.
                </span>
              </div>

              {/* Target Scope */}
              <div>
                <label className="field-label">Target Employees *</label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setGrantScope('all')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      grantScope === 'all'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    All Active ({employeesList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrantScope('single')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      grantScope === 'single'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Single Employee
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrantScope('selected')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      grantScope === 'selected'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Select Multiple ({selectedEmpIds.length})
                  </button>
                </div>

                {grantScope === 'single' && (
                  <select
                    required
                    value={singleEmpId}
                    onChange={(e) => setSingleEmpId(e.target.value)}
                    className="input-field text-xs"
                  >
                    <option value="">Select Employee...</option>
                    {employeesList.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.badge_id || `ID #${emp.id}`}) — {emp.work_email}
                      </option>
                    ))}
                  </select>
                )}

                {grantScope === 'selected' && (
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2.5 bg-slate-50 space-y-1 text-xs">
                    {employeesList.map((emp) => {
                      const isSelected = selectedEmpIds.includes(emp.id);
                      return (
                        <label
                          key={emp.id}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected ? 'bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold' : 'bg-white hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <span className="truncate">{emp.full_name} ({emp.badge_id})</span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedEmpIds(prev =>
                                isSelected ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                              );
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Leave Type */}
              <div>
                <label className="field-label">Leave Type *</label>
                <select
                  required
                  value={grantLeaveTypeId}
                  onChange={(e) => setGrantLeaveTypeId(e.target.value)}
                  className="input-field text-xs"
                >
                  {leaveTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>
                      {lt.name} ({lt.is_paid ? 'Paid Leave' : 'Unpaid LOP'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Mode & Number of Days */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Allocation Action *</label>
                  <select
                    value={grantMode}
                    onChange={(e) => setGrantMode(e.target.value as 'add' | 'set')}
                    className="input-field text-xs"
                  >
                    <option value="add">+ Add / Top-Up Days</option>
                    <option value="set">= Set Fixed Total Quota</option>
                  </select>
                </div>

                <div>
                  <label className="field-label">Number of Days *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="365"
                    required
                    value={grantDays}
                    onChange={(e) => setGrantDays(e.target.value)}
                    placeholder="e.g. 3.0"
                    className="input-field text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsGrantModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs font-semibold"
                >
                  Confirm & Update Quotas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
