"""
PeoplePay360 — Contract Management Routes
"""
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user, require_hr_manager, require_payroll_manager
from models import Contract, ContractStatus, Employee, SalaryStructure, WorkingSchedule, UserRole
from schemas import ContractCreate, ContractOut, ContractUpdate, MessageResponse

router = APIRouter(prefix="/api/contracts", tags=["Contracts"])


@router.get("", response_model=List[ContractOut])
def list_contracts(
    q: Optional[str] = None,
    employee_id: Optional[int] = None,
    department_id: Optional[int] = None,
    salary_structure_id: Optional[int] = None,
    status_filter: Optional[ContractStatus] = Query(None, alias="status"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = db.query(Contract)

    # RBAC: Employees only see their own contracts
    if current_user.role == UserRole.EMPLOYEE:
        emp = current_user.employee
        if not emp:
            return []
        query = query.filter(Contract.employee_id == emp.id)
    elif employee_id:
        query = query.filter(Contract.employee_id == employee_id)

    if status_filter:
        query = query.filter(Contract.status == status_filter)

    if salary_structure_id:
        query = query.filter(Contract.salary_structure_id == salary_structure_id)

    if department_id:
        query = query.filter(
            or_(
                Contract.department_id == department_id,
                Contract.employee.has(Employee.department_id == department_id)
            )
        )

    if q:
        pattern = f"%{q}%"
        query = query.outerjoin(Employee, Contract.employee_id == Employee.id).filter(
            or_(
                Contract.reference.ilike(pattern),
                Contract.name.ilike(pattern),
                Employee.first_name.ilike(pattern),
                Employee.last_name.ilike(pattern),
                Employee.badge_id.ilike(pattern),
                Employee.work_email.ilike(pattern),
            )
        )

    contracts = query.order_by(Contract.start_date.desc()).offset(skip).limit(limit).all()
    return contracts


@router.get("/{contract_id}", response_model=ContractOut)
def get_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    if current_user.role == UserRole.EMPLOYEE:
        emp = current_user.employee
        if not emp or emp.id != contract.employee_id:
            raise HTTPException(status_code=403, detail="Access denied to this contract")

    return contract


@router.post("", response_model=ContractOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_hr_manager)])
def create_contract(
    data: ContractCreate,
    db: Session = Depends(get_db)
):
    # Check duplicate reference
    existing_ref = db.query(Contract).filter(Contract.reference == data.reference).first()
    if existing_ref:
        raise HTTPException(status_code=400, detail="Contract with this reference already exists")

    # Guard: Prohibit overlapping ACTIVE contracts for the same employee
    # Overlap occurs if S1 <= E2 (or E2 is null) and E1 >= S2 (or E1 is null)
    existing_active = db.query(Contract).filter(
        Contract.employee_id == data.employee_id,
        Contract.status == ContractStatus.ACTIVE,
        Contract.start_date <= (data.end_date or date(9999, 12, 31)),
        or_(Contract.end_date >= data.start_date, Contract.end_date.is_(None))
    ).first()

    if existing_active:
        raise HTTPException(
            status_code=400,
            detail="Validation Error: An active contract already exists for this employee covering the specified dates."
        )

    contract = Contract(
        reference=data.reference,
        name=data.name or f"Contract - {data.reference}",
        employee_id=data.employee_id,
        contract_type=data.contract_type or "Permanent",
        department_id=data.department_id,
        job_position_id=data.job_position_id,
        salary_structure_id=data.salary_structure_id,
        working_schedule_id=data.working_schedule_id,
        wage=data.wage,
        payment_frequency=data.payment_frequency or "Monthly",
        start_date=data.start_date,
        end_date=data.end_date,
        status=ContractStatus.ACTIVE,
        notes=data.notes,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return contract


@router.put("/{contract_id}", response_model=ContractOut, dependencies=[Depends(require_payroll_manager)])
def update_contract(
    contract_id: int,
    data: ContractUpdate,
    db: Session = Depends(get_db)
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    update_dict = data.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(contract, k, v)

    db.commit()
    db.refresh(contract)
    return contract


@router.delete("/{contract_id}", response_model=MessageResponse, dependencies=[Depends(require_payroll_manager)])
def terminate_contract(
    contract_id: int,
    db: Session = Depends(get_db)
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    contract.status = ContractStatus.TERMINATED
    db.commit()
    return MessageResponse(message=f"Contract {contract.reference} marked as Terminated", success=True)


@router.get("/resolve/{employee_id}", response_model=Optional[ContractOut])
def resolve_applicable_contract(
    employee_id: int,
    period_start: date = Query(...),
    period_end: date = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Date-based Contract Resolution Algorithm:
    Resolves the single contract applicable to the selected payroll period
    (start_date <= period_end AND (end_date >= period_start OR end_date IS NULL)).
    """
    contract = db.query(Contract).filter(
        Contract.employee_id == employee_id,
        Contract.start_date <= period_end,
        or_(Contract.end_date >= period_start, Contract.end_date.is_(None)),
        Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.EXPIRED])
    ).order_by(Contract.start_date.desc()).first()

    return contract
