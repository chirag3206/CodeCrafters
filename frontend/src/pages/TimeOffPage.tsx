import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { leavesApi } from '../services/api';
import type { TimeOffRequest, TimeOffAllocation, TimeOffType } from '../types';
import {
  Calendar, Plus, BarChart3, X
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

  // New Request Modal
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestData, setRequestData] = useState({
    leave_type_id: '',
    start_date: '2026-09-01',
    end_date: '2026-09-01',
    reason: '',
  });

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
      setIsRequestModalOpen(false);
      setRequestData({
        leave_type_id: leaveTypes[0]?.id ? String(leaveTypes[0].id) : '',
        start_date: '2026-09-01',
        end_date: '2026-09-01',
        reason: '',
      });
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit leave request');
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await leavesApi.approveRequest(id);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Approval failed');
    }
  };

  const handleRefuse = async (id: number) => {
    try {
      await leavesApi.refuseRequest(id);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Refusal failed');
    }
  };

  // Only show the "Request Time Off" button when the user is acting on their own leave.
  // If filterEmpId is set and doesn't match the current user's employee_id → read-only.
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
                      <td className="py-3.5 px-4 text-xs text-slate-500 max-w-[200px] truncate">
                        {r.reason || '—'}
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
                              onClick={() => handleRefuse(r.id)}
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
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
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
    </div>
  );
}
