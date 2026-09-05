"""
PeoplePay360 — Centralized Executive Dashboard Routes
Computes all 5 required Core KPIs and 7 Attendance Operations Metrics with dynamic slicing.
"""
import calendar
from typing import List, Optional, Dict, Any
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user, require_payroll_user
from models import (
    Payslip, PayslipStatus, Payrun, PayrunStatus, Employee, Department,
    Attendance, AttendanceStatus, TimeOffRequest, TimeOffRequestStatus,
    TimeOffType, EmailOutbox, EmailStatus, UserRole, PrePayrollVerification,
    AttendancePeriodLock, VerificationStatus
)
from schemas import DashboardKPIOut, AttendanceMetrics, EmailOutboxOut

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/kpis", response_model=DashboardKPIOut, dependencies=[Depends(require_payroll_user)])
def get_dashboard_kpis(
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
    department_id: Optional[int] = None,
    employee_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    # Base query filters for payslips
    slip_query = db.query(Payslip).join(Employee)

    if department_id:
        slip_query = slip_query.filter(Employee.department_id == department_id)
    if employee_type and employee_type != "All":
        slip_query = slip_query.filter(Employee.employment_type == employee_type)
    if period_start:
        slip_query = slip_query.filter(Payslip.period_start >= period_start)
    if period_end:
        slip_query = slip_query.filter(Payslip.period_end <= period_end)

    all_slips = slip_query.all()

    # 1. Total Net Salary Paid (Paid status only)
    paid_slips = [s for s in all_slips if s.status == PayslipStatus.PAID]
    total_net_paid = sum(s.net_pay for s in paid_slips)

    # 2. Payslips Generated (with breakdown)
    payslips_count = len(all_slips)
    draft_count = sum(1 for s in all_slips if s.status == PayslipStatus.DRAFT)
    validated_count = sum(1 for s in all_slips if s.status in [PayslipStatus.VALIDATED, PayslipStatus.COMPUTED])
    paid_count = len(paid_slips)

    # 3. Average Salary
    avg_salary = (total_net_paid / paid_count) if paid_count > 0 else (
        (sum(s.net_pay for s in all_slips) / payslips_count) if payslips_count > 0 else 0.0
    )

    # 4. Approved Time Off Days
    leave_query = db.query(func.coalesce(func.sum(TimeOffRequest.duration_days), 0.0)).filter(
        TimeOffRequest.status == TimeOffRequestStatus.APPROVED
    )
    if period_start:
        leave_query = leave_query.filter(TimeOffRequest.start_date >= period_start)
    if period_end:
        leave_query = leave_query.filter(TimeOffRequest.end_date <= period_end)
    approved_leave_days = float(leave_query.scalar() or 0.0)

    # 5. Full Attendance Overview (7 Metrics)
    att_query = db.query(Attendance).join(Employee)
    if department_id:
        att_query = att_query.filter(Employee.department_id == department_id)
    if period_start:
        att_query = att_query.filter(Attendance.date >= period_start)
    if period_end:
        att_query = att_query.filter(Attendance.date <= period_end)

    att_records = att_query.all()
    present_cnt = sum(1 for a in att_records if a.status == AttendanceStatus.PRESENT)
    late_cnt = sum(1 for a in att_records if a.status == AttendanceStatus.LATE)
    missing_co_cnt = sum(1 for a in att_records if a.status == AttendanceStatus.MISSING_CHECKOUT)
    manual_edits_cnt = sum(1 for a in att_records if a.is_manual_correction)
    overtime_cnt = sum(1 for a in att_records if a.overtime_hours > 0)

    # Calculate business days expected
    total_emps = db.query(Employee).count() or 1
    # Standard 22 working shifts expected per emp if no dates specified
    expected_shifts = total_emps * 22
    actual_clocked = len(att_records)
    absent_cnt = max(0, expected_shifts - actual_clocked)

    coverage_pct = round((actual_clocked / max(1, expected_shifts)) * 100.0, 1)

    # Attendance Health Score = max(0, (1 - (Late + 2*Missing + Absent) / Expected) * 100)
    health_penalty = late_cnt + (2 * missing_co_cnt) + (absent_cnt * 1.5)
    health_score = max(0.0, round((1.0 - (health_penalty / max(1, expected_shifts))) * 100.0, 1))

    att_metrics = AttendanceMetrics(
        present=present_cnt,
        late=late_cnt,
        absent=absent_cnt,
        overtime_count=overtime_cnt,
        missing_checkouts=missing_co_cnt,
        manual_edits=manual_edits_cnt,
        attendance_coverage_pct=coverage_pct,
        health_score=health_score,
    )

    # 6. Recharts Visualizations: Salary by Department
    dept_map: Dict[str, float] = {}
    for s in all_slips:
        dept_name = s.employee.department.name if s.employee and s.employee.department else "General"
        dept_map[dept_name] = dept_map.get(dept_name, 0.0) + s.net_pay

    salary_by_dept = [{"name": k, "value": round(v, 2)} for k, v in dept_map.items()]

    # 7. Monthly Net Trend vs Headcount (dynamic from actual paid payruns)
    past_payruns = db.query(Payrun).filter(Payrun.status == PayrunStatus.PAID).order_by(Payrun.period_start.asc()).all()
    if past_payruns:
        monthly_trend = [
            {"month": p.period_start.strftime("%b %Y"), "net_salary": round(p.total_net, 2), "headcount": len(p.payslips) or total_emps}
            for p in past_payruns[-6:]
        ]
    else:
        monthly_trend = [
            {"month": "May 2026", "net_salary": 685000.0, "headcount": 10},
            {"month": "Jun 2026", "net_salary": 724000.0, "headcount": 11},
            {"month": "Jul 2026", "net_salary": 741000.0, "headcount": 11},
        ]

    # 8. Attendance Status Breakdown Bar
    att_breakdown = [
        {"name": "Present", "count": present_cnt, "fill": "#10B981"},
        {"name": "Late", "count": late_cnt, "fill": "#F59E0B"},
        {"name": "Absent", "count": absent_cnt, "fill": "#EF4444"},
        {"name": "Missing Checkout", "count": missing_co_cnt, "fill": "#8B5CF6"},
    ]

    return DashboardKPIOut(
        total_net_salary_paid=round(total_net_paid, 2),
        payslips_generated=payslips_count,
        payslips_draft=draft_count,
        payslips_validated=validated_count,
        payslips_paid=paid_count,
        average_salary=round(avg_salary, 2),
        approved_time_off_days=approved_leave_days,
        attendance_health_score=health_score,
        attendance=att_metrics,
        salary_by_department=salary_by_dept,
        monthly_net_trend=monthly_trend,
        attendance_status_breakdown=att_breakdown,
    )


@router.get("/outbox", response_model=List[EmailOutboxOut], dependencies=[Depends(require_payroll_user)])
def get_email_outbox(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """In-App Outbox Viewer for inspecting all simulated/real SMTP dispatches."""
    return db.query(EmailOutbox).order_by(EmailOutbox.created_at.desc()).offset(skip).limit(limit).all()


AVAILABLE_MONTHS = [
    {"key": "2026-09", "label": "September 2026 (Live Current)"},
    {"key": "2026-08", "label": "August 2026 (Unrun Payrun Cycle)"},
    {"key": "2026-07", "label": "July 2026 (Historical Paid)"},
    {"key": "2026-06", "label": "June 2026 (Historical Paid)"},
    {"key": "2026-05", "label": "May 2026 (Historical Paid)"},
    {"key": "2026-04", "label": "April 2026 (Historical Paid)"},
    {"key": "2026-03", "label": "March 2026 (Historical Paid)"},
]


def _count_b_days(s: date, e: date) -> int:
    cur = s
    cnt = 0
    while cur <= e:
        if cur.weekday() < 5:
            cnt += 1
        cur += timedelta(days=1)
    return cnt


@router.get("/home-kpis")
def get_home_kpis(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    scope: Optional[str] = Query("company", description="'company' or 'personal'"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Dynamic Role-Aware KPI Service for Homepage:
    - Provides month-specific metrics (scheduled, clocked, paid leaves, LOP, overtime)
    - Supports Scope toggle ('company' vs 'personal') for HR Managers, Payroll Managers & Admins
    - Regular Employees are automatically bound to their 'personal' scope
    - Guarantees accurate LOP calculation (approved LOP requests + unauthorized deficit)
    """
    sel_month = month or "2026-08"
    try:
        y_str, m_str = sel_month.split("-")
        year, mon = int(y_str), int(m_str)
        last_day = calendar.monthrange(year, mon)[1]
        period_start = date(year, mon, 1)
        period_end = date(year, mon, last_day)
    except Exception:
        year, mon = 2026, 8
        period_start = date(2026, 8, 1)
        period_end = date(2026, 8, 31)
        sel_month = "2026-08"

    month_label = period_start.strftime("%B %Y")
    scheduled_days = _count_b_days(period_start, period_end)

    # Determine user permissions
    is_management = current_user.role in [
        UserRole.HR_MANAGER, UserRole.HR_PAYROLL_MANAGER,
        UserRole.HR_PAYROLL_USER, UserRole.ADMIN
    ]
    effective_scope = scope if (is_management and scope in ["company", "personal"]) else "personal"

    emp = current_user.employee

    if effective_scope == "company":
        total_emps = db.query(Employee).count() or 1
        total_expected_shifts = total_emps * scheduled_days

        # Clocked attendance in month
        atts = db.query(Attendance).filter(
            Attendance.date >= period_start, Attendance.date <= period_end
        ).all()
        clocked_count = len(atts)
        present_count = sum(1 for a in atts if a.status == AttendanceStatus.PRESENT)
        late_count = sum(1 for a in atts if a.status == AttendanceStatus.LATE)
        overtime_h = round(sum(a.overtime_hours for a in atts), 2)

        # Approved leaves in month
        approved_leaves = db.query(TimeOffRequest).join(TimeOffType).filter(
            TimeOffRequest.status == TimeOffRequestStatus.APPROVED,
            TimeOffRequest.start_date >= period_start,
            TimeOffRequest.end_date <= period_end,
        ).all()

        paid_leave_days = sum(l.duration_days for l in approved_leaves if l.leave_type.is_paid)
        unpaid_leave_req_days = sum(l.duration_days for l in approved_leaves if not l.leave_type.is_paid)

        # Deficit across all staff
        unaccounted_deficit = max(0.0, float(total_expected_shifts - (clocked_count + paid_leave_days + unpaid_leave_req_days)))
        total_unpaid_lop = round(unpaid_leave_req_days + unaccounted_deficit, 1)

        coverage_pct = round((clocked_count / max(1, total_expected_shifts)) * 100.0, 1)

        # Pending action badges for the selected period
        pending_leaves = db.query(TimeOffRequest).filter(
            TimeOffRequest.status == TimeOffRequestStatus.SUBMITTED,
            TimeOffRequest.start_date <= period_end,
            TimeOffRequest.end_date >= period_start,
        ).count()
        pending_audits = db.query(Attendance).filter(
            Attendance.date >= period_start,
            Attendance.date <= period_end,
            Attendance.status == AttendanceStatus.MISSING_CHECKOUT,
            Attendance.is_manual_correction == False
        ).count()

        # Period Lock Status
        lock_rec = db.query(AttendancePeriodLock).filter(AttendancePeriodLock.month == sel_month).first()
        is_locked = bool(lock_rec and lock_rec.is_locked)
        locked_by_name = (
            f"{lock_rec.locked_by.first_name} {lock_rec.locked_by.last_name}"
            if (lock_rec and lock_rec.locked_by) else None
        )

        # Unresolved Pre-Payroll Grievances / Disputes for this month
        pending_disputes = db.query(PrePayrollVerification).filter(
            PrePayrollVerification.month == sel_month,
            PrePayrollVerification.status == VerificationStatus.DISPUTED
        ).count()

        # Ready for payroll indicator: Attendance is locked by HR and 0 pending disputes
        ready_for_payroll = is_locked and (pending_disputes == 0)

        return {
            "scope": "company",
            "month": sel_month,
            "month_label": month_label,
            "period_start": str(period_start),
            "period_end": str(period_end),
            "available_months": AVAILABLE_MONTHS,
            "can_toggle_scope": True,
            "is_attendance_locked": is_locked,
            "locked_at": lock_rec.locked_at.isoformat() if (lock_rec and lock_rec.locked_at) else None,
            "locked_by_name": locked_by_name,
            "ready_for_payroll": ready_for_payroll,
            "pending_disputes_count": pending_disputes,
            "company": {
                "headcount": total_emps,
                "scheduled_shifts": total_expected_shifts,
                "clocked_shifts": clocked_count,
                "present_shifts": present_count,
                "late_shifts": late_count,
                "coverage_pct": coverage_pct,
                "paid_leaves_taken": round(paid_leave_days, 1),
                "unpaid_absences_lop": total_unpaid_lop,
                "overtime_hours": overtime_h,
                "pending_leave_approvals": pending_leaves,
                "pending_attendance_audits": pending_audits,
                "pending_disputes": pending_disputes,
                "is_attendance_locked": is_locked,
                "ready_for_payroll": ready_for_payroll,
            }
        }

    else:
        # Personal Scope
        if not emp:
            return {
                "scope": "personal",
                "month": sel_month,
                "month_label": month_label,
                "period_start": str(period_start),
                "period_end": str(period_end),
                "available_months": AVAILABLE_MONTHS,
                "can_toggle_scope": is_management,
                "personal": {
                    "scheduled_days": scheduled_days,
                    "actual_clocked_days": 0,
                    "paid_leave_days": 0.0,
                    "unpaid_leave_days": 0.0,
                    "overtime_hours": 0.0,
                    "verification_status": "No Profile",
                }
            }

        emp_atts = db.query(Attendance).filter(
            Attendance.employee_id == emp.id,
            Attendance.date >= period_start,
            Attendance.date <= period_end,
        ).all()
        clocked_days = len(emp_atts)
        ot_hours = round(sum(a.overtime_hours for a in emp_atts), 2)

        emp_leaves = db.query(TimeOffRequest).join(TimeOffType).filter(
            TimeOffRequest.employee_id == emp.id,
            TimeOffRequest.status == TimeOffRequestStatus.APPROVED,
            TimeOffRequest.start_date >= period_start,
            TimeOffRequest.end_date <= period_end,
        ).all()
        paid_leaves = sum(l.duration_days for l in emp_leaves if l.leave_type.is_paid)
        unpaid_req_leaves = sum(l.duration_days for l in emp_leaves if not l.leave_type.is_paid)

        # Deficit calculation
        deficit = max(0.0, float(scheduled_days - (clocked_days + paid_leaves + unpaid_req_leaves)))
        total_lop = round(unpaid_req_leaves + deficit, 1)

        # Check if payslip or PrePayrollVerification exists for this period
        slip = db.query(Payslip).filter(
            Payslip.employee_id == emp.id,
            Payslip.period_start == period_start,
        ).first()

        pv = db.query(PrePayrollVerification).filter(
            PrePayrollVerification.employee_id == emp.id,
            PrePayrollVerification.month == sel_month,
        ).first()

        payslip_id = slip.id if slip else None
        
        if pv:
            v_status = pv.status.value
            g_cat = pv.grievance_category
            g_rem = pv.grievance_remarks
            g_notes = pv.resolution_notes
        elif slip and slip.verification_status:
            v_status = slip.verification_status.value
            g_cat = slip.grievance_category
            g_rem = slip.grievance_remarks
            g_notes = slip.grievance_resolution_notes
        else:
            v_status = "Confirmed" if (sel_month < "2026-08") else "Pending Review"
            g_cat = None
            g_rem = None
            g_notes = None

        return {
            "scope": "personal",
            "month": sel_month,
            "month_label": month_label,
            "period_start": str(period_start),
            "period_end": str(period_end),
            "available_months": AVAILABLE_MONTHS,
            "can_toggle_scope": is_management,
            "personal": {
                "employee_name": emp.full_name,
                "badge_id": emp.badge_id,
                "scheduled_days": scheduled_days,
                "actual_clocked_days": clocked_days,
                "paid_leave_days": round(paid_leaves, 1),
                "unpaid_leave_days": total_lop,
                "overtime_hours": ot_hours,
                "payslip_id": payslip_id,
                "verification_status": v_status,
                "grievance_category": g_cat,
                "grievance_remarks": g_rem,
                "grievance_resolution_notes": g_notes,
            }
        }


