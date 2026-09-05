"""
PeoplePay360 — Pydantic Schemas (Request & Response Models)
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from models import (
    AllocationStatus, AttendanceStatus, ComputationType, ContractStatus,
    EmployeeStatus, EmploymentType, LeaveUnit, PayrunStatus, PayslipStatus,
    RuleCategory, TimeOffRequestStatus, UserRole, VerificationStatus
)


# ─────────────────────────────────────────────
#  Auth Schemas
# ─────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class PersonaSwitchRequest(BaseModel):
    persona_key: str  # "alex", "sarah", "david", "elena", "marcus"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    employee_id: Optional[int] = None
    badge_id: Optional[str] = None
    full_name: str


# ─────────────────────────────────────────────
#  Department Schemas
# ─────────────────────────────────────────────

class DepartmentBase(BaseModel):
    name: str
    code: Optional[str] = None


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentOut(DepartmentBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
#  Job Position Schemas
# ─────────────────────────────────────────────

class JobPositionOut(BaseModel):
    id: int
    title: str
    department_id: Optional[int] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
#  Working Schedule Schemas
# ─────────────────────────────────────────────

class ScheduleDayLineOut(BaseModel):
    id: int
    day_of_week: str
    start_time: str
    end_time: str
    break_hours: float
    net_hours: float

    model_config = {"from_attributes": True}


class WorkingScheduleBase(BaseModel):
    name: str
    work_days_summary: Optional[str] = None


class WorkingScheduleCreate(WorkingScheduleBase):
    pass


class WorkingScheduleOut(WorkingScheduleBase):
    id: int
    total_weekly_hours: float
    day_lines: List[ScheduleDayLineOut] = []

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
#  Employee Schemas
# ─────────────────────────────────────────────

class EmployeeBase(BaseModel):
    badge_id: Optional[str] = None
    first_name: str
    last_name: str
    work_email: str
    work_phone: Optional[str] = None
    department_id: Optional[int] = None
    job_position_id: Optional[int] = None
    manager_id: Optional[int] = None
    working_schedule_id: Optional[int] = None
    employment_type: EmploymentType = EmploymentType.FULL_TIME
    status: EmployeeStatus = EmployeeStatus.ACTIVE
    hire_date: Optional[date] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    ifsc_swift: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    work_phone: Optional[str] = None
    department_id: Optional[int] = None
    job_position_id: Optional[int] = None
    manager_id: Optional[int] = None
    working_schedule_id: Optional[int] = None
    employment_type: Optional[EmploymentType] = None
    status: Optional[EmployeeStatus] = None
    hire_date: Optional[date] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    ifsc_swift: Optional[str] = None


class SmartButtonCounts(BaseModel):
    contracts: int = 0
    attendances: int = 0
    time_off_requests: int = 0
    allocation_days: float = 0.0
    payslips: int = 0


class EmployeeOut(EmployeeBase):
    id: int
    full_name: str
    avatar_initials: Optional[str] = None
    avatar_color: Optional[str] = None
    created_at: datetime
    department: Optional[DepartmentOut] = None
    job_position: Optional[JobPositionOut] = None
    working_schedule: Optional[WorkingScheduleOut] = None
    smart_buttons: Optional[SmartButtonCounts] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
#  Contract Schemas
# ─────────────────────────────────────────────

class ContractBase(BaseModel):
    reference: str
    employee_id: int
    salary_structure_id: Optional[int] = None
    working_schedule_id: Optional[int] = None
    wage: float
    start_date: date
    end_date: Optional[date] = None
    notes: Optional[str] = None


class ContractCreate(ContractBase):
    pass


class ContractUpdate(BaseModel):
    wage: Optional[float] = None
    end_date: Optional[date] = None
    status: Optional[ContractStatus] = None
    notes: Optional[str] = None
    salary_structure_id: Optional[int] = None
    working_schedule_id: Optional[int] = None


class ContractOut(ContractBase):
    id: int
    status: ContractStatus
    created_at: datetime
    employee: Optional[EmployeeOut] = None
    salary_structure: Optional["SalaryStructureOut"] = None
    working_schedule: Optional[WorkingScheduleOut] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
#  Salary Structure / Rule Schemas
# ─────────────────────────────────────────────

class SalaryRuleBase(BaseModel):
    name: str
    code: str
    category: RuleCategory
    sequence: int
    computation_type: ComputationType
    fixed_amount: float = 0.0
    percentage_base_code: Optional[str] = None
    percentage_value: float = 0.0
    formula_expression: Optional[str] = None
    is_active: bool = True


class SalaryRuleCreate(SalaryRuleBase):
    structure_id: int


class SalaryRuleOut(SalaryRuleBase):
    id: int
    structure_id: int

    model_config = {"from_attributes": True}


class SalaryStructureBase(BaseModel):
    name: str
    code: str
    is_active: bool = True


class SalaryStructureCreate(SalaryStructureBase):
    pass


class SalaryStructureOut(SalaryStructureBase):
    id: int
    created_at: datetime
    rules: List[SalaryRuleOut] = []
    rules_count: int = 0
    contracts_count: int = 0

    model_config = {"from_attributes": True}


ContractOut.model_rebuild()


# ─────────────────────────────────────────────
#  Attendance Schemas
# ─────────────────────────────────────────────

class AttendancePunchRequest(BaseModel):
    action: str  # "check_in" or "check_out"
    timestamp: Optional[datetime] = None


class AttendanceCorrectionRequest(BaseModel):
    status: Optional[AttendanceStatus] = None
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    correction_notes: str


class AttendanceOut(BaseModel):
    id: int
    employee_id: int
    date: date
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    worked_hours: float
    overtime_hours: float
    status: AttendanceStatus
    is_manual_correction: bool
    correction_notes: Optional[str] = None
    employee: Optional[EmployeeOut] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
#  Time Off Schemas
# ─────────────────────────────────────────────

class TimeOffTypeOut(BaseModel):
    id: int
    name: str
    unit: LeaveUnit
    requires_allocation: bool
    is_paid: bool
    color: Optional[str] = None
    max_days_per_year: Optional[float] = None

    model_config = {"from_attributes": True}


class TimeOffAllocationOut(BaseModel):
    id: int
    employee_id: int
    leave_type_id: int
    allocated_days: float
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    status: AllocationStatus
    approved_taken: float = 0.0
    pending_days: float = 0.0
    remaining_balance: float = 0.0
    employee: Optional[EmployeeOut] = None
    leave_type: Optional[TimeOffTypeOut] = None

    model_config = {"from_attributes": True}


class TimeOffRequestCreate(BaseModel):
    leave_type_id: int
    start_date: date
    end_date: date
    reason: Optional[str] = None


class TimeOffRequestOut(BaseModel):
    id: int
    employee_id: int
    leave_type_id: int
    start_date: date
    end_date: date
    duration_days: float
    reason: Optional[str] = None
    status: TimeOffRequestStatus
    approved_at: Optional[datetime] = None
    created_at: datetime
    employee: Optional[EmployeeOut] = None
    leave_type: Optional[TimeOffTypeOut] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
#  Payrun Schemas
# ─────────────────────────────────────────────

class PayrunCreateStep1(BaseModel):
    name: str
    period_start: date
    period_end: date
    salary_structure_id: int
    department_id: Optional[int] = None
    employee_type: Optional[str] = None  # "Full-Time", "Part-Time", etc.


class PayrunCandidateOut(BaseModel):
    employee_id: int
    badge_id: Optional[str] = None
    full_name: str
    department: Optional[str] = None
    job_position: Optional[str] = None
    contract_reference: Optional[str] = None
    contract_wage: Optional[float] = None
    has_valid_contract: bool
    has_bank_details: bool
    has_duplicate_payslip: bool
    verification_status: Optional[str] = "Pending"
    warnings: List[str] = []

    model_config = {"from_attributes": True}



class PayrunCreateStep2(BaseModel):
    step1_data: PayrunCreateStep1
    selected_employee_ids: List[int]


class PayrunOut(BaseModel):
    id: int
    reference: str
    name: str
    period_start: date
    period_end: date
    status: PayrunStatus
    total_gross: float
    total_deductions: float
    total_net: float
    warnings_count: int
    created_at: datetime
    computed_at: Optional[datetime] = None
    validated_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    salary_structure: Optional[SalaryStructureOut] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
#  Payslip Schemas
# ─────────────────────────────────────────────

class PayslipLineOut(BaseModel):
    id: int
    rule_name: str
    rule_code: str
    category: RuleCategory
    sequence: int
    amount: float

    model_config = {"from_attributes": True}


class PayslipOut(BaseModel):
    id: int
    payrun_id: int
    employee_id: int
    contract_id: Optional[int] = None
    period_start: date
    period_end: date
    scheduled_days: int
    worked_days: float
    paid_leave_days: float
    unpaid_leave_days: float
    overtime_hours: float
    gross_pay: float
    total_deductions: float
    net_pay: float
    status: PayslipStatus
    verification_status: VerificationStatus
    warnings: List[str] = []
    grievance_category: Optional[str] = None
    grievance_remarks: Optional[str] = None
    grievance_resolution_notes: Optional[str] = None
    pdf_path: Optional[str] = None
    created_at: datetime
    employee: Optional[EmployeeOut] = None
    lines: List[PayslipLineOut] = []
    payrun: Optional[PayrunOut] = None

    model_config = {"from_attributes": True}


class GrievanceSubmitRequest(BaseModel):
    grievance_category: str  # "Attendance", "Leave", "Other"
    grievance_remarks: str


class GrievanceResolveRequest(BaseModel):
    action: str  # "accept_adjust" or "reject"
    resolution_notes: str


# ─────────────────────────────────────────────
#  Pre-Payroll Statement Schema
# ─────────────────────────────────────────────

class PrePayrollStatementOut(BaseModel):
    payslip_id: int
    employee_name: str
    badge_id: Optional[str] = None
    period_start: date
    period_end: date
    scheduled_days: int
    actual_clocked_days: float
    paid_leave_days: float
    unpaid_leave_days: float
    overtime_hours: float
    verification_status: VerificationStatus
    grievance_category: Optional[str] = None
    grievance_remarks: Optional[str] = None


# ─────────────────────────────────────────────
#  Dashboard Schemas
# ─────────────────────────────────────────────

class AttendanceMetrics(BaseModel):
    present: int = 0
    late: int = 0
    absent: int = 0
    overtime_count: int = 0
    missing_checkouts: int = 0
    manual_edits: int = 0
    attendance_coverage_pct: float = 0.0
    health_score: float = 0.0


class DashboardKPIOut(BaseModel):
    total_net_salary_paid: float = 0.0
    payslips_generated: int = 0
    payslips_draft: int = 0
    payslips_validated: int = 0
    payslips_paid: int = 0
    average_salary: float = 0.0
    approved_time_off_days: float = 0.0
    attendance_health_score: float = 0.0
    attendance: AttendanceMetrics
    salary_by_department: List[Dict[str, Any]] = []
    monthly_net_trend: List[Dict[str, Any]] = []
    attendance_status_breakdown: List[Dict[str, Any]] = []


# ─────────────────────────────────────────────
#  Email Outbox Schema
# ─────────────────────────────────────────────

class EmailOutboxOut(BaseModel):
    id: int
    recipient_email: str
    recipient_name: str
    subject: str
    body_html: str
    email_type: str
    status: str
    sent_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
#  Generic Response
# ─────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str
    success: bool = True


# ─────────────────────────────────────────────
#  Office Hours Notification Schemas
# ─────────────────────────────────────────────

class OfficeHoursUpdateRequest(BaseModel):
    start_time: str = "09:00"
    end_time: str = "18:00"
    break_hours: float = 1.0
    grace_minutes: int = 45
    effective_date: date
    reason: str
    work_days_summary: Optional[str] = None


class OfficeHoursNotificationOut(BaseModel):
    id: int
    title: str
    message: str
    old_start_time: str
    old_end_time: str
    new_start_time: str
    new_end_time: str
    grace_minutes: int
    effective_date: date
    reason: str
    updated_by_name: str
    created_at: datetime
    expires_at: datetime

    model_config = {"from_attributes": True}

