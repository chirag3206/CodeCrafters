"""
PeoplePay360 — Complete SQLAlchemy ORM Models
17 tables covering the full HR & Payroll domain.
"""
from __future__ import annotations

import enum
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum, Float, ForeignKey,
    Integer, String, Text, UniqueConstraint, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


# ─────────────────────────────────────────────
#  Enumerations
# ─────────────────────────────────────────────

class UserRole(str, enum.Enum):
    EMPLOYEE = "Employee"
    HR_MANAGER = "HR_Manager"
    HR_PAYROLL_USER = "HR_Payroll_User"
    HR_PAYROLL_MANAGER = "HR_Payroll_Manager"
    ADMIN = "Admin"


class EmploymentType(str, enum.Enum):
    FULL_TIME = "Full-Time"
    PART_TIME = "Part-Time"
    CONTRACTOR = "Contractor"
    INTERN = "Intern"


class EmployeeStatus(str, enum.Enum):
    ACTIVE = "Active"
    INACTIVE = "Inactive"
    ON_LEAVE = "On Leave"
    RETIRED = "Retired"
    TERMINATED = "Terminated"
    LEFT_JOB = "Left Job"
    RESIGNED = "Resigned"


class ContractStatus(str, enum.Enum):
    DRAFT = "Draft"
    ACTIVE = "Active"
    EXPIRED = "Expired"
    TERMINATED = "Terminated"


class LeaveUnit(str, enum.Enum):
    DAYS = "Days"
    HOURS = "Hours"


class TimeOffRequestStatus(str, enum.Enum):
    DRAFT = "Draft"
    SUBMITTED = "Submitted"
    APPROVED = "Approved"
    REFUSED = "Refused"


class AllocationStatus(str, enum.Enum):
    DRAFT = "Draft"
    APPROVED = "Approved"
    REFUSED = "Refused"


class AttendanceStatus(str, enum.Enum):
    PRESENT = "Present"
    LATE = "Late"
    MISSING_CHECKOUT = "Missing_Checkout"
    EXCUSED = "Excused"


class PayrunStatus(str, enum.Enum):
    DRAFT = "Draft"
    COMPUTED = "Computed"
    PRE_VERIFICATION = "Pre_Verification"
    VALIDATED = "Validated"
    PAID = "Paid"


class PayslipStatus(str, enum.Enum):
    DRAFT = "Draft"
    COMPUTED = "Computed"
    VALIDATED = "Validated"
    PAID = "Paid"


class VerificationStatus(str, enum.Enum):
    PENDING = "Pending"
    CONFIRMED = "Confirmed"
    DISPUTED = "Disputed"
    RESOLVED = "Resolved"


class ComputationType(str, enum.Enum):
    FIXED = "fixed"
    PERCENTAGE = "percentage"
    FORMULA = "formula"


class RuleCategory(str, enum.Enum):
    BASIC = "BASIC"
    ALLOWANCE = "ALLOWANCE"
    GROSS = "GROSS"
    DEDUCTION = "DEDUCTION"
    NET = "NET"


class EmailStatus(str, enum.Enum):
    QUEUED = "Queued"
    SENT = "Sent"
    FAILED = "Failed"


# ─────────────────────────────────────────────
#  Table 1: Departments
# ─────────────────────────────────────────────

class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    # Relationships
    employees: Mapped[List["Employee"]] = relationship("Employee", back_populates="department")
    job_positions: Mapped[List["JobPosition"]] = relationship("JobPosition", back_populates="department")


# ─────────────────────────────────────────────
#  Table 2: Job Positions
# ─────────────────────────────────────────────

class JobPosition(Base):
    __tablename__ = "job_positions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    department_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("departments.id"))

    # Relationships
    department: Mapped[Optional["Department"]] = relationship("Department", back_populates="job_positions")
    employees: Mapped[List["Employee"]] = relationship("Employee", back_populates="job_position")


# ─────────────────────────────────────────────
#  Table 3: Working Schedules
# ─────────────────────────────────────────────

class WorkingSchedule(Base):
    __tablename__ = "working_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    total_weekly_hours: Mapped[float] = mapped_column(Float, default=40.0)
    work_days_summary: Mapped[Optional[str]] = mapped_column(String(200))  # "Mon - Fri, 09:00 - 18:00"

    # Relationships
    day_lines: Mapped[List["ScheduleDayLine"]] = relationship(
        "ScheduleDayLine", back_populates="schedule", cascade="all, delete-orphan"
    )
    employees: Mapped[List["Employee"]] = relationship("Employee", back_populates="working_schedule")
    contracts: Mapped[List["Contract"]] = relationship("Contract", back_populates="working_schedule")


# ─────────────────────────────────────────────
#  Table 4: Schedule Day Lines
# ─────────────────────────────────────────────

class ScheduleDayLine(Base):
    __tablename__ = "schedule_day_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    schedule_id: Mapped[int] = mapped_column(Integer, ForeignKey("working_schedules.id"), nullable=False)
    day_of_week: Mapped[str] = mapped_column(String(10), nullable=False)  # "Monday" … "Sunday"
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)    # "09:00"
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)      # "18:00"
    break_hours: Mapped[float] = mapped_column(Float, default=1.0)
    net_hours: Mapped[float] = mapped_column(Float, default=8.0)

    # Relationships
    schedule: Mapped["WorkingSchedule"] = relationship("WorkingSchedule", back_populates="day_lines")


# ─────────────────────────────────────────────
#  Table 5: Users (Auth)
# ─────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False, default=UserRole.EMPLOYEE)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    # Relationships
    employee: Mapped[Optional["Employee"]] = relationship("Employee", back_populates="user", uselist=False)


# ─────────────────────────────────────────────
#  Table 6: Employees
# ─────────────────────────────────────────────

class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    badge_id: Mapped[Optional[str]] = mapped_column(String(20), unique=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), unique=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    work_email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    work_phone: Mapped[Optional[str]] = mapped_column(String(30))
    department_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("departments.id"))
    job_position_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("job_positions.id"))
    manager_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("employees.id"))
    working_schedule_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("working_schedules.id"))
    employment_type: Mapped[EmploymentType] = mapped_column(Enum(EmploymentType), default=EmploymentType.FULL_TIME)
    status: Mapped[EmployeeStatus] = mapped_column(Enum(EmployeeStatus), default=EmployeeStatus.ACTIVE)
    hire_date: Mapped[Optional[date]] = mapped_column(Date)
    # Personal Info
    gender: Mapped[Optional[str]] = mapped_column(String(20))
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    address: Mapped[Optional[str]] = mapped_column(Text)
    # Bank Credentials
    bank_name: Mapped[Optional[str]] = mapped_column(String(100))
    bank_account_no: Mapped[Optional[str]] = mapped_column(String(50))
    ifsc_swift: Mapped[Optional[str]] = mapped_column(String(30))
    # Avatar
    avatar_initials: Mapped[Optional[str]] = mapped_column(String(5))
    avatar_color: Mapped[Optional[str]] = mapped_column(String(10))
    # Departure & Offboarding Tracking
    departure_reason: Mapped[Optional[str]] = mapped_column(String(100))
    departure_date: Mapped[Optional[date]] = mapped_column(Date)
    departure_notes: Mapped[Optional[str]] = mapped_column(Text)
    # Offboarding Leave Encashment Tracking (EL / Paid Leaves)
    leave_encashment_days: Mapped[Optional[float]] = mapped_column(Float, default=0.0)
    leave_encashment_amount: Mapped[Optional[float]] = mapped_column(Float, default=0.0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="employee")
    department: Mapped[Optional["Department"]] = relationship("Department", back_populates="employees")
    job_position: Mapped[Optional["JobPosition"]] = relationship("JobPosition", back_populates="employees")
    manager: Mapped[Optional["Employee"]] = relationship("Employee", remote_side="Employee.id", foreign_keys=[manager_id])
    working_schedule: Mapped[Optional["WorkingSchedule"]] = relationship("WorkingSchedule", back_populates="employees")
    contracts: Mapped[List["Contract"]] = relationship("Contract", back_populates="employee", foreign_keys="Contract.employee_id")
    attendances: Mapped[List["Attendance"]] = relationship("Attendance", back_populates="employee", foreign_keys="Attendance.employee_id")
    leave_requests: Mapped[List["TimeOffRequest"]] = relationship("TimeOffRequest", back_populates="employee", foreign_keys="TimeOffRequest.employee_id")
    allocations: Mapped[List["TimeOffAllocation"]] = relationship("TimeOffAllocation", back_populates="employee", foreign_keys="TimeOffAllocation.employee_id")
    payslips: Mapped[List["Payslip"]] = relationship("Payslip", back_populates="employee")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


# ─────────────────────────────────────────────
#  Table 7: Salary Structures
# ─────────────────────────────────────────────

class SalaryStructure(Base):
    __tablename__ = "salary_structures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    # Relationships
    rules: Mapped[List["SalaryRule"]] = relationship(
        "SalaryRule", back_populates="structure", cascade="all, delete-orphan", order_by="SalaryRule.sequence"
    )
    contracts: Mapped[List["Contract"]] = relationship("Contract", back_populates="salary_structure")
    payruns: Mapped[List["Payrun"]] = relationship("Payrun", back_populates="salary_structure")


# ─────────────────────────────────────────────
#  Table 8: Salary Rules
# ─────────────────────────────────────────────

class SalaryRule(Base):
    __tablename__ = "salary_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    structure_id: Mapped[int] = mapped_column(Integer, ForeignKey("salary_structures.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)  # "BASIC", "HRA", "NET_SALARY"
    category: Mapped[RuleCategory] = mapped_column(Enum(RuleCategory), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    computation_type: Mapped[ComputationType] = mapped_column(Enum(ComputationType), nullable=False)
    fixed_amount: Mapped[float] = mapped_column(Float, default=0.0)
    percentage_base_code: Mapped[Optional[str]] = mapped_column(String(50))  # e.g. "BASIC"
    percentage_value: Mapped[float] = mapped_column(Float, default=0.0)      # e.g. 40.0 for 40%
    formula_expression: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    structure: Mapped["SalaryStructure"] = relationship("SalaryStructure", back_populates="rules")

    __table_args__ = (
        UniqueConstraint("structure_id", "code", name="uq_structure_rule_code"),
    )


# ─────────────────────────────────────────────
#  Table 9: Contracts
# ─────────────────────────────────────────────

class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(150))
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    contract_type: Mapped[Optional[str]] = mapped_column(String(50), default="Permanent")
    department_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("departments.id"))
    job_position_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("job_positions.id"))
    salary_structure_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("salary_structures.id"))
    working_schedule_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("working_schedules.id"))
    wage: Mapped[float] = mapped_column(Float, nullable=False)
    payment_frequency: Mapped[Optional[str]] = mapped_column(String(20), default="Monthly")
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[date]] = mapped_column(Date)  # NULL = Indefinite
    status: Mapped[ContractStatus] = mapped_column(Enum(ContractStatus), default=ContractStatus.DRAFT)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    # Relationships
    employee: Mapped["Employee"] = relationship("Employee", back_populates="contracts", foreign_keys=[employee_id])
    department: Mapped[Optional["Department"]] = relationship("Department")
    job_position: Mapped[Optional["JobPosition"]] = relationship("JobPosition")
    salary_structure: Mapped[Optional["SalaryStructure"]] = relationship("SalaryStructure", back_populates="contracts")
    working_schedule: Mapped[Optional["WorkingSchedule"]] = relationship("WorkingSchedule", back_populates="contracts")
    payslips: Mapped[List["Payslip"]] = relationship("Payslip", back_populates="contract")


# ─────────────────────────────────────────────
#  Table 10: Time Off Types
# ─────────────────────────────────────────────

class TimeOffType(Base):
    __tablename__ = "time_off_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    unit: Mapped[LeaveUnit] = mapped_column(Enum(LeaveUnit), default=LeaveUnit.DAYS)
    requires_allocation: Mapped[bool] = mapped_column(Boolean, default=True)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=True)  # False = Loss of Pay (LOP)
    allow_carry_forward: Mapped[bool] = mapped_column(Boolean, default=True)  # True = Paid leaves (EL) carry forward to next calendar year
    color: Mapped[Optional[str]] = mapped_column(String(20), default="#4F46E5")
    max_days_per_year: Mapped[Optional[float]] = mapped_column(Float)

    # Relationships
    allocations: Mapped[List["TimeOffAllocation"]] = relationship("TimeOffAllocation", back_populates="leave_type")
    requests: Mapped[List["TimeOffRequest"]] = relationship("TimeOffRequest", back_populates="leave_type")


# ─────────────────────────────────────────────
#  Table 11: Time Off Allocations
# ─────────────────────────────────────────────

class TimeOffAllocation(Base):
    __tablename__ = "time_off_allocations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    leave_type_id: Mapped[int] = mapped_column(Integer, ForeignKey("time_off_types.id"), nullable=False)
    allocated_days: Mapped[float] = mapped_column(Float, nullable=False)
    carried_forward_days: Mapped[float] = mapped_column(Float, default=0.0)  # Carried forward EL balance
    valid_from: Mapped[Optional[date]] = mapped_column(Date)
    valid_to: Mapped[Optional[date]] = mapped_column(Date)
    status: Mapped[AllocationStatus] = mapped_column(Enum(AllocationStatus), default=AllocationStatus.DRAFT)
    approved_by_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("employees.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    # Relationships
    employee: Mapped["Employee"] = relationship("Employee", back_populates="allocations", foreign_keys=[employee_id])
    leave_type: Mapped["TimeOffType"] = relationship("TimeOffType", back_populates="allocations")


# ─────────────────────────────────────────────
#  Table 12: Time Off Requests
# ─────────────────────────────────────────────

class TimeOffRequest(Base):
    __tablename__ = "time_off_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    leave_type_id: Mapped[int] = mapped_column(Integer, ForeignKey("time_off_types.id"), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    duration_days: Mapped[float] = mapped_column(Float, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[TimeOffRequestStatus] = mapped_column(Enum(TimeOffRequestStatus), default=TimeOffRequestStatus.DRAFT)
    approved_by_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("employees.id"))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    # Relationships
    employee: Mapped["Employee"] = relationship("Employee", back_populates="leave_requests", foreign_keys=[employee_id])
    leave_type: Mapped["TimeOffType"] = relationship("TimeOffType", back_populates="requests")


# ─────────────────────────────────────────────
#  Table 13: Attendance
# ─────────────────────────────────────────────

class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    check_in: Mapped[Optional[datetime]] = mapped_column(DateTime)
    check_out: Mapped[Optional[datetime]] = mapped_column(DateTime)
    worked_hours: Mapped[float] = mapped_column(Float, default=0.0)
    overtime_hours: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[AttendanceStatus] = mapped_column(Enum(AttendanceStatus), default=AttendanceStatus.PRESENT)
    is_manual_correction: Mapped[bool] = mapped_column(Boolean, default=False)
    correction_notes: Mapped[Optional[str]] = mapped_column(Text)
    corrected_by_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("employees.id"))
    corrected_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relationships
    employee: Mapped["Employee"] = relationship("Employee", back_populates="attendances", foreign_keys=[employee_id])

    __table_args__ = (
        UniqueConstraint("employee_id", "date", name="uq_employee_date"),
    )


# ─────────────────────────────────────────────
#  Table 14: Payruns
# ─────────────────────────────────────────────

class Payrun(Base):
    __tablename__ = "payruns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    reference: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    salary_structure_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("salary_structures.id"))
    department_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("departments.id"))  # NULL = All
    employee_type: Mapped[Optional[str]] = mapped_column(String(20))  # "Full-Time", "All"
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[PayrunStatus] = mapped_column(Enum(PayrunStatus), default=PayrunStatus.DRAFT)
    total_gross: Mapped[float] = mapped_column(Float, default=0.0)
    total_deductions: Mapped[float] = mapped_column(Float, default=0.0)
    total_net: Mapped[float] = mapped_column(Float, default=0.0)
    warnings_count: Mapped[int] = mapped_column(Integer, default=0)
    created_by_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("employees.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    computed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    validated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relationships
    salary_structure: Mapped[Optional["SalaryStructure"]] = relationship("SalaryStructure", back_populates="payruns")
    payslips: Mapped[List["Payslip"]] = relationship("Payslip", back_populates="payrun", cascade="all, delete-orphan")


# ─────────────────────────────────────────────
#  Table 15: Payslips
# ─────────────────────────────────────────────

class Payslip(Base):
    __tablename__ = "payslips"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    payrun_id: Mapped[int] = mapped_column(Integer, ForeignKey("payruns.id"), nullable=False)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    contract_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("contracts.id"))
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    # Attendance metrics snapshot
    scheduled_days: Mapped[int] = mapped_column(Integer, default=0)
    worked_days: Mapped[float] = mapped_column(Float, default=0.0)
    paid_leave_days: Mapped[float] = mapped_column(Float, default=0.0)
    unpaid_leave_days: Mapped[float] = mapped_column(Float, default=0.0)
    leave_encashment_days: Mapped[float] = mapped_column(Float, default=0.0)
    leave_encashment_amount: Mapped[float] = mapped_column(Float, default=0.0)
    overtime_hours: Mapped[float] = mapped_column(Float, default=0.0)
    # Financials
    gross_pay: Mapped[float] = mapped_column(Float, default=0.0)
    total_deductions: Mapped[float] = mapped_column(Float, default=0.0)
    net_pay: Mapped[float] = mapped_column(Float, default=0.0)
    # Status
    status: Mapped[PayslipStatus] = mapped_column(Enum(PayslipStatus), default=PayslipStatus.DRAFT)
    verification_status: Mapped[VerificationStatus] = mapped_column(Enum(VerificationStatus), default=VerificationStatus.PENDING)
    warnings_json: Mapped[Optional[str]] = mapped_column(Text)  # JSON array of warning strings
    # Grievance
    grievance_category: Mapped[Optional[str]] = mapped_column(String(100))
    grievance_remarks: Mapped[Optional[str]] = mapped_column(Text)
    grievance_resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    grievance_resolution_notes: Mapped[Optional[str]] = mapped_column(Text)
    # Delivery
    pdf_path: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    # Relationships
    payrun: Mapped["Payrun"] = relationship("Payrun", back_populates="payslips")
    employee: Mapped["Employee"] = relationship("Employee", back_populates="payslips")
    contract: Mapped[Optional["Contract"]] = relationship("Contract", back_populates="payslips")
    lines: Mapped[List["PayslipLine"]] = relationship(
        "PayslipLine", back_populates="payslip", cascade="all, delete-orphan", order_by="PayslipLine.sequence"
    )


# ─────────────────────────────────────────────
#  Table 16: Payslip Lines
# ─────────────────────────────────────────────

class PayslipLine(Base):
    __tablename__ = "payslip_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    payslip_id: Mapped[int] = mapped_column(Integer, ForeignKey("payslips.id"), nullable=False)
    rule_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("salary_rules.id"))
    rule_name: Mapped[str] = mapped_column(String(150), nullable=False)
    rule_code: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[RuleCategory] = mapped_column(Enum(RuleCategory), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[float] = mapped_column(Float, default=0.0)

    # Relationships
    payslip: Mapped["Payslip"] = relationship("Payslip", back_populates="lines")


# ─────────────────────────────────────────────
#  Table 17: Emails Outbox
# ─────────────────────────────────────────────

class EmailOutbox(Base):
    __tablename__ = "emails_outbox"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    payslip_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("payslips.id"))
    payrun_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("payruns.id"))
    recipient_email: Mapped[str] = mapped_column(String(255), nullable=False)
    recipient_name: Mapped[str] = mapped_column(String(200), nullable=False)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body_html: Mapped[str] = mapped_column(Text, nullable=False)
    email_type: Mapped[str] = mapped_column(String(50))  # "payslip", "pre_verification", "grievance"
    status: Mapped[EmailStatus] = mapped_column(Enum(EmailStatus), default=EmailStatus.QUEUED)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())


# ─────────────────────────────────────────────
#  Table 18: Office Hours Notifications (3-Day Broadcast)
# ─────────────────────────────────────────────

class OfficeHoursNotification(Base):
    __tablename__ = "office_hours_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), default="Company Office Timings Updated")
    message: Mapped[str] = mapped_column(Text, nullable=False)
    old_start_time: Mapped[str] = mapped_column(String(10), default="09:00")
    old_end_time: Mapped[str] = mapped_column(String(10), default="18:00")
    new_start_time: Mapped[str] = mapped_column(String(10), default="09:00")
    new_end_time: Mapped[str] = mapped_column(String(10), default="18:00")
    grace_minutes: Mapped[int] = mapped_column(Integer, default=45)
    effective_date: Mapped[date] = mapped_column(Date, default=date.today)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    updated_by_name: Mapped[str] = mapped_column(String(100), default="System Administrator")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


# ─────────────────────────────────────────────
#  Table 19: Pre-Payroll Monthly Verifications & Grievance Ledger
# ─────────────────────────────────────────────

class PrePayrollVerification(Base):
    __tablename__ = "pre_payroll_verifications"
    __table_args__ = (
        UniqueConstraint("employee_id", "month", name="uq_emp_month_verification"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    month: Mapped[str] = mapped_column(String(7), nullable=False, index=True)  # "YYYY-MM" e.g. "2026-08"
    status: Mapped[VerificationStatus] = mapped_column(Enum(VerificationStatus), default=VerificationStatus.PENDING)
    grievance_category: Mapped[Optional[str]] = mapped_column(String(100))
    grievance_remarks: Mapped[Optional[str]] = mapped_column(Text)
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    resolved_by_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("employees.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    employee: Mapped["Employee"] = relationship("Employee", foreign_keys=[employee_id])
    resolved_by: Mapped[Optional["Employee"]] = relationship("Employee", foreign_keys=[resolved_by_id])


# ─────────────────────────────────────────────
#  Table 20: Attendance Period Lock (HR Approval & Lock for Payroll)
# ─────────────────────────────────────────────

class AttendancePeriodLock(Base):
    __tablename__ = "attendance_period_locks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    month: Mapped[str] = mapped_column(String(7), unique=True, nullable=False, index=True)  # "YYYY-MM"
    is_locked: Mapped[bool] = mapped_column(Boolean, default=True)
    locked_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    locked_by_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("employees.id"))
    approval_notes: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    locked_by: Mapped[Optional["Employee"]] = relationship("Employee", foreign_keys=[locked_by_id])



