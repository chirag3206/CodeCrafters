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
        emp_out.system_role = emp.user.role if emp.user else None
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
    emp_out.system_role = emp.user.role if emp.user else None
    emp_out.smart_buttons = _get_smart_buttons(db, emp.id)
    return emp_out


def _generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def ensure_all_users_have_employee_and_contract(db: Session):
    """
    Ensures every User has a linked Employee profile, and every Employee (including HR Managers and Admins)
    has an active Contract and default leave allocations so everyone is payroll-ready.
    """
    std_struct = db.query(SalaryStructure).first()
    std_schedule = db.query(WorkingSchedule).first()
    users = db.query(User).all()

    for user in users:
        emp = user.employee
        if not emp:
            emp = db.query(Employee).filter(Employee.work_email == user.email).first()
            if emp:
                emp.user_id = user.id
            else:
                name_parts = user.email.split("@")[0].replace(".", " ").replace("_", " ").title().split()
                first = name_parts[0] if name_parts else "User"
                last = name_parts[1] if len(name_parts) > 1 else str(user.id)
                badge = f"EMP-{user.id:03d}"

                emp = Employee(
                    user_id=user.id,
                    badge_id=badge,
                    first_name=first,
                    last_name=last,
                    work_email=user.email,
                    employment_type=EmploymentType.FULL_TIME,
                    status=EmployeeStatus.ACTIVE,
                    hire_date=date(2026, 1, 1),
                    working_schedule_id=std_schedule.id if std_schedule else None,
                    avatar_initials=f"{first[0].upper()}{last[0].upper()}",
                    avatar_color="#4F46E5",
                )
                db.add(emp)
                db.flush()

    all_employees = db.query(Employee).all()
    current_year = date.today().year

    for emp in all_employees:
        active_contract = db.query(Contract).filter(
            Contract.employee_id == emp.id,
            Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.EXPIRED])
        ).first()

        if not active_contract:
            c = Contract(
                reference=f"CNT-{current_year}-{(emp.first_name or 'EMP').upper()}-{emp.id:02d}",
                employee_id=emp.id,
                salary_structure_id=std_struct.id if std_struct else 1,
                working_schedule_id=emp.working_schedule_id or (std_schedule.id if std_schedule else None),
                wage=55000.0,
                start_date=emp.hire_date or date(2026, 1, 1),
                end_date=None,
                status=ContractStatus.ACTIVE,
            )
            db.add(c)

        alloc_count = db.query(func.count(TimeOffAllocation.id)).filter(TimeOffAllocation.employee_id == emp.id).scalar() or 0
        if alloc_count == 0:
            all_types = db.query(TimeOffType).all()
            for lt in all_types:
                default_days = lt.max_days_per_year if lt.max_days_per_year is not None else 10.0
                alloc = TimeOffAllocation(
                    employee_id=emp.id,
                    leave_type_id=lt.id,
                    allocated_days=default_days,
                    valid_from=date(current_year, 1, 1),
                    valid_to=date(current_year, 12, 31),
                    status=AllocationStatus.APPROVED,
                )
                db.add(alloc)

    db.commit()


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

    existing_user = db.query(User).filter(User.email == data.work_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="A user account with this email already exists.")

    full_name = f"{data.first_name} {data.last_name}"
    avatar_initials = f"{data.first_name[0].upper()}{data.last_name[0].upper()}"
    avatar_color = AVATAR_COLORS[len(full_name) % len(AVATAR_COLORS)]

    custom_badge = (data.badge_id or "").strip()
    if custom_badge:
        cleaned = re.sub(r"^EMP\s*-\s*", "", custom_badge, flags=re.IGNORECASE).strip()
        badge_id = f"EMP-{cleaned.upper()}"
        existing_badge = db.query(Employee).filter(Employee.badge_id == badge_id).first()
        if existing_badge:
            raise HTTPException(status_code=400, detail=f"Employee ID '{badge_id}' is already in use.")
    else:
        max_id = db.query(Employee).count()
        badge_id = f"EMP-{max_id + 1:03d}"

    salary_structure_id = data.salary_structure_id
    if salary_structure_id:
        ss = db.query(SalaryStructure).filter(SalaryStructure.id == salary_structure_id).first()
        if not ss:
            raise HTTPException(status_code=400, detail="Salary structure not found.")

    emp_data = data.model_dump(exclude={"initial_password", "salary_structure_id", "contract_wage", "system_role", "leave_allocations"})
    emp_data["badge_id"] = badge_id
    emp_data["avatar_initials"] = avatar_initials
    emp_data["avatar_color"] = avatar_color

    emp = Employee(**emp_data)
    db.add(emp)
    db.flush()

    current_year = date.today().year

    # Auto-create active employment contract
    default_wage = data.contract_wage or 55000.0
    struct_id = salary_structure_id
    if not struct_id:
        std_st = db.query(SalaryStructure).first()
        struct_id = std_st.id if std_st else 1

    new_contract = Contract(
        reference=f"CNT-{current_year}-{badge_id}",
        employee_id=emp.id,
        salary_structure_id=struct_id,
        working_schedule_id=emp.working_schedule_id,
        wage=default_wage,
        start_date=emp.hire_date or date(current_year, 1, 1),
        end_date=None,
        status=ContractStatus.ACTIVE,
    )
    db.add(new_contract)

    # Create Time Off Allocations for calendar year
    from models import TimeOffType, TimeOffAllocation, AllocationStatus
    if data.leave_allocations:
        for alloc_item in data.leave_allocations:
            alloc = TimeOffAllocation(
                employee_id=emp.id,
                leave_type_id=alloc_item.leave_type_id,
                allocated_days=alloc_item.allocated_days,
                valid_from=date(current_year, 1, 1),
                valid_to=date(current_year, 12, 31),
                status=AllocationStatus.APPROVED,
            )
            db.add(alloc)
    else:
        all_types = db.query(TimeOffType).all()
        for lt in all_types:
            default_days = lt.max_days_per_year if lt.max_days_per_year is not None else 10.0
            alloc = TimeOffAllocation(
                employee_id=emp.id,
                leave_type_id=lt.id,
                allocated_days=default_days,
                valid_from=date(current_year, 1, 1),
                valid_to=date(current_year, 12, 31),
                status=AllocationStatus.APPROVED,
            )
            db.add(alloc)

    # Auto-create a User login account with selected system_role
    chosen_role = data.system_role or UserRole.EMPLOYEE
    plain_password = data.initial_password or _generate_temp_password()
    new_user = User(
        email=data.work_email,
        hashed_password=hash_password(plain_password),
        role=chosen_role,
        is_active=True,
    )
    db.add(new_user)
    db.flush()

    emp.user_id = new_user.id

    db.commit()
    db.refresh(emp)

    emp_out = EmployeeOut.model_validate(emp)
    emp_out.has_user_account = True
    emp_out.user_id = new_user.id
    emp_out.system_role = new_user.role
    emp_out.smart_buttons = _get_smart_buttons(db, emp.id)
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

    update_dict = data.model_dump(exclude_unset=True, exclude={"leave_allocations", "system_role"})
    for k, v in update_dict.items():
        setattr(emp, k, v)

    if data.system_role is not None and emp.user:
        emp.user.role = data.system_role

    emp.avatar_initials = f"{emp.first_name[0].upper()}{emp.last_name[0].upper()}"

    if data.leave_allocations is not None:
        from models import TimeOffAllocation, AllocationStatus
        current_year = date.today().year
        for alloc_item in data.leave_allocations:
            alloc = db.query(TimeOffAllocation).filter(
                TimeOffAllocation.employee_id == emp.id,
                TimeOffAllocation.leave_type_id == alloc_item.leave_type_id
            ).first()
            if alloc:
                alloc.allocated_days = alloc_item.allocated_days
            else:
                alloc = TimeOffAllocation(
                    employee_id=emp.id,
                    leave_type_id=alloc_item.leave_type_id,
                    allocated_days=alloc_item.allocated_days,
                    valid_from=date(current_year, 1, 1),
                    valid_to=date(current_year, 12, 31),
                    status=AllocationStatus.APPROVED,
                )
                db.add(alloc)

    db.commit()
    db.refresh(emp)

    emp_out = EmployeeOut.model_validate(emp)
    emp_out.has_user_account = emp.user is not None
    emp_out.user_id = emp.user.id if emp.user else None
    emp_out.system_role = emp.user.role if emp.user else None
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

    # Calculate Earned Leaves (EL / Paid Leaves) Encashment for final settlement
    from models import TimeOffAllocation, TimeOffRequest, TimeOffRequestStatus, Payslip, PayslipLine, RuleCategory, PayslipStatus
    allocations = db.query(TimeOffAllocation).filter(TimeOffAllocation.employee_id == emp.id).all()

    total_unused_el = 0.0
    for alloc in allocations:
        if alloc.leave_type and alloc.leave_type.is_paid:
            approved_taken = db.query(func.coalesce(func.sum(TimeOffRequest.duration_days), 0.0)).filter(
                TimeOffRequest.employee_id == emp.id,
                TimeOffRequest.leave_type_id == alloc.leave_type_id,
                TimeOffRequest.status == TimeOffRequestStatus.APPROVED
            ).scalar() or 0.0
            total_granted = float(alloc.allocated_days + (alloc.carried_forward_days or 0.0))
            unused = total_granted - float(approved_taken)
            if unused > 0:
                total_unused_el += unused

    recent_contract = db.query(Contract).filter(
        Contract.employee_id == emp.id
    ).order_by(Contract.id.desc()).first()

    base_wage = recent_contract.wage if recent_contract else 55000.0
    daily_rate = round(base_wage / 30.0, 2)
    encashment_amount = round(total_unused_el * daily_rate, 2)

    emp.leave_encashment_days = round(total_unused_el, 2)
    emp.leave_encashment_amount = encashment_amount

    latest_payslip = db.query(Payslip).filter(
        Payslip.employee_id == emp.id
    ).order_by(Payslip.id.desc()).first()

    if latest_payslip and latest_payslip.status in [PayslipStatus.DRAFT, PayslipStatus.COMPUTED]:
        latest_payslip.leave_encashment_days = emp.leave_encashment_days
        latest_payslip.leave_encashment_amount = encashment_amount
        existing_line = db.query(PayslipLine).filter(
            PayslipLine.payslip_id == latest_payslip.id,
            PayslipLine.rule_code == "LEAVE_ENCASHMENT"
        ).first()
        if existing_line:
            existing_line.amount = encashment_amount
        else:
            db.add(PayslipLine(
                payslip_id=latest_payslip.id,
                rule_name="Leave Encashment (EL)",
                rule_code="LEAVE_ENCASHMENT",
                category=RuleCategory.ALLOWANCE,
                sequence=15,
                amount=encashment_amount,
            ))
        latest_payslip.gross_pay = round(latest_payslip.gross_pay + encashment_amount, 2)
        latest_payslip.net_pay = round(latest_payslip.net_pay + encashment_amount, 2)

    db.commit()

    return MessageResponse(
        message=f"Employee {emp.first_name} {emp.last_name} offboarded as '{new_status.value}'. Unused EL Paid Leaves: {total_unused_el:.1f} day(s). Leave Encashment ₹{encashment_amount:,.2f} added to final salary settlement.",
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
