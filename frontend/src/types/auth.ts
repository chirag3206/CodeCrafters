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
