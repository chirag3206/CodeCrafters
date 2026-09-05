"""
PeoplePay360 — Dedicated Global Payslips List & Export Routes
"""
from typing import List, Optional
import os
import csv
import io
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from auth import decode_access_token
from database import get_db
from dependencies import get_current_user
from models import Payslip, PayslipStatus, Employee, Payrun, UserRole, User
from schemas import PayslipOut
from services.pdf_service import generate_payslip_pdf

router = APIRouter(prefix="/api/payslips", tags=["Payslips"])

_bearer = HTTPBearer(auto_error=False)


def _get_user_flexible(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    token: Optional[str] = Query(None, description="JWT token (for direct file download links)"),
    db: Session = Depends(get_db),
) -> User:
    """Auth that accepts either Authorization header OR ?token= query param.
    Only used for file download endpoints so browsers can open them directly."""
    raw_token: Optional[str] = None
    if credentials:
        raw_token = credentials.credentials
    elif token:
        raw_token = token

    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        from jose import JWTError
        payload = decode_access_token(raw_token)
        user_id: int = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


@router.get("", response_model=List[PayslipOut])
def list_global_payslips(
    employee_id: Optional[int] = None,
    payrun_id: Optional[int] = None,
    status_filter: Optional[PayslipStatus] = Query(None, alias="status"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = db.query(Payslip)

    # RBAC: Employees only see their own payslips that are Validated or Paid
    if current_user.role == UserRole.EMPLOYEE:
        emp = current_user.employee
        if not emp:
            return []
        query = query.filter(
            Payslip.employee_id == emp.id,
            Payslip.status.in_([PayslipStatus.VALIDATED, PayslipStatus.PAID])
        )
    elif employee_id:
        query = query.filter(Payslip.employee_id == employee_id)

    if payrun_id:
        query = query.filter(Payslip.payrun_id == payrun_id)
    if status_filter:
        query = query.filter(Payslip.status == status_filter)

    return query.order_by(Payslip.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{payslip_id}", response_model=PayslipOut)
def get_payslip_detail(
    payslip_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    slip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not slip:
        raise HTTPException(status_code=404, detail="Payslip not found")

    if current_user.role == UserRole.EMPLOYEE:
        emp = current_user.employee
        if not emp or emp.id != slip.employee_id:
            raise HTTPException(status_code=403, detail="Access denied to this payslip")

    return slip


@router.get("/{payslip_id}/pdf")
def download_payslip_pdf(
    payslip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_user_flexible),
):
    """Download individual payslip as PDF.
    Accepts auth via Authorization header OR ?token= query param (for direct browser links)."""
    slip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not slip:
        raise HTTPException(status_code=404, detail="Payslip not found")

    if current_user.role == UserRole.EMPLOYEE:
        emp = current_user.employee
        if not emp or emp.id != slip.employee_id:
            raise HTTPException(status_code=403, detail="Access denied")

    # Generate if not exists
    if not slip.pdf_path or not os.path.exists(slip.pdf_path):
        slip.pdf_path = generate_payslip_pdf(slip)
        db.commit()

    filename = os.path.basename(slip.pdf_path)
    return FileResponse(
        path=slip.pdf_path,
        media_type="application/pdf",
        filename=filename,
    )


@router.get("/{payslip_id}/csv")
def download_payslip_csv(
    payslip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_user_flexible),
):
    """Download individual payslip as CSV (salary rule breakdown).
    Accepts auth via Authorization header OR ?token= query param."""
    slip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not slip:
        raise HTTPException(status_code=404, detail="Payslip not found")

    if current_user.role == UserRole.EMPLOYEE:
        emp = current_user.employee
        if not emp or emp.id != slip.employee_id:
            raise HTTPException(status_code=403, detail="Access denied")

    emp = slip.employee
    emp_name = f"{emp.first_name} {emp.last_name}" if emp else f"Employee #{slip.employee_id}"
    badge = emp.badge_id if emp else ""
    period = f"{slip.period_start} to {slip.period_end}"

    output = io.StringIO()
    writer = csv.writer(output)

    # Header info
    writer.writerow(["PeoplePay360 — Individual Payslip"])
    writer.writerow(["Employee", emp_name])
    writer.writerow(["Employee ID", badge])
    writer.writerow(["Period", period])
    writer.writerow(["Contract", slip.contract.reference if slip.contract else "N/A"])
    writer.writerow(["Salary Structure", slip.contract.salary_structure.name if slip.contract and slip.contract.salary_structure else "Standard"])
    writer.writerow([])

    # Attendance summary
    writer.writerow(["Attendance Summary"])
    writer.writerow(["Scheduled Days", slip.scheduled_days])
    writer.writerow(["Worked Days", slip.worked_days])
    writer.writerow(["Paid Leave Days", slip.paid_leave_days])
    writer.writerow(["Unpaid Leave Days (LOP)", slip.unpaid_leave_days])
    writer.writerow([])

    # Salary breakdown
    writer.writerow(["Seq", "Rule Name", "Category", "Amount (INR)"])
    for line in (slip.lines or []):
        writer.writerow([line.sequence, line.rule_name, line.category, f"{line.amount:.2f}"])
    writer.writerow([])

    # Totals
    writer.writerow(["Gross Pay", "", "", f"{slip.gross_pay:.2f}"])
    writer.writerow(["Total Deductions", "", "", f"-{slip.total_deductions:.2f}"])
    writer.writerow(["Net Take-Home", "", "", f"{slip.net_pay:.2f}"])

    content = output.getvalue()
    filename = f"payslip_{badge}_{slip.period_start}.csv".replace(" ", "_")

    return StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

