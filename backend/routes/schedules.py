"""
PeoplePay360 — Working Schedule Setup & Company Office Hours Management
"""
from typing import List, Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database import get_db
from dependencies import get_current_user, require_hr_manager
from models import WorkingSchedule, ScheduleDayLine, Employee, OfficeHoursNotification, UserRole
from schemas import (
    WorkingScheduleOut, MessageResponse,
    OfficeHoursUpdateRequest, OfficeHoursNotificationOut
)

router = APIRouter(prefix="/api/schedules", tags=["Working Schedules"])


class ScheduleDayLineIn(BaseModel):
    day_of_week: str
    start_time: str
    end_time: str
    break_hours: float = 1.0


class ScheduleCreateIn(BaseModel):
    name: str
    work_days_summary: Optional[str] = "Mon - Fri, 09:00 - 18:00"
    day_lines: List[ScheduleDayLineIn] = []


def _parse_time_hours(time_str: str) -> float:
    parts = time_str.split(":")
    return int(parts[0]) + int(parts[1]) / 60.0


@router.get("", response_model=List[WorkingScheduleOut])
def list_schedules(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(WorkingSchedule).all()


@router.get("/active-notifications", response_model=List[OfficeHoursNotificationOut])
def get_active_notifications(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """
    Returns active company office hours update notifications created within the last 3 days.
    Broadcasts to Employee, HR Manager, Payroll User, and Admin upon login.
    """
    now = datetime.utcnow()
    notifications = db.query(OfficeHoursNotification).filter(
        OfficeHoursNotification.expires_at >= now
    ).order_by(desc(OfficeHoursNotification.created_at)).all()
    return notifications


@router.get("/{schedule_id}", response_model=WorkingScheduleOut)
def get_schedule(schedule_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    sch = db.query(WorkingSchedule).filter(WorkingSchedule.id == schedule_id).first()
    if not sch:
        raise HTTPException(status_code=404, detail="Working schedule not found")
    return sch


@router.post("", response_model=WorkingScheduleOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_hr_manager)])
def create_schedule(data: ScheduleCreateIn, db: Session = Depends(get_db)):
    existing = db.query(WorkingSchedule).filter(WorkingSchedule.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Schedule with this name already exists")

    total_hours = 0.0
    day_line_models = []

    for line in data.day_lines:
        start_h = _parse_time_hours(line.start_time)
        end_h = _parse_time_hours(line.end_time)
        net = max(0.0, (end_h - start_h) - line.break_hours)
        total_hours += net
        day_line_models.append(
            ScheduleDayLine(
                day_of_week=line.day_of_week,
                start_time=line.start_time,
                end_time=line.end_time,
                break_hours=line.break_hours,
                net_hours=net,
            )
        )

    sch = WorkingSchedule(
        name=data.name,
        total_weekly_hours=total_hours or 40.0,
        work_days_summary=data.work_days_summary,
        day_lines=day_line_models,
    )
    db.add(sch)
    db.commit()
    db.refresh(sch)
    return sch


@router.post("/office-hours", response_model=OfficeHoursNotificationOut, dependencies=[Depends(require_hr_manager)])
def update_office_hours(
    data: OfficeHoursUpdateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Admin Protocol for Updating Company Office Hours:
    1. Validates start and end times (End time > Start time, net hours between 4.0 and 12.0).
    2. Enforces mandatory reason and effective date.
    3. Updates the primary company WorkingSchedule and all day lines in the database.
    4. Automatically creates a 3-day broadcast notification for all employees/HR/admins.
    5. Applies the ±45 min grace buffer exemption for salary deductions.
    """
    start_h = _parse_time_hours(data.start_time)
    end_h = _parse_time_hours(data.end_time)

    if end_h <= start_h:
        raise HTTPException(status_code=400, detail="Office closing time must be after opening time")

    net_hours = (end_h - start_h) - data.break_hours
    if net_hours < 4.0:
        raise HTTPException(status_code=400, detail="Net daily working hours cannot be less than 4.0 hours")
    if net_hours > 12.0:
        raise HTTPException(status_code=400, detail="Net daily working hours cannot exceed 12.0 hours (statutory limit)")

    if not data.reason or len(data.reason.strip()) < 5:
        raise HTTPException(status_code=400, detail="Mandatory protocol justification/reason required (minimum 5 characters)")

    # Find or default primary working schedule
    sch = db.query(WorkingSchedule).first()
    if not sch:
        sch = WorkingSchedule(
            name="Standard 40h/week",
            total_weekly_hours=round(net_hours * 5.0, 1),
            work_days_summary=f"Mon - Fri, {data.start_time} - {data.end_time}",
        )
        db.add(sch)
        db.flush()

    old_start = "09:00"
    old_end = "18:00"
    if sch.day_lines:
        old_start = sch.day_lines[0].start_time
        old_end = sch.day_lines[0].end_time

    # Update summary and weekly hours
    sch.work_days_summary = f"Mon - Fri, {data.start_time} - {data.end_time}"
    sch.total_weekly_hours = round(net_hours * 5.0, 1)

    # Update or add lines for Monday-Friday
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    existing_lines = {line.day_of_week: line for line in sch.day_lines}

    for day in days:
        if day in existing_lines:
            line = existing_lines[day]
            line.start_time = data.start_time
            line.end_time = data.end_time
            line.break_hours = data.break_hours
            line.net_hours = round(net_hours, 2)
        else:
            db.add(ScheduleDayLine(
                schedule_id=sch.id,
                day_of_week=day,
                start_time=data.start_time,
                end_time=data.end_time,
                break_hours=data.break_hours,
                net_hours=round(net_hours, 2),
            ))

    # Calculate 3-day broadcast expiration
    now = datetime.utcnow()
    expires_at = now + timedelta(days=3)

    updater_name = current_user.employee.full_name if (current_user.employee and current_user.employee.full_name) else "System Administrator"

    notification = OfficeHoursNotification(
        title="Company Office Timings Updated",
        message=(
            f"Official company office timings have been revised to {data.start_time} - {data.end_time} "
            f"(Net {net_hours:.1f} hrs/day) effective from {data.effective_date}. "
            f"Reason: {data.reason}. Note: ±{data.grace_minutes} min early or late check-in/out is exempted from salary deductions."
        ),
        old_start_time=old_start,
        old_end_time=old_end,
        new_start_time=data.start_time,
        new_end_time=data.end_time,
        grace_minutes=data.grace_minutes,
        effective_date=data.effective_date,
        reason=data.reason,
        updated_by_name=updater_name,
        created_at=now,
        expires_at=expires_at,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


@router.delete("/{schedule_id}", response_model=MessageResponse, dependencies=[Depends(require_hr_manager)])
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    sch = db.query(WorkingSchedule).filter(WorkingSchedule.id == schedule_id).first()
    if not sch:
        raise HTTPException(status_code=404, detail="Working schedule not found")

    assigned_emps = db.query(Employee).filter(Employee.working_schedule_id == schedule_id).count()
    if assigned_emps > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete schedule assigned to {assigned_emps} employee(s)")

    db.delete(sch)
    db.commit()
    return MessageResponse(message="Working schedule deleted successfully", success=True)
