"""
RBAC Dependency Injectors for PeoplePay360.
Use as FastAPI route dependencies to enforce role-based access control.
"""
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from auth import decode_access_token
from database import get_db
from models import User, UserRole

security = HTTPBearer()


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Session = Depends(get_db),
) -> User:
    """Decode JWT and return the authenticated User object."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id: int = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def _require_roles(*allowed_roles: UserRole):
    def dependency(current_user: CurrentUser) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {[r.value for r in allowed_roles]}",
            )
        return current_user
    return dependency


# ─── Named Role Guards ───────────────────────────────────────────────────────

def require_employee(current_user: CurrentUser) -> User:
    """All authenticated users pass."""
    return current_user


def require_hr_manager(current_user: CurrentUser) -> User:
    """Strictly for HR Operations: contracts, profiles, leave approvals, and attendance audits."""
    allowed = {UserRole.HR_MANAGER, UserRole.ADMIN}
    if current_user.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: HR Manager or Admin role required.",
        )
    return current_user


def require_payroll_user(current_user: CurrentUser) -> User:
    """For Payroll Operations: candidates, draft computation, pre-verification, adjustments."""
    allowed = {UserRole.HR_PAYROLL_USER, UserRole.HR_PAYROLL_MANAGER, UserRole.ADMIN}
    if current_user.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: HR Payroll User, Payroll Manager, or Admin role required.",
        )
    return current_user


def require_hr_or_payroll(current_user: CurrentUser) -> User:
    """For HR & Payroll operations: allows HR Manager, Payroll Specialists, and Admins to inspect structures/rules."""
    allowed = {UserRole.HR_MANAGER, UserRole.HR_PAYROLL_USER, UserRole.HR_PAYROLL_MANAGER, UserRole.ADMIN}
    if current_user.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: HR Manager, Payroll Specialist, or Admin role required.",
        )
    return current_user


def require_payroll_manager(current_user: CurrentUser) -> User:
    """Strictly for Financial Governance: salary rules configuration, final validation sign-off, mark paid, bank disbursement."""
    allowed = {UserRole.HR_PAYROLL_MANAGER, UserRole.ADMIN}
    if current_user.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: HR Payroll Manager or Admin role required.",
        )
    return current_user


def require_admin(current_user: CurrentUser) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required.",
        )
    return current_user


# Type aliases for cleaner route signatures
AnyAuthUser = Annotated[User, Depends(require_employee)]
HRManagerUser = Annotated[User, Depends(require_hr_manager)]
PayrollUserDep = Annotated[User, Depends(require_payroll_user)]
PayrollManagerDep = Annotated[User, Depends(require_payroll_manager)]
AdminUser = Annotated[User, Depends(require_admin)]
