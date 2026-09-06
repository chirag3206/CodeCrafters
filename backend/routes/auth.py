"""
Authentication Routes — Login, Change Password & User Management
"""
import secrets
import string
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import create_access_token, hash_password, verify_password
from database import get_db
from dependencies import CurrentUser, get_current_user, require_admin
from models import Employee, User, UserRole
from schemas import (
    ChangePasswordRequest, CreateUserRequest, LoginRequest,
    MessageResponse, PersonaSwitchRequest, ResetPasswordRequest,
    TokenResponse, UpdateUserRequest, UserOut,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# ── Demo persona email map ──────────────────────────────────────────────────
PERSONA_MAP = {
    # Indian Corporate Personas
    "aarav":  "aarav.sharma@peoplepay360.com",
    "priya":  "priya.nair@peoplepay360.com",
    "rajesh": "rajesh.kumar@peoplepay360.com",
    "sunita": "sunita.rao@peoplepay360.com",
    "amit":   "amit.verma@peoplepay360.com",
    # Role & Keyword Aliases
    "employee":     "aarav.sharma@peoplepay360.com",
    "hr":           "priya.nair@peoplepay360.com",
    "hr_manager":   "priya.nair@peoplepay360.com",
    "payroll":      "rajesh.kumar@peoplepay360.com",
    "payroll_user": "rajesh.kumar@peoplepay360.com",
    "parol":        "rajesh.kumar@peoplepay360.com",
    "parol_user":   "rajesh.kumar@peoplepay360.com",
    "payroll_mgr":  "sunita.rao@peoplepay360.com",
    "pay_manager":  "sunita.rao@peoplepay360.com",
    "admin":        "amit.verma@peoplepay360.com",
    # Legacy aliases
    "alex":   "aarav.sharma@peoplepay360.com",
    "sarah":  "priya.nair@peoplepay360.com",
    "david":  "rajesh.kumar@peoplepay360.com",
    "elena":  "sunita.rao@peoplepay360.com",
    "marcus": "amit.verma@peoplepay360.com",
}

# ── Role creation permissions ─────────────────────────────────────────────────
# Maps: creator role → set of roles they are allowed to create
ROLE_CREATE_PERMISSIONS = {
    UserRole.ADMIN: {
        UserRole.ADMIN, UserRole.HR_MANAGER, UserRole.HR_PAYROLL_MANAGER,
        UserRole.HR_PAYROLL_USER, UserRole.EMPLOYEE,
    },
    UserRole.HR_MANAGER: {UserRole.EMPLOYEE},
}


def _generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return "".join(secrets.choice(alphabet) for _ in range(length))


# ─────────────────────────────────────────────────────────────────────────────
#  Login
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Please contact your administrator.",
        )

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    employee = user.employee
    full_name = employee.full_name if employee else user.email

    return TokenResponse(
        access_token=token,
        role=user.role.value,
        user_id=user.id,
        employee_id=employee.id if employee else None,
        badge_id=employee.badge_id if employee else None,
        full_name=full_name,
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Persona Switcher (dev/demo only — not shown in production UI)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/switch-persona", response_model=TokenResponse)
def switch_persona(request: PersonaSwitchRequest, db: Session = Depends(get_db)):
    """1-click demo persona switcher — no password required (dev use only)."""
    email = PERSONA_MAP.get(request.persona_key.lower())
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown persona key '{request.persona_key}'. Valid: {list(PERSONA_MAP.keys())}",
        )
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Demo user not found — run the seed script first.")

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    employee = user.employee
    full_name = employee.full_name if employee else user.email
    return TokenResponse(
        access_token=token,
        role=user.role.value,
        user_id=user.id,
        employee_id=employee.id if employee else None,
        badge_id=employee.badge_id if employee else None,
        full_name=full_name,
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Current user identity
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=TokenResponse)
def get_me(current_user: CurrentUser, db: Session = Depends(get_db)):
    """Return current user profile for token refresh / identity check."""
    employee = current_user.employee
    full_name = employee.full_name if employee else current_user.email
    return TokenResponse(
        access_token="",
        role=current_user.role.value,
        user_id=current_user.id,
        employee_id=employee.id if employee else None,
        badge_id=employee.badge_id if employee else None,
        full_name=full_name,
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Change Password — any authenticated user (own account)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/change-password", response_model=MessageResponse)
def change_password(
    request: ChangePasswordRequest,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Allow any authenticated user to change their own password."""
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    if request.new_password == request.current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must differ from the current password.",
        )

    current_user.hashed_password = hash_password(request.new_password)
    db.commit()
    return MessageResponse(message="Password changed successfully.", success=True)


# ─────────────────────────────────────────────────────────────────────────────
#  User Management — Admin & HR_Manager (limited)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=List[UserOut])
def list_users(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Admin-only: list all user accounts."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin role required.")

    users = db.query(User).order_by(User.id).all()
    result = []
    for u in users:
        emp = u.employee
        result.append(UserOut(
            id=u.id,
            email=u.email,
            role=u.role,
            is_active=u.is_active,
            full_name=emp.full_name if emp else u.email,
            badge_id=emp.badge_id if emp else None,
            employee_id=emp.id if emp else None,
            created_at=u.created_at,
        ))
    return result


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    request: CreateUserRequest,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """
    Create a user account.
    - Admin can create any role.
    - HR Manager can only create Employee-role users.
    """
    allowed_roles = ROLE_CREATE_PERMISSIONS.get(current_user.role, set())
    if not allowed_roles:
        raise HTTPException(status_code=403, detail="You do not have permission to create user accounts.")
    if request.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail=f"Your role ({current_user.role.value}) can only create: {[r.value for r in allowed_roles]}",
        )

    # Check email uniqueness
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists.")

    # Validate employee_id if provided
    employee = None
    if request.employee_id:
        employee = db.query(Employee).filter(Employee.id == request.employee_id).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee record not found.")
        if employee.user:
            raise HTTPException(status_code=400, detail="This employee already has a linked user account.")

    new_user = User(
        email=request.email,
        hashed_password=hash_password(request.password),
        role=request.role,
        is_active=True,
    )
    db.add(new_user)
    db.flush()  # get new_user.id

    # Link to employee record if provided, otherwise auto-create employee & contract
    if employee:
        employee.user_id = new_user.id
    else:
        from datetime import date
        from models import Contract, ContractStatus, SalaryStructure, WorkingSchedule, EmploymentType, EmployeeStatus, TimeOffType, TimeOffAllocation, AllocationStatus
        std_struct = db.query(SalaryStructure).first()
        std_schedule = db.query(WorkingSchedule).first()
        current_year = date.today().year

        name_parts = (request.full_name or request.email.split("@")[0]).strip().split()
        first_name = name_parts[0] if name_parts else "User"
        last_name = name_parts[1] if len(name_parts) > 1 else str(new_user.id)
        badge_id = f"EMP-{new_user.id:03d}"

        new_emp = Employee(
            user_id=new_user.id,
            badge_id=badge_id,
            first_name=first_name,
            last_name=last_name,
            work_email=request.email,
            employment_type=EmploymentType.FULL_TIME,
            status=EmployeeStatus.ACTIVE,
            hire_date=date(current_year, 1, 1),
            working_schedule_id=std_schedule.id if std_schedule else None,
            avatar_initials=f"{first_name[0].upper()}{last_name[0].upper()}",
            avatar_color="#4F46E5",
        )
        db.add(new_emp)
        db.flush()

        # Create active contract
        new_contract = Contract(
            reference=f"CNT-{current_year}-{badge_id}",
            employee_id=new_emp.id,
            salary_structure_id=std_struct.id if std_struct else 1,
            working_schedule_id=std_schedule.id if std_schedule else None,
            wage=55000.0,
            start_date=date(current_year, 1, 1),
            end_date=None,
            status=ContractStatus.ACTIVE,
        )
        db.add(new_contract)

        # Create default leave allocations
        all_types = db.query(TimeOffType).all()
        for lt in all_types:
            default_days = lt.max_days_per_year if lt.max_days_per_year is not None else 10.0
            alloc = TimeOffAllocation(
                employee_id=new_emp.id,
                leave_type_id=lt.id,
                allocated_days=default_days,
                valid_from=date(current_year, 1, 1),
                valid_to=date(current_year, 12, 31),
                status=AllocationStatus.APPROVED,
            )
            db.add(alloc)

    db.commit()
    db.refresh(new_user)

    emp = new_user.employee
    return UserOut(
        id=new_user.id,
        email=new_user.email,
        role=new_user.role,
        is_active=new_user.is_active,
        full_name=request.full_name or (emp.full_name if emp else new_user.email),
        badge_id=emp.badge_id if emp else None,
        employee_id=emp.id if emp else None,
        created_at=new_user.created_at,
    )


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    request: UpdateUserRequest,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only: update a user's role or active status."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.id == current_user.id and request.is_active is False:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")

    if request.role is not None:
        user.role = request.role
    if request.is_active is not None:
        user.is_active = request.is_active
        if request.is_active is False and user.employee:
            from routes.employees import _execute_employee_offboard
            from models import EmployeeStatus
            if user.employee.status == EmployeeStatus.ACTIVE:
                _execute_employee_offboard(user.employee, "Account Deactivated by Admin", None, db)

    db.commit()
    db.refresh(user)

    emp = user.employee
    return UserOut(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        full_name=emp.full_name if emp else user.email,
        badge_id=emp.badge_id if emp else None,
        employee_id=emp.id if emp else None,
        created_at=user.created_at,
    )


@router.delete("/users/{user_id}", response_model=MessageResponse)
def delete_user(
    user_id: int,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only: delete a user account and calculate final leave encashment settlement."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")

    emp = user.employee
    encashment_msg = ""
    if emp:
        from routes.employees import _execute_employee_offboard
        offboard_res = _execute_employee_offboard(emp, "User Account Deleted", None, db)
        encashment_msg = f" {offboard_res.message}"

    db.delete(user)
    db.commit()
    return MessageResponse(
        message=f"User account '{user.email}' deleted.{encashment_msg}",
        success=True,
    )


@router.post("/users/{user_id}/reset-password", response_model=MessageResponse)
def reset_user_password(
    user_id: int,
    request: ResetPasswordRequest,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only: force-reset a user's password."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.hashed_password = hash_password(request.new_password)
    db.commit()

    emp = user.employee
    name = emp.full_name if emp else user.email
    return MessageResponse(message=f"Password for '{name}' has been reset successfully.", success=True)
