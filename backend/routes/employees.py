"""
PeoplePay360 — Employee Management Routes
"""
import re
import secrets
import string
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from auth import hash_password
from database import get_db
from dependencies import get_current_user, require_hr_manager, require_payroll_manager
from models import (
    Employee, Department, JobPosition, WorkingSchedule, Contract, ContractStatus,
    Attendance, TimeOffRequest, TimeOffAllocation, Payslip, SalaryStructure, User,
    EmployeeStatus, EmploymentType, UserRole
)
from schemas import (
    EmployeeCreate, EmployeeOut, EmployeeUpdate, EmployeeOffboardRequest, SmartButtonCounts,
    DepartmentOut, JobPositionOut, WorkingScheduleOut, MessageResponse
)

router = APIRouter(prefix="/api", tags=["Employees"])

AVATAR_COLORS = [
    "#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444",
    "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#6366F1"
]


def _get_smart_buttons(db: Session, employee_id: int) -> SmartButtonCounts:
    contracts_count = db.query(func.count(Contract.id)).filter(Contract.employee_id == employee_id).scalar() or 0
    attendances_count = db.query(func.count(Attendance.id)).filter(Attendance.employee_id == employee_id).scalar() or 0
    time_off_count = db.query(func.count(TimeOffRequest.id)).filter(TimeOffRequest.employee_id == employee_id).scalar() or 0
    payslips_count = db.query(func.count(Payslip.id)).filter(Payslip.employee_id == employee_id).scalar() or 0

    total_alloc_days = db.query(func.coalesce(func.sum(TimeOffAllocation.allocated_days), 0.0)).filter(
        TimeOffAllocation.employee_id == employee_id
    ).scalar() or 0.0

    return SmartButtonCounts(
        contracts=contracts_count,
        attendances=attendances_count,
        time_off_requests=time_off_count,
        allocation_days=float(total_alloc_days),
        payslips=payslips_count,
    )


# ─── DEPARTMENTS / POSITIONS / SCHEDULES ────────────────────────────────────

@router.get("/departments", response_model=List[DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    return db.query(Department).order_by(Department.name).all()


@router.get("/job-positions", response_model=List[JobPositionOut])
def list_job_positions(department_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(JobPosition)
    if department_id:
        query = query.filter(JobPosition.department_id == department_id)
    return query.order_by(JobPosition.title).all()


@router.get("/working-schedules", response_model=List[WorkingScheduleOut])
def list_working_schedules(db: Session = Depends(get_db)):
    return db.query(WorkingSchedule).all()


# ─── EMPLOYEES CRUD ──────────────────────────────────────────────────────────

@router.get("/employees", response_model=List[EmployeeOut])
def list_employees(
    q: Optional[str] = None,
    department_id: Optional[int] = None,
    status_filter: Optional[EmployeeStatus] = Query(None, alias="status"),
    employment_type: Optional[EmploymentType] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = db.query(Employee)

    # RBAC: Employees only see their own profile
    if current_user.role == UserRole.EMPLOYEE:
        emp_record = current_user.employee
        if emp_record:
            query = query.filter(Employee.id == emp_record.id)
        else:
            return []

    if q:
        search_pattern = f"%{q}%"
        query = query.filter(
            or_(
                Employee.first_name.ilike(search_pattern),
                Employee.last_name.ilike(search_pattern),
                Employee.work_email.ilike(search_pattern),
                Employee.badge_id.ilike(search_pattern),
            )
        )

    if department_id:
        query = query.filter(Employee.department_id == department_id)

    if status_filter:
        query = query.filter(Employee.status == status_filter)

    if employment_type:
        query = query.filter(Employee.employment_type == employment_type)

    employees = query.order_by(Employee.first_name, Employee.last_name).offset(skip).limit(limit).all()

    result = []
    for emp in employees:
        emp_out = EmployeeOut.model_validate(emp)
        emp_out.has_user_account = emp.user is not None
        emp_out.user_id = emp.user.id if emp.user else None
        emp_out.smart_buttons = _get_smart_buttons(db, emp.id)
        result.append(emp_out)

    return result


@router.get("/employees/{employee_id}", response_model=EmployeeOut)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # RBAC check — employees can only view their own profile
    if current_user.role == UserRole.EMPLOYEE:
        emp_record = current_user.employee
        if not emp_record or emp_record.id != employee_id:
            raise HTTPException(status_code=403, detail="Access denied to this employee record")

    emp_out = EmployeeOut.model_validate(emp)
    emp_out.has_user_account = emp.user is not None
    emp_out.user_id = emp.user.id if emp.user else None
    emp_out.smart_buttons = _get_smart_buttons(db, emp.id)
    return emp_out


def _generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.post(
    "/employees",
    response_model=EmployeeOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_hr_manager)]
)
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(Employee).filter(Employee.work_email == data.work_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Employee with this email already exists")

    # Check if work_email is already a user account
    existing_user = db.query(User).filter(User.email == data.work_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="A user account with this email already exists.")

    full_name = f"{data.first_name} {data.last_name}"
    avatar_initials = f"{data.first_name[0].upper()}{data.last_name[0].upper()}"
    avatar_color = AVATAR_COLORS[len(full_name) % len(AVATAR_COLORS)]

    # Determine badge_id: use supplied badge_id or auto-generate
    custom_badge = (data.badge_id or "").strip()
    if custom_badge:
        # Normalize: strip spaces like 'EMP - 014' -> 'EMP-014', ensure 'EMP-' prefix
        cleaned = re.sub(r"^EMP\s*-\s*", "", custom_badge, flags=re.IGNORECASE).strip()
        badge_id = f"EMP-{cleaned.upper()}"
        existing_badge = db.query(Employee).filter(Employee.badge_id == badge_id).first()
        if existing_badge:
            raise HTTPException(status_code=400, detail=f"Employee ID '{badge_id}' is already in use.")
    else:
        max_id = db.query(Employee).count()
        badge_id = f"EMP-{max_id + 1:03d}"

    # Validate salary structure if provided
    salary_structure_id = data.salary_structure_id
    if salary_structure_id:
        ss = db.query(SalaryStructure).filter(SalaryStructure.id == salary_structure_id).first()
        if not ss:
            raise HTTPException(status_code=400, detail="Salary structure not found.")

    # Build employee dict — exclude our extra non-model fields
    emp_data = data.model_dump(exclude={"initial_password", "salary_structure_id"})
    emp_data["badge_id"] = badge_id
    emp_data["avatar_initials"] = avatar_initials
    emp_data["avatar_color"] = avatar_color

    emp = Employee(**emp_data)
    db.add(emp)
    db.flush()  # get emp.id without committing

    # Auto-create a User login account for this employee
    plain_password = data.initial_password or _generate_temp_password()
    new_user = User(
        email=data.work_email,
        hashed_password=hash_password(plain_password),
        role=UserRole.EMPLOYEE,
        is_active=True,
    )
    db.add(new_user)
    db.flush()  # get new_user.id

    emp.user_id = new_user.id

    db.commit()
    db.refresh(emp)

    emp_out = EmployeeOut.model_validate(emp)
    emp_out.has_user_account = True
    emp_out.user_id = new_user.id
    emp_out.smart_buttons = _get_smart_buttons(db, emp.id)
    # Stash the plain password on the object so the response can relay it ONCE
    # (We add it as an extra field via model_extra — frontend reads it)
    emp_out_dict = emp_out.model_dump()
    emp_out_dict["temp_password"] = plain_password
    return emp_out_dict


@router.put(
    "/employees/{employee_id}",
    response_model=EmployeeOut,
    dependencies=[Depends(require_hr_manager)]
)
def update_employee(
    employee_id: int,
    data: EmployeeUpdate,
    db: Session = Depends(get_db)
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    update_dict = data.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(emp, k, v)

    # Re-compute avatar initials if name changed
    emp.avatar_initials = f"{emp.first_name[0].upper()}{emp.last_name[0].upper()}"

    db.commit()
    db.refresh(emp)

    emp_out = EmployeeOut.model_validate(emp)
    emp_out.smart_buttons = _get_smart_buttons(db, emp.id)
    return emp_out


def _execute_employee_offboard(emp: Employee, reason: str, notes: Optional[str], db: Session) -> MessageResponse:
    reason_clean = (reason or "").strip()
    reason_lower = reason_clean.lower()

    if "retire" in reason_lower:
        new_status = EmployeeStatus.RETIRED
    elif "terminate" in reason_lower:
        new_status = EmployeeStatus.TERMINATED
    elif "left" in reason_lower:
        new_status = EmployeeStatus.LEFT_JOB
    elif "resign" in reason_lower:
        new_status = EmployeeStatus.RESIGNED
    else:
        new_status = EmployeeStatus.INACTIVE

    emp.status = new_status
    emp.departure_reason = reason_clean
    emp.departure_date = date.today()
    if notes:
        emp.departure_notes = notes

    # Deactivate linked user login if present
    if emp.user:
        emp.user.is_active = False

    # Automatically transition all active and draft contracts to Expired
    active_contracts = db.query(Contract).filter(
        Contract.employee_id == emp.id,
        Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.DRAFT])
    ).all()

    for cnt in active_contracts:
        cnt.status = ContractStatus.EXPIRED
        if not cnt.end_date or cnt.end_date > date.today():
            cnt.end_date = date.today()

    db.commit()
    return MessageResponse(
        message=f"Employee {emp.first_name} {emp.last_name} offboarded as '{new_status.value}'. {len(active_contracts)} contract(s) automatically transitioned to Expired.",
        success=True
    )


@router.delete(
    "/employees/{employee_id}",
    response_model=MessageResponse,
    dependencies=[Depends(require_hr_manager)]
)
def delete_employee(
    employee_id: int,
    reason: Optional[str] = Query("Terminated", description="Offboarding reason: Retired, Terminated, Left Job, Resigned, Contract Ended"),
    notes: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    return _execute_employee_offboard(emp, reason or "Terminated", notes, db)


@router.post(
    "/employees/{employee_id}/offboard",
    response_model=MessageResponse,
    dependencies=[Depends(require_hr_manager)]
)
def offboard_employee(
    employee_id: int,
    data: EmployeeOffboardRequest,
    db: Session = Depends(get_db)
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    return _execute_employee_offboard(emp, data.reason, data.notes, db)
