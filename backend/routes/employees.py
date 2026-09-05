"""
PeoplePay360 — Employee Management Routes
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
import random

from database import get_db
from dependencies import get_current_user, require_hr_manager, require_payroll_manager
from models import (
    Employee, Department, JobPosition, WorkingSchedule, Contract,
    Attendance, TimeOffRequest, TimeOffAllocation, Payslip,
    EmployeeStatus, EmploymentType, UserRole
)
from schemas import (
    EmployeeCreate, EmployeeOut, EmployeeUpdate, SmartButtonCounts,
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
                Employee.work_email.ilike(search_pattern)
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
    emp_out.smart_buttons = _get_smart_buttons(db, emp.id)
    return emp_out


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

    full_name = f"{data.first_name} {data.last_name}"
    avatar_initials = f"{data.first_name[0].upper()}{data.last_name[0].upper()}"
    avatar_color = AVATAR_COLORS[len(full_name) % len(AVATAR_COLORS)]

    # Auto-generate badge_id: find the max existing employee id and increment
    max_id = db.query(Employee).count()
    badge_id = f"EMP-{max_id + 1:03d}"

    emp_data = data.model_dump()
    emp = Employee(
        **emp_data,
        badge_id=badge_id,
        avatar_initials=avatar_initials,
        avatar_color=avatar_color,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)

    emp_out = EmployeeOut.model_validate(emp)
    emp_out.smart_buttons = _get_smart_buttons(db, emp.id)
    return emp_out


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


@router.delete(
    "/employees/{employee_id}",
    response_model=MessageResponse,
    dependencies=[Depends(require_hr_manager)]
)
def archive_employee(
    employee_id: int,
    db: Session = Depends(get_db)
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Archive = set to Inactive (no TERMINATED enum value)
    emp.status = EmployeeStatus.INACTIVE
    db.commit()
    return MessageResponse(
        message=f"Employee {emp.first_name} {emp.last_name} has been archived (set to Inactive)",
        success=True
    )
