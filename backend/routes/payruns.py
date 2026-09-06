"""
PeoplePay360 — Payrun Processing Control Center & Wizard Routes
"""
from typing import List, Optional
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_, and_, func
from sqlalchemy.orm import Session
import json

from database import get_db
from dependencies import get_current_user, require_payroll_user, require_payroll_manager
from models import (
    Payrun, PayrunStatus, Payslip, PayslipStatus, PayslipLine,
    Employee, Contract, ContractStatus, SalaryStructure, SalaryRule,
    Attendance, AttendanceStatus, TimeOffRequest, TimeOffRequestStatus,
    TimeOffType, VerificationStatus, PrePayrollVerification, AttendancePeriodLock
)
from schemas import (
    PayrunOut, PayrunCreateStep1, PayrunCreateStep2,
    PayrunCandidateOut, MessageResponse
)
from services.salary_engine import compute_payslip
from services.validator_service import inspect_candidate_anomalies, run_pre_validation_checks
from services.pdf_service import generate_payslip_pdf, generate_payslip_pdf_bytes
from services.email_service import dispatch_email
from services.export_service import export_payrun_excel, export_payrun_csv, export_bank_ach_csv

router = APIRouter(prefix="/api/payruns", tags=["Payruns"])


def _count_business_days(start: date, end: date) -> int:
    cur = start
    days = 0
    while cur <= end:
        if cur.weekday() < 5:
            days += 1
        cur += timedelta(days=1)
    return max(1, days)


# ─── LIST PAYRUNS ───────────────────────────────────────────────────────────

@router.get("", response_model=List[PayrunOut], dependencies=[Depends(require_payroll_user)])
def list_payruns(db: Session = Depends(get_db)):
    return db.query(Payrun).order_by(Payrun.period_start.desc()).all()


# ─── STEP 2: ELIGIBLE CANDIDATE PREVIEW ──────────────────────────────────────
# Note: Defined BEFORE /{payrun_id} so FastAPI does not treat 'eligible-candidates' as an integer payrun_id

@router.get("/eligible-candidates", response_model=List[PayrunCandidateOut], dependencies=[Depends(require_payroll_user)])
def get_eligible_candidates(
    period_start: date = Query(...),
    period_end: date = Query(...),
    salary_structure_id: Optional[int] = Query(None),
    department_id: Optional[int] = None,
    employee_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Employee)
    if department_id:
        query = query.filter(Employee.department_id == department_id)
    if employee_type and employee_type != "All":
        query = query.filter(Employee.employment_type == employee_type)

    employees = query.all()
    candidates = []

    for emp in employees:
        contract = db.query(Contract).filter(
            Contract.employee_id == emp.id,
            Contract.start_date <= period_end,
            or_(Contract.end_date >= period_start, Contract.end_date.is_(None)),
            Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.EXPIRED])
        ).order_by(Contract.start_date.desc()).first()

        dup_slip = db.query(Payslip).join(Payrun).filter(
            Payslip.employee_id == emp.id,
            Payrun.period_start <= period_end,
            Payrun.period_end >= period_start,
            Payslip.status.in_([PayslipStatus.VALIDATED, PayslipStatus.PAID])
        ).first()

        warnings = inspect_candidate_anomalies(emp, period_start, period_end, db)

        # Check employee's verification status for this month
        month_str = period_start.strftime("%Y-%m")
        pv = db.query(PrePayrollVerification).filter(
            PrePayrollVerification.employee_id == emp.id,
            PrePayrollVerification.month == month_str,
        ).first()

        v_status = pv.status.value if pv else "Pending"
        if v_status == "Disputed":
            warnings.append(f"Unresolved attendance dispute: {pv.grievance_category or 'Grievance'}")

        candidates.append(PayrunCandidateOut(
            employee_id=emp.id,
            badge_id=emp.badge_id,
            full_name=f"{emp.first_name} {emp.last_name}",
            department=emp.department.name if emp.department else None,
            job_position=emp.job_position.title if emp.job_position else None,
            contract_reference=contract.reference if contract else None,
            contract_wage=contract.wage if contract else None,
            contract_structure_name=contract.salary_structure.name if contract and contract.salary_structure else None,
            has_valid_contract=bool(contract),
            has_bank_details=bool(emp.bank_account_no and emp.ifsc_swift),
            has_duplicate_payslip=bool(dup_slip),
            verification_status=v_status,
            warnings=warnings,
        ))

    return candidates


@router.get("/{payrun_id}", response_model=PayrunOut, dependencies=[Depends(require_payroll_user)])
def get_payrun(payrun_id: int, db: Session = Depends(get_db)):
    pr = db.query(Payrun).filter(Payrun.id == payrun_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Payrun not found")
    return pr


# ─── HELPER: INTERNAL COMPUTE PAYRUN ────────────────────────────────────────

def _execute_compute_payrun(payrun: Payrun, db: Session) -> Payrun:
    default_structure = payrun.salary_structure
    if not default_structure:
        default_structure = db.query(SalaryStructure).first()

    total_days = _count_business_days(payrun.period_start, payrun.period_end)

    total_gross = 0.0
    total_deductions = 0.0
    total_net = 0.0

    for slip in payrun.payslips:
        # Clear old lines for recalculation
        db.query(PayslipLine).filter(PayslipLine.payslip_id == slip.id).delete()

        contract = slip.contract
        if not contract and slip.contract_id:
            contract = db.query(Contract).filter(Contract.id == slip.contract_id).first()
            slip.contract = contract
        if not contract:
            contract = db.query(Contract).filter(
                Contract.employee_id == slip.employee_id,
                Contract.start_date <= payrun.period_end,
                or_(Contract.end_date >= payrun.period_start, Contract.end_date.is_(None)),
                Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.EXPIRED])
            ).order_by(Contract.start_date.desc()).first()
            slip.contract = contract
        if contract and not slip.contract_id:
            slip.contract_id = contract.id

        # Attendance worked days
        attendances = db.query(Attendance).filter(
            Attendance.employee_id == slip.employee_id,
            Attendance.date >= payrun.period_start,
            Attendance.date <= payrun.period_end
        ).all()
        worked_days = len(attendances)
        overtime_hours = sum(a.overtime_hours for a in attendances)

        # Approved leaves in period
        leave_requests = db.query(TimeOffRequest).filter(
            TimeOffRequest.employee_id == slip.employee_id,
            TimeOffRequest.start_date <= payrun.period_end,
            TimeOffRequest.end_date >= payrun.period_start,
            TimeOffRequest.status == TimeOffRequestStatus.APPROVED
        ).all()

        paid_leaves = 0.0
        unpaid_leaves = 0.0
        for lr in leave_requests:
            dur = lr.duration_days
            if lr.leave_type and lr.leave_type.is_paid:
                paid_leaves += dur
            else:
                unpaid_leaves += dur

        slip.scheduled_days = total_days
        slip.worked_days = float(worked_days)
        slip.paid_leave_days = float(paid_leaves)
        slip.unpaid_leave_days = float(unpaid_leaves)
        slip.overtime_hours = float(overtime_hours)

        # Resolve contract-specific salary structure rules:
        # Each employee is computed using their own contract's structure rules.
        # Fall back to the payrun's batch structure or the first available structure if contract has none.
        contract_structure = (contract.salary_structure if contract and contract.salary_structure else None) or payrun.salary_structure or default_structure
        contract_rules = contract_structure.rules if contract_structure else []

        emp = slip.employee or db.query(Employee).filter(Employee.id == slip.employee_id).first()
        leave_encash = emp.leave_encashment_amount if (emp and emp.leave_encashment_amount) else 0.0
        slip.leave_encashment_days = float(emp.leave_encashment_days or 0.0) if emp else 0.0
        slip.leave_encashment_amount = float(leave_encash)

        # Sequenced calculation using the employee's contract rules
        gross, deduct, net, lines = compute_payslip(
            contract=contract,
            worked_days=worked_days,
            total_working_days=total_days,
            unpaid_leave_days=unpaid_leaves,
            paid_leave_days=paid_leaves,
            overtime_hours=overtime_hours,
            rules_list=contract_rules,
            leave_encashment_amount=leave_encash,
        )

        slip.gross_pay = gross
        slip.total_deductions = deduct
        slip.net_pay = net
        slip.status = PayslipStatus.COMPUTED

        for line in lines:
            db.add(PayslipLine(
                payslip_id=slip.id,
                rule_id=line["rule_id"],
                rule_name=line["rule_name"],
                rule_code=line["rule_code"],
                category=line["category"],
                sequence=line["sequence"],
                amount=line["amount"],
            ))

        total_gross += gross
        total_deductions += deduct
        total_net += net

    payrun.total_gross = round(total_gross, 2)
    payrun.total_deductions = round(total_deductions, 2)
    payrun.total_net = round(total_net, 2)
    payrun.status = PayrunStatus.COMPUTED
    payrun.computed_at = datetime.utcnow()

    # Pre-validation anomaly checks
    run_pre_validation_checks(payrun, payrun.payslips, db)
    return payrun


# ─── CREATE PAYRUN BATCH ────────────────────────────────────────────────────

@router.post("/create-batch", response_model=PayrunOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_payroll_user)])
def create_payrun_batch(data: PayrunCreateStep2, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    s1 = data.step1_data
    ref = f"PAY/{s1.period_start.strftime('%Y/%m')}/{int(datetime.utcnow().timestamp()) % 1000:03d}"

    payrun = Payrun(
        reference=ref,
        name=s1.name,
        salary_structure_id=s1.salary_structure_id,
        department_id=s1.department_id,
        employee_type=s1.employee_type,
        period_start=s1.period_start,
        period_end=s1.period_end,
        status=PayrunStatus.DRAFT,
        created_by_id=current_user.employee.id if current_user.employee else None,
    )
    db.add(payrun)
    db.flush()

    # Create draft payslips for selected candidates
    total_days = _count_business_days(s1.period_start, s1.period_end)

    for emp_id in data.selected_employee_ids:
        contract = db.query(Contract).filter(
            Contract.employee_id == emp_id,
            Contract.start_date <= s1.period_end,
            or_(Contract.end_date >= s1.period_start, Contract.end_date.is_(None)),
            Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.EXPIRED])
        ).order_by(Contract.start_date.desc()).first()

        slip = Payslip(
            payrun_id=payrun.id,
            employee_id=emp_id,
            contract_id=contract.id if contract else None,
            period_start=s1.period_start,
            period_end=s1.period_end,
            scheduled_days=total_days,
            status=PayslipStatus.DRAFT,
            verification_status=VerificationStatus.PENDING,
        )
        db.add(slip)

    db.commit()
    db.refresh(payrun)

    # Automatically compute the batch upon creation so it immediately advances to COMPUTED
    # and is immediately ready for Payroll Manager review & approval
    _execute_compute_payrun(payrun, db)
    db.commit()
    db.refresh(payrun)
    return payrun


# ─── COMPUTE BATCH ──────────────────────────────────────────────────────────

@router.post("/{payrun_id}/compute", response_model=PayrunOut, dependencies=[Depends(require_payroll_user)])
def compute_payrun(payrun_id: int, db: Session = Depends(get_db)):
    payrun = db.query(Payrun).filter(Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")

    _execute_compute_payrun(payrun, db)
    db.commit()
    db.refresh(payrun)
    return payrun


# ─── SEND PRE-VERIFICATION STATEMENTS ───────────────────────────────────────

@router.post("/{payrun_id}/send-pre-verification", response_model=MessageResponse, dependencies=[Depends(require_payroll_user)])
def send_pre_verification(payrun_id: int, db: Session = Depends(get_db)):
    payrun = db.query(Payrun).filter(Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")

    payrun.status = PayrunStatus.PRE_VERIFICATION
    for slip in payrun.payslips:
        emp = slip.employee
        if emp:
            body = f"""
            <h3>Pre-Payroll Operational Verification Statement</h3>
            <p>Dear {emp.first_name},</p>
            <p>Please review your operational records for <b>{payrun.period_start} to {payrun.period_end}</b>:</p>
            <ul>
                <li>Scheduled Working Days: {slip.scheduled_days}</li>
                <li>Actual Clocked Days: {slip.worked_days}</li>
                <li>Paid Leaves: {slip.paid_leave_days} Day(s)</li>
                <li>Unpaid Absences (LOP): {slip.unpaid_leave_days} Day(s)</li>
                <li>Overtime Hours: {slip.overtime_hours} hrs</li>
            </ul>
            <p>Please log in to confirm or raise a grievance before payroll finalization.</p>
            """
            dispatch_email(
                recipient_email=emp.work_email,
                recipient_name=f"{emp.first_name} {emp.last_name}",
                subject=f"Pre-Payroll Verification Notice ({payrun.period_start})",
                body_html=body,
                email_type="pre_verification",
                db=db,
                payslip_id=slip.id,
                payrun_id=payrun.id,
            )

    db.commit()
    return MessageResponse(message=f"Pre-payroll operational statements dispatched to {len(payrun.payslips)} employees.", success=True)


# ─── VALIDATE PAYRUN ────────────────────────────────────────────────────────

@router.post("/{payrun_id}/validate", response_model=PayrunOut, dependencies=[Depends(require_payroll_manager)])
def validate_payrun(payrun_id: int, db: Session = Depends(get_db)):
    payrun = db.query(Payrun).filter(Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")

    payrun.status = PayrunStatus.VALIDATED
    payrun.validated_at = datetime.utcnow()
    for slip in payrun.payslips:
        slip.status = PayslipStatus.VALIDATED

    db.commit()
    db.refresh(payrun)
    return payrun


# ─── MARK PAID & PDF GENERATION ─────────────────────────────────────────────

@router.post("/{payrun_id}/mark-paid", response_model=PayrunOut, dependencies=[Depends(require_payroll_manager)])
def mark_payrun_paid(payrun_id: int, db: Session = Depends(get_db)):
    """
    Final Governance Sign-Off (HR Payroll Manager Authority):
    Marks payrun as PAID, generates official ReportLab PDF payslips,
    and automatically distributes payslips and notifies all employees via email outbox.
    No further Admin approval is required.
    """
    payrun = db.query(Payrun).filter(Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")

    payrun.status = PayrunStatus.PAID
    payrun.paid_at = datetime.utcnow()

    for slip in payrun.payslips:
        slip.status = PayslipStatus.PAID
        # Auto-confirm pre-review status for non-disputed payslips when marking paid.
        # Disputed slips are left as-is so HR can still see and resolve them.
        if slip.verification_status != VerificationStatus.DISPUTED:
            slip.verification_status = VerificationStatus.CONFIRMED
        # Generate printable PDF
        pdf_path = generate_payslip_pdf(slip)
        slip.pdf_path = pdf_path

        # Generate PDF and email to employee
        emp = slip.employee
        if emp:
            period_label = payrun.period_start.strftime('%B %Y')
            pdf_bytes = generate_payslip_pdf_bytes(slip)
            pdf_filename = f"Payslip_{period_label.replace(' ', '_')}_{emp.badge_id or emp.id}.pdf"
            body = f"""
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
              <div style="background:linear-gradient(135deg,#4338ca,#6366f1);padding:28px 32px;border-radius:10px 10px 0 0">
                <h2 style="color:#fff;margin:0;font-size:22px">&#x1F4B0; Salary Credited — {period_label}</h2>
                <p style="color:#c7d2fe;margin:6px 0 0">PeoplePay360 Enterprise &bull; Official Payslip</p>
              </div>
              <div style="background:#f8fafc;padding:28px 32px;border:1px solid #e2e8f0;border-top:none">
                <p style="margin:0 0 16px">Dear <b>{emp.first_name}</b>,</p>
                <p>Your salary for <b>{period_label}</b> has been <span style="color:#10b981"><b>approved and disbursed</b></span> by the Payroll Manager.</p>
                <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
                  <tr style="background:#eef2ff">
                    <td style="padding:10px 16px;font-weight:600;color:#4338ca;font-size:13px">Pay Period</td>
                    <td style="padding:10px 16px;font-size:13px">{payrun.period_start} &rarr; {payrun.period_end}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 16px;font-weight:600;font-size:13px">Gross Pay</td>
                    <td style="padding:10px 16px;font-size:13px">&#x20B9; {slip.gross_pay:,.2f}</td>
                  </tr>
                  <tr style="background:#f1f5f9">
                    <td style="padding:10px 16px;font-weight:600;font-size:13px">Total Deductions</td>
                    <td style="padding:10px 16px;font-size:13px;color:#ef4444">(&#x20B9; {slip.total_deductions:,.2f})</td>
                  </tr>
                  <tr style="background:#ecfdf5">
                    <td style="padding:12px 16px;font-weight:700;font-size:15px;color:#10b981">Net Take-Home</td>
                    <td style="padding:12px 16px;font-weight:700;font-size:15px;color:#10b981">&#x20B9; {slip.net_pay:,.2f}</td>
                  </tr>
                </table>
                <p style="color:#64748b;font-size:13px">&#x1F4CE; Your complete payslip PDF is attached to this email. You can also view and download it anytime from the <b>PeoplePay360 Employee Portal</b>.</p>
              </div>
              <div style="background:#f1f5f9;padding:14px 32px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none;text-align:center">
                <p style="color:#94a3b8;font-size:11px;margin:0">This is a system-generated email from PeoplePay360. Do not reply to this email.</p>
              </div>
            </div>
            """
            dispatch_email(
                recipient_email=emp.work_email,
                recipient_name=f"{emp.first_name} {emp.last_name}",
                subject=f"\U0001f4b0 Salary Credited — {period_label} | PeoplePay360",
                body_html=body,
                email_type="payslip",
                db=db,
                payslip_id=slip.id,
                payrun_id=payrun.id,
                attachment_bytes=pdf_bytes,
                attachment_filename=pdf_filename,
            )

    db.commit()
    db.refresh(payrun)
    return payrun


# ─── BULK SEND PAYSLIPS ─────────────────────────────────────────────────────

@router.post("/{payrun_id}/send-payslips", response_model=MessageResponse, dependencies=[Depends(require_payroll_manager)])
def send_payslips_batch(payrun_id: int, db: Session = Depends(get_db)):
    payrun = db.query(Payrun).filter(Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")

    count = 0
    for slip in payrun.payslips:
        emp = slip.employee
        if emp:
            period_label = payrun.period_start.strftime('%B %Y')
            pdf_bytes = generate_payslip_pdf_bytes(slip)
            pdf_filename = f"Payslip_{period_label.replace(' ', '_')}_{emp.badge_id or emp.id}.pdf"
            body = f"""
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
              <div style="background:linear-gradient(135deg,#4338ca,#6366f1);padding:28px 32px;border-radius:10px 10px 0 0">
                <h2 style="color:#fff;margin:0;font-size:22px">&#x1F4B0; Payslip Ready — {period_label}</h2>
                <p style="color:#c7d2fe;margin:6px 0 0">PeoplePay360 Enterprise &bull; Official Payslip</p>
              </div>
              <div style="background:#f8fafc;padding:28px 32px;border:1px solid #e2e8f0;border-top:none">
                <p style="margin:0 0 16px">Dear <b>{emp.first_name}</b>,</p>
                <p>Your payslip for <b>{period_label}</b> is now available. Please find the complete PDF payslip attached to this email.</p>
                <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
                  <tr style="background:#eef2ff">
                    <td style="padding:10px 16px;font-weight:600;color:#4338ca;font-size:13px">Pay Period</td>
                    <td style="padding:10px 16px;font-size:13px">{payrun.period_start} &rarr; {payrun.period_end}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 16px;font-weight:600;font-size:13px">Gross Pay</td>
                    <td style="padding:10px 16px;font-size:13px">&#x20B9; {slip.gross_pay:,.2f}</td>
                  </tr>
                  <tr style="background:#f1f5f9">
                    <td style="padding:10px 16px;font-weight:600;font-size:13px">Total Deductions</td>
                    <td style="padding:10px 16px;font-size:13px;color:#ef4444">(&#x20B9; {slip.total_deductions:,.2f})</td>
                  </tr>
                  <tr style="background:#ecfdf5">
                    <td style="padding:12px 16px;font-weight:700;font-size:15px;color:#10b981">Net Take-Home</td>
                    <td style="padding:12px 16px;font-weight:700;font-size:15px;color:#10b981">&#x20B9; {slip.net_pay:,.2f}</td>
                  </tr>
                </table>
                <p style="color:#64748b;font-size:13px">&#x1F4CE; The complete payslip PDF is attached. You can also access it from the <b>PeoplePay360 Employee Portal</b>.</p>
              </div>
              <div style="background:#f1f5f9;padding:14px 32px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none;text-align:center">
                <p style="color:#94a3b8;font-size:11px;margin:0">This is a system-generated email from PeoplePay360. Do not reply to this email.</p>
              </div>
            </div>
            """
            dispatch_email(
                recipient_email=emp.work_email,
                recipient_name=f"{emp.first_name} {emp.last_name}",
                subject=f"\U0001f4b0 Payslip Ready — {period_label} | PeoplePay360",
                body_html=body,
                email_type="payslip",
                db=db,
                payslip_id=slip.id,
                payrun_id=payrun.id,
                attachment_bytes=pdf_bytes,
                attachment_filename=pdf_filename,
            )
            count += 1

    return MessageResponse(message=f"Payslip PDF dispatched to {count} employees successfully.", success=True)


# ─── EXPORT SUITE ────────────────────────────────────────────────────────────

@router.get("/{payrun_id}/export-excel", dependencies=[Depends(require_payroll_user)])
def export_excel_endpoint(payrun_id: int, db: Session = Depends(get_db)):
    payrun = db.query(Payrun).filter(Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")

    excel_stream = export_payrun_excel(payrun, payrun.payslips)
    filename = f"Payroll_Register_{payrun.reference.replace('/', '_')}.xlsx"
    return Response(
        content=excel_stream.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/{payrun_id}/export-csv", dependencies=[Depends(require_payroll_user)])
def export_csv_endpoint(payrun_id: int, db: Session = Depends(get_db)):
    payrun = db.query(Payrun).filter(Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")

    csv_text = export_payrun_csv(payrun, payrun.payslips)
    filename = f"Payroll_Register_{payrun.reference.replace('/', '_')}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/{payrun_id}/export-bank-csv", dependencies=[Depends(require_payroll_manager)])
def export_bank_csv_endpoint(payrun_id: int, db: Session = Depends(get_db)):
    payrun = db.query(Payrun).filter(Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")

    csv_text = export_bank_ach_csv(payrun, payrun.payslips)
    filename = f"Bank_Disbursement_ACH_{payrun.reference.replace('/', '_')}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
