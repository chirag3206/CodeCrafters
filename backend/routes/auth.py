"""
Authentication Routes — Login & Persona Switcher
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import create_access_token, verify_password
from database import get_db
from dependencies import CurrentUser
from models import User
from schemas import LoginRequest, PersonaSwitchRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# ── Demo persona email map ──────────────────────────────────────────────────
PERSONA_MAP = {
    # Indian Corporate Personas
    "aarav": "aarav.sharma@peoplepay360.com",
    "priya": "priya.nair@peoplepay360.com",
    "rajesh": "rajesh.kumar@peoplepay360.com",
    "sunita": "sunita.rao@peoplepay360.com",
    "amit": "amit.verma@peoplepay360.com",
    # Legacy aliases mapped to corresponding accounts
    "alex": "aarav.sharma@peoplepay360.com",
    "sarah": "priya.nair@peoplepay360.com",
    "david": "rajesh.kumar@peoplepay360.com",
    "elena": "sunita.rao@peoplepay360.com",
    "marcus": "amit.verma@peoplepay360.com",
}


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
            detail="Account is inactive",
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


@router.post("/switch-persona", response_model=TokenResponse)
def switch_persona(request: PersonaSwitchRequest, db: Session = Depends(get_db)):
    """
    1-click demo persona switcher — no password required.
    Only works with the 5 seeded demo accounts.
    """
    email = PERSONA_MAP.get(request.persona_key.lower())
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown persona key '{request.persona_key}'. Valid: {list(PERSONA_MAP.keys())}",
        )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demo user not found — run the seed script first.",
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


@router.get("/me", response_model=TokenResponse)
def get_me(current_user: CurrentUser, db: Session = Depends(get_db)):
    """Return current user profile for token refresh / identity check."""
    employee = current_user.employee
    full_name = employee.full_name if employee else current_user.email
    return TokenResponse(
        access_token="",  # Client already has it
        role=current_user.role.value,
        user_id=current_user.id,
        employee_id=employee.id if employee else None,
        badge_id=employee.badge_id if employee else None,
        full_name=full_name,
    )
