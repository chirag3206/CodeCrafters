"""
PeoplePay360 — Dedicated Global Payslips List & Export Routes
"""
from typing import List, Optional
import os
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user, require_payroll_user
from models import Payslip, PayslipStatus, Employee, Payrun, UserRole
from schemas import PayslipOut
from services.pdf_service import generate_payslip_pdf

router = APIRouter(prefix="/api/payslips", tags=["Payslips"])


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
    current_user=Depends(get_current_user)
):
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
