// PeoplePay360 — Shared TypeScript Types

export type UserRole =
  | 'Employee'
  | 'HR_Manager'
  | 'HR_Payroll_User'
  | 'HR_Payroll_Manager'
  | 'Admin';

export interface AuthUser {
  access_token: string;
  token_type: string;
  role: UserRole;
  user_id: number;
  employee_id: number | null;
  badge_id: string | null;
  full_name: string;
}

export interface Department {
  id: number;
  name: string;
  code: string | null;
  created_at: string;
}

export interface JobPosition {
  id: number;
  title: string;
  department_id: number | null;
}

export interface WorkingSchedule {
  id: number;
  name: string;
  total_weekly_hours: number;
  work_days_summary: string | null;
  day_lines: ScheduleDayLine[];
}

export interface ScheduleDayLine {
  id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  break_hours: number;
  net_hours: number;
}

export interface SmartButtonCounts {
  contracts: number;
  attendances: number;
  time_off_requests: number;
  allocation_days: number;
  payslips: number;
}

export interface Employee {
  id: number;
  badge_id: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  work_email: string;
  work_phone: string | null;
  department_id: number | null;
  job_position_id: number | null;
  manager_id: number | null;
  working_schedule_id: number | null;
  employment_type: 'Full-Time' | 'Part-Time' | 'Contractor';
  status: 'Active' | 'Inactive' | 'On Leave';
  hire_date: string | null;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  ifsc_swift: string | null;
  avatar_initials: string | null;
  avatar_color: string | null;
  created_at: string;
  department: Department | null;
  job_position: JobPosition | null;
  working_schedule: WorkingSchedule | null;
  smart_buttons: SmartButtonCounts | null;
}

export interface Contract {
  id: number;
  reference: string;
  employee_id: number;
  salary_structure_id: number | null;
  working_schedule_id: number | null;
  wage: number;
  start_date: string;
  end_date: string | null;
  status: 'Draft' | 'Active' | 'Expired' | 'Terminated';
  notes: string | null;
  created_at: string;
  employee: Employee | null;
  salary_structure: SalaryStructure | null;
  working_schedule: WorkingSchedule | null;
}

export interface SalaryRule {
  id: number;
  structure_id: number;
  name: string;
  code: string;
  category: 'BASIC' | 'ALLOWANCE' | 'GROSS' | 'DEDUCTION' | 'NET';
  sequence: number;
  computation_type: 'fixed' | 'percentage' | 'formula';
  fixed_amount: number;
  percentage_base_code: string | null;
  percentage_value: number;
  formula_expression: string | null;
  is_active: boolean;
}

export interface SalaryStructure {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  rules: SalaryRule[];
  rules_count: number;
  contracts_count: number;
}

export interface Attendance {
  id: number;
  employee_id: number;
  date: string;
  check_in: string | null;
  check_out: string | null;
  worked_hours: number;
  overtime_hours: number;
  status: 'Present' | 'Late' | 'Missing_Checkout' | 'Excused';
  is_manual_correction: boolean;
  correction_notes: string | null;
  employee: Employee | null;
}

export interface TimeOffType {
  id: number;
  name: string;
  unit: 'Days' | 'Hours';
  requires_allocation: boolean;
  is_paid: boolean;
  color: string | null;
  max_days_per_year: number | null;
}

export interface TimeOffAllocation {
  id: number;
  employee_id: number;
  leave_type_id: number;
  allocated_days: number;
  valid_from: string | null;
  valid_to: string | null;
  status: 'Draft' | 'Approved' | 'Refused';
  approved_taken: number;
  pending_days: number;
  remaining_balance: number;
  employee: Employee | null;
  leave_type: TimeOffType | null;
}

export interface TimeOffRequest {
  id: number;
  employee_id: number;
  leave_type_id: number;
  start_date: string;
  end_date: string;
  duration_days: number;
  reason: string | null;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Refused';
  approved_at: string | null;
  created_at: string;
  employee: Employee | null;
  leave_type: TimeOffType | null;
}

export interface PayslipLine {
  id: number;
  rule_name: string;
  rule_code: string;
  category: string;
  sequence: number;
  amount: number;
}

export interface Payrun {
  id: number;
  reference: string;
  name: string;
  period_start: string;
  period_end: string;
  status: 'Draft' | 'Computed' | 'Pre_Verification' | 'Validated' | 'Paid';
  total_gross: number;
  total_deductions: number;
  total_net: number;
  warnings_count: number;
  created_at: string;
  computed_at: string | null;
  validated_at: string | null;
  paid_at: string | null;
  salary_structure: SalaryStructure | null;
}

export interface Payslip {
  id: number;
  payrun_id: number;
  employee_id: number;
  contract_id: number | null;
  period_start: string;
  period_end: string;
  scheduled_days: number;
  worked_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  overtime_hours: number;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  status: 'Draft' | 'Computed' | 'Validated' | 'Paid';
  verification_status: 'Pending' | 'Confirmed' | 'Disputed' | 'Resolved';
  warnings?: string[];
  warnings_json?: string | null;
  grievance_category: string | null;
  grievance_remarks: string | null;
  grievance_resolution_notes: string | null;
  pdf_path: string | null;
  created_at: string;
  employee: Employee | null;
  lines: PayslipLine[];
  payrun: Payrun | null;
}

export interface PrePayrollStatementOut {
  payslip_id: number;
  employee_name: string;
  period_start: string;
  period_end: string;
  scheduled_days: number;
  actual_clocked_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  overtime_hours: number;
  verification_status: string;
  grievance_category?: string | null;
  grievance_remarks?: string | null;
}
