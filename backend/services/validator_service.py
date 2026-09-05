"""
PeoplePay360 — Pre-Validation Anomaly Detector
Inspects candidate employees and calculated payslips for potential payroll anomalies.
"""
from typing import List, Optional
import json
from datetime import date
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from models import Employee, Contract, ContractStatus, Payslip, PayslipStatus, Attendance, AttendanceStatus, Payrun


def inspect_candidate_anomalies(
    employee: Employee,
    period_start: date,
    period_end: date,
    db: Session,
    current_payrun_id: Optional[int] = None
) -> List[str]:
    """Inspect an individual candidate before or during payrun creation."""
    warnings: List[str] = []

    # 1. Missing Bank Credentials
    if not employee.bank_account_no or not employee.ifsc_swift:
        warnings.append("⚠️ Missing bank account number or SWIFT/IFSC routing details.")

    # 2. Missing Applicable Contract
    applicable_contract = db.query(Contract).filter(
        Contract.employee_id == employee.id,
        Contract.start_date <= period_end,
        or_(Contract.end_date >= period_start, Contract.end_date.is_(None)),
        Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.EXPIRED])
    ).order_by(Contract.start_date.desc()).first()

    if not applicable_contract:
        warnings.append("⚠️ No valid contract found covering this pay period.")

    # 3. Duplicate Overlapping Payslip
    dup_query = db.query(Payslip).join(Payrun).filter(
        Payslip.employee_id == employee.id,
        Payrun.period_start <= period_end,
        Payrun.period_end >= period_start,
        Payslip.status.in_([PayslipStatus.COMPUTED, PayslipStatus.VALIDATED, PayslipStatus.PAID])
    )
    if current_payrun_id:
        dup_query = dup_query.filter(Payslip.payrun_id != current_payrun_id)

    if dup_query.first():
        warnings.append("⚠️ Duplicate payslip detected in an overlapping payrun period.")

    return warnings


def run_pre_validation_checks(payrun: Payrun, payslips: List[Payslip], db: Session) -> int:
    """
    Runs comprehensive anomaly detection across all payslips in a payrun.
    Saves JSON warnings on each payslip and updates payrun.warnings_count.
    """
    total_warnings = 0

    for slip in payslips:
        warnings: List[str] = []
        emp = slip.employee

        # 1. Missing Bank Credentials
        if not emp or not emp.bank_account_no or not emp.ifsc_swift:
            warnings.append("⚠️ Missing bank account number or SWIFT/IFSC routing details.")

        # 2. Missing Applicable Contract
        if not slip.contract_id:
            warnings.append("⚠️ No applicable contract bound to this payslip.")

        # 3. True Duplicate Overlapping Payslips
        dup_slips = db.query(Payslip).join(Payrun).filter(
            Payslip.employee_id == slip.employee_id,
            Payslip.id != slip.id,
            Payrun.period_start <= payrun.period_end,
            Payrun.period_end >= payrun.period_start,
            Payslip.status.in_([PayslipStatus.VALIDATED, PayslipStatus.PAID])
        ).all()
        if dup_slips:
            warnings.append("⚠️ Duplicate validated/paid payslip detected for employee in an overlapping period.")

        # 4. Zero Worked Days
        if (slip.worked_days or 0.0) == 0.0 and (slip.paid_leave_days or 0.0) == 0.0:
            warnings.append("⚠️ Zero worked days and zero paid leaves logged during this pay period.")

        # 5. Unresolved Attendance Exceptions
        unresolved_att = db.query(Attendance).filter(
            Attendance.employee_id == slip.employee_id,
            Attendance.date >= payrun.period_start,
            Attendance.date <= payrun.period_end,
            Attendance.status == AttendanceStatus.MISSING_CHECKOUT
        ).count()
        if unresolved_att > 0:
            warnings.append(f"⚠️ {unresolved_att} unresolved missing checkout attendance entries in period.")

        slip.warnings_json = json.dumps(warnings)
        total_warnings += len(warnings)

    payrun.warnings_count = total_warnings
    db.flush()
    return total_warnings
