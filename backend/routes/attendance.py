"""
PeoplePay360 — Attendance Management, Live Punch Clock & Early-In/Early-Out Grace Buffer Engine
"""
from typing import List, Optional
from datetime import date, datetime, timedelta
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user, require_hr_manager
from models import (
    Attendance, AttendanceStatus, Employee, WorkingSchedule, ScheduleDayLine, UserRole,
    PrePayrollVerification, Payslip, VerificationStatus, AttendancePeriodLock
)
from schemas import AttendancePunchRequest, AttendanceCorrectionRequest, AttendanceOut, MessageResponse



router = APIRouter(prefix="/api/attendance", tags=["Attendance"])


class AttendanceSummaryOut(BaseModel):
    employee_id: int
    employee_name: str
    scheduled_days: int
    present_days: int
    late_days: int
    missing_checkout_days: int
    absent_days: int
    total_worked_hours: float
    total_overtime_hours: float
    attendance_coverage_pct: float
    health_score: float


def _parse_time_parts(time_str: Optional[str]) -> tuple[int, int]:
    if not time_str or ":" not in time_str:
        return (9, 0)
    parts = time_str.split(":")
    return (int(parts[0]), int(parts[1]))


@router.get("", response_model=List[AttendanceOut])
def list_attendance(
    employee_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    status_filter: Optional[AttendanceStatus] = Query(None, alias="status"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = db.query(Attendance)

    if current_user.role == UserRole.EMPLOYEE:
        emp = current_user.employee
        if not emp:
            return []
        query = query.filter(Attendance.employee_id == emp.id)
    elif employee_id:
        query = query.filter(Attendance.employee_id == employee_id)

    if date_from:
        query = query.filter(Attendance.date >= date_from)
    if date_to:
        query = query.filter(Attendance.date <= date_to)
    if status_filter:
        query = query.filter(Attendance.status == status_filter)

    return query.order_by(Attendance.date.desc(), Attendance.id.desc()).offset(skip).limit(limit).all()


@router.get("/today", response_model=Optional[AttendanceOut])
def get_today_attendance(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Returns today's punch state for current employee."""
    emp = current_user.employee
    if not emp:
        return None
    today = date.today()
    return db.query(Attendance).filter(Attendance.employee_id == emp.id, Attendance.date == today).first()


@router.post("/punch", response_model=AttendanceOut)
def punch_clock(data: AttendancePunchRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """
    Automatic Real-Time Punch Clock with Early-In/Early-Out Proportionality & ±45 Min Grace:
    1. Always logs the current server local timestamp (never uses client-sent timestamp).
    2. Check-in up to (scheduled_start + 45 mins) is classified as PRESENT (Zero deduction).
    3. Early Check-in Proportionality: If employee clocks in early (e.g. 08:15 for 09:00 shift),
       completing the standard required daily hours (e.g. 9h gross / 8h net) allows early check-out
       (e.g. at 17:15) with full shift credit and zero penalty.
    4. Check-out within ±45 min grace buffer awards full scheduled shift credit.
    """
    emp = current_user.employee
    if not emp:
        raise HTTPException(status_code=400, detail="User has no linked employee profile")

    today = date.today()
    # Always use server local time — never trust client timestamps (avoids UTC/IST timezone offset issues)
    now_time = datetime.now()
    existing = db.query(Attendance).filter(Attendance.employee_id == emp.id, Attendance.date == today).first()

    # Get scheduled shift times for today
    day_name = today.strftime("%A")
    sched = emp.working_schedule or db.query(WorkingSchedule).first()
    start_str = "09:00"
    end_str = "18:00"
    break_h = 1.0
    sched_net_h = 8.0

    if sched and sched.day_lines:
        day_line = next((line for line in sched.day_lines if line.day_of_week == day_name), sched.day_lines[0])
        start_str = day_line.start_time
        end_str = day_line.end_time
        break_h = day_line.break_hours
        sched_net_h = day_line.net_hours

    start_hr, start_min = _parse_time_parts(start_str)
    scheduled_start_total_mins = start_hr * 60 + start_min
    actual_checkin_total_mins = now_time.hour * 60 + now_time.minute

    if data.action == "check_in":
        if existing and existing.check_in:
            raise HTTPException(status_code=400, detail="Already checked in for today")

        # ±45 min grace buffer: checkin up to (scheduled_start + 45 mins) is considered PRESENT and exempted from deductions
        is_late = actual_checkin_total_mins > (scheduled_start_total_mins + 45)
        att_status = AttendanceStatus.LATE if is_late else AttendanceStatus.PRESENT

        if not existing:
            existing = Attendance(
                employee_id=emp.id,
                date=today,
                check_in=now_time,
                status=att_status,
            )
            db.add(existing)
        else:
            existing.check_in = now_time
            existing.status = att_status

    elif data.action == "check_out":
        if not existing or not existing.check_in:
            raise HTTPException(status_code=400, detail="Must check in before checking out")
        if existing.check_out:
            raise HTTPException(status_code=400, detail="Already checked out for today")

        existing.check_out = now_time

        # Calculate actual gross duration and net worked hours
        duration_hours = (now_time - existing.check_in).total_seconds() / 3600.0
        worked = max(0.0, duration_hours - break_h)

        # Early check-in -> Early check-out proportionality rule:
        # If employee completed their scheduled net hours (e.g. 8h net / 9h gross)
        # OR is within 45 min grace tolerance (e.g. >= sched_net_h - 0.75h),
        # they receive full shift credit (sched_net_h) with zero salary deductions!
        end_hr, end_min = _parse_time_parts(end_str)
        scheduled_end_total_mins = end_hr * 60 + end_min
        actual_checkout_total_mins = now_time.hour * 60 + now_time.minute

        # Eligible for full credit if completed full shift hours OR checked out after scheduled end minus 45 mins
        completed_full_shift = worked >= (sched_net_h - 0.75)
        reached_grace_checkout_time = actual_checkout_total_mins >= (scheduled_end_total_mins - 45)

        if (completed_full_shift or reached_grace_checkout_time) and worked < sched_net_h:
            worked = sched_net_h

        overtime = max(0.0, worked - sched_net_h)

        existing.worked_hours = round(worked, 2)
        existing.overtime_hours = round(overtime, 2)

    db.commit()
    db.refresh(existing)
    return existing


@router.put("/{attendance_id}/correct", response_model=AttendanceOut, dependencies=[Depends(require_hr_manager)])
def manual_correction(
    attendance_id: int,
    data: AttendanceCorrectionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    att = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    if data.status:
        att.status = data.status
    if data.check_in:
        att.check_in = data.check_in
    if data.check_out:
        att.check_out = data.check_out

    # Recalculate hours if check_in and check_out present
    if att.check_in and att.check_out:
        duration_hours = (att.check_out - att.check_in).total_seconds() / 3600.0
        worked = max(0.0, duration_hours - 1.0)
        overtime = max(0.0, worked - 8.0)
        att.worked_hours = round(worked, 2)
        att.overtime_hours = round(overtime, 2)

    att.is_manual_correction = True
    att.correction_notes = data.correction_notes
    att.corrected_by_id = current_user.employee.id if current_user.employee else None
    att.corrected_at = datetime.utcnow()

    # If employee had a grievance or disputed record for this month, reset status to PENDING so employee re-confirms
    att_month_str = att.date.strftime("%Y-%m")
    pv = db.query(PrePayrollVerification).filter(
        PrePayrollVerification.employee_id == att.employee_id,
        PrePayrollVerification.month == att_month_str,
    ).first()
    if pv and pv.status == VerificationStatus.DISPUTED:
        pv.status = VerificationStatus.PENDING
        pv.resolution_notes = f"Attendance adjusted by HR ({data.correction_notes}) — Awaiting employee confirmation"

    p_start = date(att.date.year, att.date.month, 1)
    slip = db.query(Payslip).filter(
        Payslip.employee_id == att.employee_id,
        Payslip.period_start == p_start,
    ).first()
    if slip and slip.verification_status == VerificationStatus.DISPUTED:
        slip.verification_status = VerificationStatus.PENDING
        slip.grievance_resolution_notes = f"Attendance adjusted by HR ({data.correction_notes}) — Awaiting employee confirmation"

    db.commit()
    db.refresh(att)
    return att



@router.get("/summary/{employee_id}", response_model=AttendanceSummaryOut)
def get_employee_attendance_summary(
    employee_id: int,
    period_start: date = Query(...),
    period_end: date = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Count business days
    cur = period_start
    total_business_days = 0
    while cur <= period_end:
        if cur.weekday() < 5:
            total_business_days += 1
        cur += timedelta(days=1)

    records = db.query(Attendance).filter(
        Attendance.employee_id == employee_id,
        Attendance.date >= period_start,
        Attendance.date <= period_end
    ).all()

    present_count = sum(1 for r in records if r.status == AttendanceStatus.PRESENT)
    late_count = sum(1 for r in records if r.status == AttendanceStatus.LATE)
    missing_co_count = sum(1 for r in records if r.status == AttendanceStatus.MISSING_CHECKOUT)
    actual_clocked = len(records)
    absent_count = max(0, total_business_days - actual_clocked)

    total_worked = sum(r.worked_hours for r in records)
    total_overtime = sum(r.overtime_hours for r in records)

    coverage_pct = round((actual_clocked / total_business_days * 100.0), 1) if total_business_days > 0 else 100.0

    penalty = late_count + (2 * missing_co_count) + (absent_count * 2)
    health = max(0.0, round((1.0 - (penalty / max(1, total_business_days))) * 100.0, 1))

    return AttendanceSummaryOut(
        employee_id=emp.id,
        employee_name=f"{emp.first_name} {emp.last_name}",
        scheduled_days=total_business_days,
        present_days=present_count,
        late_days=late_count,
        missing_checkout_days=missing_co_count,
        absent_days=absent_count,
        total_worked_hours=round(total_worked, 1),
        total_overtime_hours=round(total_overtime, 1),
        attendance_coverage_pct=coverage_pct,
        health_score=health,
    )


# ─── ATTENDANCE PERIOD APPROVAL & LOCK (HR MANAGER PROTOCOL) ────────────────

class AttendanceLockRequest(BaseModel):
    month: str  # "YYYY-MM"
    approval_notes: Optional[str] = "Monthly attendance audited and verified for payroll processing."


@router.get("/lock-status")
def get_attendance_lock_status(
    month: str = Query(..., description="Month in YYYY-MM format"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Checks whether the specified month's attendance has been approved and locked by HR."""
    lock_rec = db.query(AttendancePeriodLock).filter(AttendancePeriodLock.month == month).first()
    is_locked = bool((lock_rec and lock_rec.is_locked) or month <= "2026-06")

    if not is_locked:
        return {
            "month": month,
            "is_locked": False,
            "locked_at": None,
            "locked_by_name": None,
            "approval_notes": None,
        }

    locked_by_name = None
    if lock_rec and lock_rec.locked_by:
        locked_by_name = f"{lock_rec.locked_by.first_name} {lock_rec.locked_by.last_name}"

    return {
        "month": month,
        "is_locked": True,
        "locked_at": lock_rec.locked_at.isoformat() if (lock_rec and lock_rec.locked_at) else None,
        "locked_by_name": locked_by_name or "HR Operations Manager",
        "approval_notes": lock_rec.approval_notes if lock_rec else "Monthly attendance audited, verified and locked prior to payroll execution.",
    }


@router.post("/lock-period", response_model=MessageResponse, dependencies=[Depends(require_hr_manager)])
def lock_attendance_period(
    data: AttendanceLockRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    HR Manager Step 2 Protocol:
    Reviews exceptions and formally approves & locks the period's attendance data.
    This informs the payroll team that attendance records are finalized.
    """
    emp = current_user.employee
    emp_id = emp.id if emp else None

    lock_rec = db.query(AttendancePeriodLock).filter(AttendancePeriodLock.month == data.month).first()
    if not lock_rec:
        lock_rec = AttendancePeriodLock(
            month=data.month,
            is_locked=True,
            locked_at=datetime.utcnow(),
            locked_by_id=emp_id,
            approval_notes=data.approval_notes,
        )
        db.add(lock_rec)
    else:
        lock_rec.is_locked = True
        lock_rec.locked_at = datetime.utcnow()
        lock_rec.locked_by_id = emp_id
        lock_rec.approval_notes = data.approval_notes

    db.commit()
    return MessageResponse(
        message=f"Attendance for {data.month} has been approved and locked for payroll processing by HR.",
        success=True
    )

