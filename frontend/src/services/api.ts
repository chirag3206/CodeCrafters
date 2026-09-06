import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — clear token and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  switchPersona: (persona_key: string) =>
    api.post('/auth/switch-persona', { persona_key }),
  getMe: () => api.get('/auth/me'),

  // Change own password (all authenticated roles)
  changePassword: (current_password: string, new_password: string, confirm_password: string) =>
    api.post('/auth/change-password', { current_password, new_password, confirm_password }),

  // User management (Admin / HR Manager)
  listUsers: () => api.get('/auth/users'),
  createUser: (data: {
    email: string;
    full_name: string;
    password: string;
    role: string;
    employee_id?: number;
  }) => api.post('/auth/users', data),
  updateUser: (id: number, data: { role?: string; is_active?: boolean }) =>
    api.put(`/auth/users/${id}`, data),
  resetPassword: (id: number, new_password: string) =>
    api.post(`/auth/users/${id}/reset-password`, { new_password }),
};

// ── Employees ─────────────────────────────────────────────────────────────────
export const employeesApi = {
  list: (params?: { q?: string; department_id?: number; status?: string; employment_type?: string; skip?: number; limit?: number }) =>
    api.get('/employees', { params }),
  get: (id: number) => api.get(`/employees/${id}`),
  create: (data: any) => api.post('/employees', data),
  update: (id: number, data: any) => api.put(`/employees/${id}`, data),
  archive: (id: number) => api.delete(`/employees/${id}`),
  offboard: (id: number, data: { reason: string; notes?: string }) =>
    api.post(`/employees/${id}/offboard`, data),
  departments: () => api.get('/departments'),
  jobPositions: (dept_id?: number) => api.get('/job-positions', { params: { department_id: dept_id } }),
  workingSchedules: () => api.get('/working-schedules'),
};

// ── Contracts ─────────────────────────────────────────────────────────────────
export const contractsApi = {
  list: (params?: { q?: string; employee_id?: number; department_id?: number; salary_structure_id?: number; status?: string; skip?: number; limit?: number }) =>
    api.get('/contracts', { params }),
  get: (id: number) => api.get(`/contracts/${id}`),
  create: (data: any) => api.post('/contracts', data),
  update: (id: number, data: any) => api.put(`/contracts/${id}`, data),
  terminate: (id: number) => api.delete(`/contracts/${id}`),
  resolve: (empId: number, start: string, end: string) =>
    api.get(`/contracts/resolve/${empId}`, { params: { period_start: start, period_end: end } }),
};

// ── Schedules ─────────────────────────────────────────────────────────────────
export const schedulesApi = {
  list: () => api.get('/schedules'),
  get: (id: number) => api.get(`/schedules/${id}`),
  create: (data: any) => api.post('/schedules', data),
  delete: (id: number) => api.delete(`/schedules/${id}`),
  activeNotifications: () => api.get('/schedules/active-notifications'),
  updateOfficeHours: (data: {
    start_time: string;
    end_time: string;
    break_hours?: number;
    grace_minutes?: number;
    effective_date: string;
    reason: string;
  }) => api.post('/schedules/office-hours', data),
};


// ── Time Off ──────────────────────────────────────────────────────────────────
export const leavesApi = {
  types: () => api.get('/time-off/types'),
  createType: (data: any) => api.post('/time-off/types', data),
  allocations: (emp_id?: number) => api.get('/time-off/allocations', { params: { employee_id: emp_id } }),
  createAllocation: (data: any) => api.post('/time-off/allocations', data),
  approveAllocation: (id: number) => api.put(`/time-off/allocations/${id}/approve`),
  refuseAllocation: (id: number) => api.put(`/time-off/allocations/${id}/refuse`),
  grantBulkAllocation: (data: { employee_ids?: number[]; leave_type_id: number; allocated_days: number; mode: 'add' | 'set' }) =>
    api.post('/time-off/allocations/grant-bulk', data),
  requests: (params?: { employee_id?: number; status?: string }) => api.get('/time-off/requests', { params }),
  submitRequest: (data: any) => api.post('/time-off/requests', data),
  approveRequest: (id: number) => api.put(`/time-off/requests/${id}/approve`),
  refuseRequest: (id: number, data?: { rejection_reason?: string }) => api.put(`/time-off/requests/${id}/refuse`, data),
};

// ── Attendance ────────────────────────────────────────────────────────────────
export const attendanceApi = {
  list: (params?: { employee_id?: number; date_from?: string; date_to?: string; status?: string; skip?: number; limit?: number }) =>
    api.get('/attendance', { params }),
  today: () => api.get('/attendance/today'),
  punch: (action: 'check_in' | 'check_out', timestamp?: string) =>
    api.post('/attendance/punch', { action, timestamp }),
  correct: (id: number, data: any) => api.put(`/attendance/${id}/correct`, data),
  summary: (emp_id: number, start: string, end: string) =>
    api.get(`/attendance/summary/${emp_id}`, { params: { period_start: start, period_end: end } }),
  lockPeriod: (data: { month: string; approval_notes?: string }) =>
    api.post('/attendance/lock-period', data),
  lockStatus: (month: string) =>
    api.get('/attendance/lock-status', { params: { month } }),
};


// ── Salary Config ─────────────────────────────────────────────────────────────
export const salaryConfigApi = {
  structures: () => api.get('/salary-structures'),
  getStructure: (id: number) => api.get(`/salary-structures/${id}`),
  createStructure: (data: any) => api.post('/salary-structures', data),
  updateStructure: (id: number, data: any) => api.put(`/salary-structures/${id}`, data),
  rules: (structure_id: number) => api.get('/salary-rules', { params: { structure_id } }),
  createRule: (data: any) => api.post('/salary-rules', data),
  updateRule: (id: number, data: any) => api.put(`/salary-rules/${id}`, data),
  deleteRule: (id: number) => api.delete(`/salary-rules/${id}`),
  validateFormula: (formula: string) => api.post('/salary-rules/validate-formula', { formula }),
};

// ── Payruns ───────────────────────────────────────────────────────────────────
export const payrunsApi = {
  list: () => api.get('/payruns'),
  get: (id: number) => api.get(`/payruns/${id}`),
  candidates: (params: { period_start: string; period_end: string; salary_structure_id: number; department_id?: number; employee_type?: string }) =>
    api.get('/payruns/eligible-candidates', { params }),
  createBatch: (data: any) => api.post('/payruns/create-batch', data),
  compute: (id: number) => api.post(`/payruns/${id}/compute`),
  sendPreVerification: (id: number) => api.post(`/payruns/${id}/send-pre-verification`),
  validate: (id: number) => api.post(`/payruns/${id}/validate`),
  markPaid: (id: number) => api.post(`/payruns/${id}/mark-paid`),
  sendPayslips: (id: number) => api.post(`/payruns/${id}/send-payslips`),
  exportExcelUrl: (id: number) => `${API_BASE}/payruns/${id}/export-excel`,
  exportCsvUrl: (id: number) => `${API_BASE}/payruns/${id}/export-csv`,
  exportBankCsvUrl: (id: number) => `${API_BASE}/payruns/${id}/export-bank-csv`,
};

// ── Grievances ────────────────────────────────────────────────────────────────
export const grievancesApi = {
  myStatement: () => api.get('/grievances/my-statement'),
  confirm: (payslip_id: number) => api.post(`/grievances/confirm/${payslip_id}`),
  dispute: (payslip_id: number, data: { grievance_category: string; grievance_remarks: string }) =>
    api.post(`/grievances/dispute/${payslip_id}`, data),
  confirmMonth: (month: string) => api.post(`/grievances/confirm-month?month=${encodeURIComponent(month)}`),
  disputeMonth: (month: string, data: { grievance_category: string; grievance_remarks: string }) =>
    api.post(`/grievances/dispute-month?month=${encodeURIComponent(month)}`, data),
  resolve: (payslip_id: number, data: { action: 'accept_adjust' | 'reject'; resolution_notes: string }) =>
    api.post(`/grievances/resolve/${payslip_id}`, data),
};


// ── Payslips ──────────────────────────────────────────────────────────────────
export const payslipsApi = {
  list: (params?: { employee_id?: number; payrun_id?: number; status?: string; skip?: number; limit?: number }) =>
    api.get('/payslips', { params }),
  get: (id: number) => api.get(`/payslips/${id}`),
  /** Returns a URL with token embedded so the browser can download directly without CORS/auth issues */
  pdfUrl: (id: number) => {
    const token = localStorage.getItem('access_token') ?? '';
    return `${API_BASE}/payslips/${id}/pdf?token=${encodeURIComponent(token)}`;
  },
  csvUrl: (id: number) => {
    const token = localStorage.getItem('access_token') ?? '';
    return `${API_BASE}/payslips/${id}/csv?token=${encodeURIComponent(token)}`;
  },
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  kpis: (params?: { period_start?: string; period_end?: string; department_id?: number; employee_type?: string }) =>
    api.get('/dashboard/kpis', { params }),
  homeKpis: (params?: { month?: string; scope?: string }) =>
    api.get('/dashboard/home-kpis', { params }),
  outbox: () => api.get('/dashboard/outbox'),
};
