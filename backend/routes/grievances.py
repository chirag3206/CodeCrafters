"""
PeoplePay360 — Pre-Payroll Operational Verification & Grievance Lifecycle Routes
Strict Zero Salary Disclosure for operational pre-payroll reviews.
Supports both payslip-based and month-based pre-payroll verification workflows.
"""
from typing import List, Optional
from datetime import datetime, date
import calendar
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user, require_payroll_user, require_hr_manager
from models import (
    Payslip, PayslipStatus, VerificationStatus, Payrun, PayrunStatus,
    Attendance, TimeOffRequest, UserRole, PrePayrollVerification, Employee
)
from schemas import (
    PrePayrollStatementOut, GrievanceSubmitRequest, GrievanceResolveRequest,
    PayslipOut, MessageResponse
)
from services.salary_engine import compute_payslip

router = APIRouter(prefix="/api/grievances", tags=["Pre-Payroll & Grievances"])


@router.get("/my-statement", response_model=PrePayrollStatementOut)
def get_my_pre_payroll_statement(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """
    Returns employee's operational pre-payroll statement.
    STRICT ZERO SALARY DISCLOSURE: only days, leaves, and overtime hours.
    """
    emp = current_user.employee
    if not emp:
        raise HTTPException(status_code=400, detail="No employee profile linked to current user")

    # Find latest payslip in Pre_Verification or Computed
    slip = db.query(Payslip).join(Payrun).filter(
        Payslip.employee_id == emp.id,
        Payrun.status.in_([PayrunStatus.PRE_VERIFICATION, PayrunStatus.COMPUTED, PayrunStatus.DRAFT])
    ).order_by(Payslip.created_at.desc()).first()

    if not slip:
        # Fallback to latest payslip
        slip = db.query(Payslip).filter(Payslip.employee_id == emp.id).order_by(Payslip.created_at.desc()).first()

    if not slip:
        raise HTTPException(status_code=404, detail="No pre-payroll statement available for review")

    return PrePayrollStatementOut(
        payslip_id=slip.id,
        employee_name=f"{emp.first_name} {emp.last_name}",
        badge_id=emp.badge_id,
        period_start=slip.period_start,
        period_end=slip.period_end,
        scheduled_days=slip.scheduled_days,
        actual_clocked_days=slip.worked_days,
        paid_leave_days=slip.paid_leave_days,
        unpaid_leave_days=slip.unpaid_leave_days,
        overtime_hours=slip.overtime_hours,
        verification_status=slip.verification_status,
        grievance_category=slip.grievance_category,
        grievance_remarks=slip.grievance_remarks,
    )


@router.post("/confirm-month", response_model=MessageResponse)
def confirm_month_statement(
    month: str = Query(..., description="Month in YYYY-MM format e.g. 2026-08"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Confirms operational shift & attendance record for a specific calendar month.
    Works whether or not a formal payslip has been seeded yet.
    """
    emp = current_user.employee
    if not emp:
        raise HTTPException(status_code=400, detail="No employee profile linked to current user")

    # 1. Update or create PrePayrollVerification record
    pv = db.query(PrePayrollVerification).filter(
        PrePayrollVerification.employee_id == emp.id,
        PrePayrollVerification.month == month,
    ).first()

    if not pv:
        pv = PrePayrollVerification(
            employee_id=emp.id,
            month=month,
            status=VerificationStatus.CONFIRMED,
        )
        db.add(pv)
    else:
        pv.status = VerificationStatus.CONFIRMED
        pv.updated_at = datetime.utcnow()

    # 2. Also update Payslip if one exists for this month
    try:
        y_str, m_str = month.split("-")
        p_start = date(int(y_str), int(m_str), 1)
        slip = db.query(Payslip).filter(
            Payslip.employee_id == emp.id,
            Payslip.period_start == p_start
        ).first()
        if slip:
            slip.verification_status = VerificationStatus.CONFIRMED
    except Exception:
        pass

    db.commit()
    return MessageResponse(message=f"Attendance record for {month} confirmed successfully", success=True)


@router.post("/dispute-month", response_model=MessageResponse)
def dispute_month_statement(
    data: GrievanceSubmitRequest,
    month: str = Query(..., description="Month in YYYY-MM format e.g. 2026-08"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Submits a dispute/grievance for a specific month.
    Notifies HR and registers the issue in the pre-payroll dispute ledger.
    """
    emp = current_user.employee
    if not emp:
        raise HTTPException(status_code=400, detail="No employee profile linked to current user")

    # 1. Update or create PrePayrollVerification record
    pv = db.query(PrePayrollVerification).filter(
        PrePayrollVerification.employee_id == emp.id,
        PrePayrollVerification.month == month,
    ).first()

    if not pv:
        pv = PrePayrollVerification(
            employee_id=emp.id,
            month=month,
            status=VerificationStatus.DISPUTED,
            grievance_category=data.grievance_category,
            grievance_remarks=data.grievance_remarks,
        )
        db.add(pv)
    else:
        pv.status = VerificationStatus.DISPUTED
        pv.grievance_category = data.grievance_category
        pv.grievance_remarks = data.grievance_remarks
        pv.updated_at = datetime.utcnow()

    # 2. Also update Payslip if one exists
    try:
        y_str, m_str = month.split("-")
        p_start = date(int(y_str), int(m_str), 1)
        slip = db.query(Payslip).filter(
            Payslip.employee_id == emp.id,
            Payslip.period_start == p_start
        ).first()
        if slip:
            slip.verification_status = VerificationStatus.DISPUTED
            slip.grievance_category = data.grievance_category
            slip.grievance_remarks = data.grievance_remarks
    except Exception:
        pass

    db.commit()
    return MessageResponse(message=f"Grievance for {month} submitted to HR Resolution Center", success=True)


@router.post("/confirm/{payslip_id}", response_model=MessageResponse)
def confirm_operational_statement(payslip_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    slip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not slip:
        raise HTTPException(status_code=404, detail="Payslip record not found")

    if current_user.role == UserRole.EMPLOYEE and current_user.employee and current_user.employee.id != slip.employee_id:
        raise HTTPException(status_code=403, detail="Access denied")

    slip.verification_status = VerificationStatus.CONFIRMED

    # Sync with PrePayrollVerification
    month_str = slip.period_start.strftime("%Y-%m")
    pv = db.query(PrePayrollVerification).filter(
        PrePayrollVerification.employee_id == slip.employee_id,
        PrePayrollVerification.month == month_str,
    ).first()
    if not pv:
        pv = PrePayrollVerification(
            employee_id=slip.employee_id,
            month=month_str,
            status=VerificationStatus.CONFIRMED
        )
        db.add(pv)
    else:
        pv.status = VerificationStatus.CONFIRMED

    db.commit()
    return MessageResponse(message="Operational attendance statement confirmed successfully", success=True)


@router.post("/dispute/{payslip_id}", response_model=MessageResponse)
def raise_grievance(
    payslip_id: int,
    data: GrievanceSubmitRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    slip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not slip:
        raise HTTPException(status_code=404, detail="Payslip record not found")

    if current_user.role == UserRole.EMPLOYEE and current_user.employee and current_user.employee.id != slip.employee_id:
        raise HTTPException(status_code=403, detail="Access denied")

    slip.verification_status = VerificationStatus.DISPUTED
    slip.grievance_category = data.grievance_category
    slip.grievance_remarks = data.grievance_remarks

    # Sync with PrePayrollVerification
    month_str = slip.period_start.strftime("%Y-%m")
    pv = db.query(PrePayrollVerification).filter(
        PrePayrollVerification.employee_id == slip.employee_id,
        PrePayrollVerification.month == month_str,
    ).first()
    if not pv:
        pv = PrePayrollVerification(
            employee_id=slip.employee_id,
            month=month_str,
            status=VerificationStatus.DISPUTED,
            grievance_category=data.grievance_category,
            grievance_remarks=data.grievance_remarks,
        )
        db.add(pv)
    else:
        pv.status = VerificationStatus.DISPUTED
        pv.grievance_category = data.grievance_category
        pv.grievance_remarks = data.grievance_remarks

    db.commit()
    return MessageResponse(message="Grievance submitted to HR Payroll Resolution Center", success=True)


@router.post("/resolve/{payslip_id}", response_model=PayslipOut, dependencies=[Depends(require_payroll_user)])
def resolve_grievance(
    payslip_id: int,
    data: GrievanceResolveRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    slip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not slip:
        raise HTTPException(status_code=404, detail="Payslip not found")

    slip.grievance_resolution_notes = data.resolution_notes
    slip.grievance_resolved_at = datetime.utcnow()

    month_str = slip.period_start.strftime("%Y-%m")
    pv = db.query(PrePayrollVerification).filter(
        PrePayrollVerification.employee_id == slip.employee_id,
        PrePayrollVerification.month == month_str,
    ).first()

    if data.action == "accept_adjust":
        # When HR accepts and adjusts, set status to PENDING review so employee can re-verify the adjustment
        slip.verification_status = VerificationStatus.PENDING
        # If employee disputed an unpaid absence, adjust unpaid_leave_days
        if slip.unpaid_leave_days > 0:
            slip.unpaid_leave_days = max(0.0, slip.unpaid_leave_days - 1.0)
            slip.worked_days += 1.0

        # Auto-recalculate draft payslip
        rules = slip.payrun.salary_structure.rules if (slip.payrun and slip.payrun.salary_structure) else []
        gross, deduct, net, lines = compute_payslip(
            contract=slip.contract,
            worked_days=slip.worked_days,
            total_working_days=slip.scheduled_days,
            unpaid_leave_days=slip.unpaid_leave_days,
            paid_leave_days=slip.paid_leave_days,
            overtime_hours=slip.overtime_hours,
            rules_list=rules,
        )
        slip.gross_pay = gross
        slip.total_deductions = deduct
        slip.net_pay = net

        if pv:
            pv.status = VerificationStatus.PENDING
            pv.resolution_notes = data.resolution_notes
            pv.resolved_at = datetime.utcnow()
            pv.resolved_by_id = current_user.employee.id if current_user.employee else None

    else:
        # Rejected with explanation
        slip.verification_status = VerificationStatus.CONFIRMED
        if pv:
            pv.status = VerificationStatus.CONFIRMED
            pv.resolution_notes = data.resolution_notes
            pv.resolved_at = datetime.utcnow()
            pv.resolved_by_id = current_user.employee.id if current_user.employee else None

    db.commit()
    db.refresh(slip)
    return slip

