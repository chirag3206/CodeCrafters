"""
PeoplePay360 — Time Off & Allocation Ledger Routes
"""
from typing import List, Optional
from datetime import date, datetime, timedelta
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, and_
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user, require_hr_manager
from models import TimeOffType, TimeOffAllocation, TimeOffRequest, AllocationStatus, TimeOffRequestStatus, Employee, UserRole
from schemas import TimeOffTypeOut, TimeOffAllocationOut, TimeOffRequestCreate, TimeOffRequestOut, TimeOffRequestRefuse, BulkLeaveAllocationGrant, MessageResponse

router = APIRouter(prefix="/api/time-off", tags=["Time Off"])


class TimeOffTypeCreate(BaseModel):
    name: str
    unit: str = "Days"
    requires_allocation: bool = True
    is_paid: bool = True
    color: str = "#4F46E5"
    max_days_per_year: Optional[float] = None


class TimeOffAllocationCreate(BaseModel):
    employee_id: int
    leave_type_id: int
    allocated_days: float
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


def _count_business_days(start: date, end: date) -> float:
    """Calculates number of business days (Mon-Fri) inclusive."""
    current = start
    days = 0.0
    while current <= end:
        if current.weekday() < 5:  # Mon-Fri
            days += 1.0
        current += timedelta(days=1)
    return max(1.0, days)


# ─── TIME OFF TYPES ─────────────────────────────────────────────────────────

@router.get("/types", response_model=List[TimeOffTypeOut])
def list_types(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(TimeOffType).order_by(TimeOffType.name).all()


@router.post("/types", response_model=TimeOffTypeOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_hr_manager)])
def create_type(data: TimeOffTypeCreate, db: Session = Depends(get_db)):
    existing = db.query(TimeOffType).filter(TimeOffType.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Time off type with this name already exists")

    t = TimeOffType(**data.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


# ─── ALLOCATIONS LEDGER ─────────────────────────────────────────────────────

@router.get("/allocations", response_model=List[TimeOffAllocationOut])
def list_allocations(
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = db.query(TimeOffAllocation)

    if current_user.role == UserRole.EMPLOYEE:
        emp = current_user.employee
        if not emp:
            return []
        query = query.filter(TimeOffAllocation.employee_id == emp.id)
    elif employee_id:
        query = query.filter(TimeOffAllocation.employee_id == employee_id)

    allocations = query.all()
    result = []

    for alloc in allocations:
        # Calculate approved taken days
        approved_taken = db.query(func.coalesce(func.sum(TimeOffRequest.duration_days), 0.0)).filter(
            TimeOffRequest.employee_id == alloc.employee_id,
            TimeOffRequest.leave_type_id == alloc.leave_type_id,
            TimeOffRequest.status == TimeOffRequestStatus.APPROVED
        ).scalar() or 0.0

        # Calculate pending requests
        pending_days = db.query(func.coalesce(func.sum(TimeOffRequest.duration_days), 0.0)).filter(
            TimeOffRequest.employee_id == alloc.employee_id,
            TimeOffRequest.leave_type_id == alloc.leave_type_id,
            TimeOffRequest.status == TimeOffRequestStatus.SUBMITTED
        ).scalar() or 0.0

        alloc_out = TimeOffAllocationOut.model_validate(alloc)
        alloc_out.approved_taken = float(approved_taken)
        alloc_out.pending_days = float(pending_days)
        # Remaining Balance = Allocated - Approved Taken
        alloc_out.remaining_balance = float(alloc.allocated_days - approved_taken)
        result.append(alloc_out)

    return result


@router.post("/allocations", response_model=TimeOffAllocationOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_hr_manager)])
def create_allocation(data: TimeOffAllocationCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    alloc = TimeOffAllocation(
        employee_id=data.employee_id,
        leave_type_id=data.leave_type_id,
        allocated_days=data.allocated_days,
        valid_from=data.valid_from or date(date.today().year, 1, 1),
        valid_to=data.valid_to or date(date.today().year, 12, 31),
        status=AllocationStatus.APPROVED,
        approved_by_id=current_user.employee.id if current_user.employee else None,
    )
    db.add(alloc)
    db.commit()
    db.refresh(alloc)

    alloc_out = TimeOffAllocationOut.model_validate(alloc)
    alloc_out.remaining_balance = alloc.allocated_days
    return alloc_out


@router.put("/allocations/{allocation_id}/approve", response_model=TimeOffAllocationOut, dependencies=[Depends(require_hr_manager)])
def approve_allocation(allocation_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    alloc = db.query(TimeOffAllocation).filter(TimeOffAllocation.id == allocation_id).first()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")

    alloc.status = AllocationStatus.APPROVED
    alloc.approved_by_id = current_user.employee.id if current_user.employee else None
    db.commit()
    db.refresh(alloc)
    return alloc


@router.put("/allocations/{allocation_id}/refuse", response_model=TimeOffAllocationOut, dependencies=[Depends(require_hr_manager)])
def refuse_allocation(allocation_id: int, db: Session = Depends(get_db)):
    alloc = db.query(TimeOffAllocation).filter(TimeOffAllocation.id == allocation_id).first()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")

    alloc.status = AllocationStatus.REFUSED
    db.commit()
    db.refresh(alloc)
    return alloc


@router.post(
    "/allocations/grant-bulk",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_hr_manager)]
)
def grant_bulk_allocations(
    data: BulkLeaveAllocationGrant,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    leave_type = db.query(TimeOffType).filter(TimeOffType.id == data.leave_type_id).first()
    if not leave_type:
        raise HTTPException(status_code=404, detail="Leave type not found")

    # Determine target employees
    if data.employee_ids and len(data.employee_ids) > 0:
        target_employees = db.query(Employee).filter(Employee.id.in_(data.employee_ids)).all()
    else:
        # All active employees
        target_employees = db.query(Employee).filter(Employee.status == "Active").all()

    if not target_employees:
        raise HTTPException(status_code=400, detail="No matching employees found for allocation grant")

    current_year = date.today().year
    valid_from = data.valid_from or date(current_year, 1, 1)
    valid_to = data.valid_to or date(current_year, 12, 31)
    approver_id = current_user.employee.id if current_user.employee else None

    count_updated = 0
    for emp in target_employees:
        existing_alloc = db.query(TimeOffAllocation).filter(
            TimeOffAllocation.employee_id == emp.id,
            TimeOffAllocation.leave_type_id == data.leave_type_id
        ).first()

        if existing_alloc:
            if data.mode == "set":
                existing_alloc.allocated_days = max(0.0, float(data.allocated_days))
            else:  # "add"
                existing_alloc.allocated_days = max(0.0, float(existing_alloc.allocated_days + data.allocated_days))
            existing_alloc.status = AllocationStatus.APPROVED
            existing_alloc.approved_by_id = approver_id
        else:
            new_alloc = TimeOffAllocation(
                employee_id=emp.id,
                leave_type_id=data.leave_type_id,
                allocated_days=max(0.0, float(data.allocated_days)),
                valid_from=valid_from,
                valid_to=valid_to,
                status=AllocationStatus.APPROVED,
                approved_by_id=approver_id,
            )
            db.add(new_alloc)
        count_updated += 1

    db.commit()

    action_text = "added" if data.mode == "add" else "set"
    return MessageResponse(
        message=f"Successfully {action_text} {data.allocated_days} days of {leave_type.name} quota for {count_updated} employee(s).",
        success=True
    )


# ─── TIME OFF REQUESTS ──────────────────────────────────────────────────────

@router.get("/requests", response_model=List[TimeOffRequestOut])
def list_requests(
    employee_id: Optional[int] = None,
    status_filter: Optional[TimeOffRequestStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = db.query(TimeOffRequest)

    if current_user.role == UserRole.EMPLOYEE:
        emp = current_user.employee
        if not emp:
            return []
        query = query.filter(TimeOffRequest.employee_id == emp.id)
    elif employee_id:
        query = query.filter(TimeOffRequest.employee_id == employee_id)

    if status_filter:
        query = query.filter(TimeOffRequest.status == status_filter)

    return query.order_by(TimeOffRequest.created_at.desc()).all()


@router.post("/requests", response_model=TimeOffRequestOut, status_code=status.HTTP_201_CREATED)
def submit_request(data: TimeOffRequestCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    emp = current_user.employee
    if not emp:
        raise HTTPException(status_code=400, detail="User has no linked employee profile")

    leave_type = db.query(TimeOffType).filter(TimeOffType.id == data.leave_type_id).first()
    if not leave_type:
        raise HTTPException(status_code=404, detail="Leave type not found")

    duration = _count_business_days(data.start_date, data.end_date)

    # If requires allocation, check balance
    if leave_type.requires_allocation:
        alloc_total = db.query(func.coalesce(func.sum(TimeOffAllocation.allocated_days), 0.0)).filter(
            TimeOffAllocation.employee_id == emp.id,
            TimeOffAllocation.leave_type_id == data.leave_type_id,
            TimeOffAllocation.status == AllocationStatus.APPROVED
        ).scalar() or 0.0

        taken_total = db.query(func.coalesce(func.sum(TimeOffRequest.duration_days), 0.0)).filter(
            TimeOffRequest.employee_id == emp.id,
            TimeOffRequest.leave_type_id == data.leave_type_id,
            TimeOffRequest.status == TimeOffRequestStatus.APPROVED
        ).scalar() or 0.0

        available = float(alloc_total - taken_total)
        if duration > available:
            raise HTTPException(
                status_code=400,
                detail=f"Validation Error: Insufficient leave balance (Requested: {duration} Days, Available: {available} Days)."
            )

    req = TimeOffRequest(
        employee_id=emp.id,
        leave_type_id=data.leave_type_id,
        start_date=data.start_date,
        end_date=data.end_date,
        duration_days=duration,
        reason=data.reason,
        status=TimeOffRequestStatus.SUBMITTED,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.put("/requests/{request_id}/approve", response_model=TimeOffRequestOut, dependencies=[Depends(require_hr_manager)])
def approve_request(request_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    req = db.query(TimeOffRequest).filter(TimeOffRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Time off request not found")

    req.status = TimeOffRequestStatus.APPROVED
    req.approved_by_id = current_user.employee.id if current_user.employee else None
    req.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(req)
    return req


@router.put("/requests/{request_id}/refuse", response_model=TimeOffRequestOut, dependencies=[Depends(require_hr_manager)])
def refuse_request(
    request_id: int,
    data: Optional[TimeOffRequestRefuse] = None,
    db: Session = Depends(get_db)
):
    req = db.query(TimeOffRequest).filter(TimeOffRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Time off request not found")

    req.status = TimeOffRequestStatus.REFUSED
    if data and data.rejection_reason:
        req.rejection_reason = data.rejection_reason
    db.commit()
    db.refresh(req)
    return req
