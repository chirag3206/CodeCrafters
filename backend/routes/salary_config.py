"""
PeoplePay360 — Salary Structure & Rule Configuration Routes
"""
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user, require_payroll_user, require_payroll_manager
from models import SalaryStructure, SalaryRule, Contract
from schemas import (
    SalaryStructureCreate, SalaryStructureOut,
    SalaryRuleCreate, SalaryRuleOut, MessageResponse
)
from services.salary_engine import validate_formula

router = APIRouter(prefix="/api", tags=["Salary Configuration"])


class FormulaValidateRequest(BaseModel):
    formula: str


class FormulaValidateResponse(BaseModel):
    valid: bool
    result: Optional[float] = None
    error: Optional[str] = None


class SalaryRuleUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    sequence: Optional[int] = None
    computation_type: Optional[str] = None
    fixed_amount: Optional[float] = None
    percentage_base_code: Optional[str] = None
    percentage_value: Optional[float] = None
    formula_expression: Optional[str] = None
    is_active: Optional[bool] = None


# ─── SALARY STRUCTURES ───────────────────────────────────────────────────────

@router.get("/salary-structures", response_model=List[SalaryStructureOut], dependencies=[Depends(require_payroll_user)])
def list_salary_structures(db: Session = Depends(get_db)):
    structures = db.query(SalaryStructure).all()
    result = []
    for s in structures:
        s_out = SalaryStructureOut.model_validate(s)
        s_out.rules_count = len(s.rules)
        s_out.contracts_count = db.query(func.count(Contract.id)).filter(Contract.salary_structure_id == s.id).scalar() or 0
        result.append(s_out)
    return result


@router.get("/salary-structures/{structure_id}", response_model=SalaryStructureOut, dependencies=[Depends(require_payroll_user)])
def get_salary_structure(structure_id: int, db: Session = Depends(get_db)):
    s = db.query(SalaryStructure).filter(SalaryStructure.id == structure_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Salary structure not found")
    s_out = SalaryStructureOut.model_validate(s)
    s_out.rules_count = len(s.rules)
    s_out.contracts_count = db.query(func.count(Contract.id)).filter(Contract.salary_structure_id == s.id).scalar() or 0
    return s_out


@router.post("/salary-structures", response_model=SalaryStructureOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_payroll_manager)])
def create_salary_structure(data: SalaryStructureCreate, db: Session = Depends(get_db)):
    existing = db.query(SalaryStructure).filter(SalaryStructure.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Salary structure with this code already exists")

    s = SalaryStructure(**data.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    s_out = SalaryStructureOut.model_validate(s)
    s_out.rules_count = 0
    s_out.contracts_count = 0
    return s_out


class SalaryStructureUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    is_active: Optional[bool] = None


@router.put("/salary-structures/{structure_id}", response_model=SalaryStructureOut, dependencies=[Depends(require_payroll_manager)])
def update_salary_structure(structure_id: int, data: SalaryStructureUpdate, db: Session = Depends(get_db)):
    s = db.query(SalaryStructure).filter(SalaryStructure.id == structure_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Salary structure not found")

    update_dict = data.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(s, k, v)

    db.commit()
    db.refresh(s)
    s_out = SalaryStructureOut.model_validate(s)
    s_out.rules_count = len(s.rules)
    s_out.contracts_count = db.query(func.count(Contract.id)).filter(Contract.salary_structure_id == s.id).scalar() or 0
    return s_out


# ─── SALARY RULES ────────────────────────────────────────────────────────────

@router.get("/salary-rules", response_model=List[SalaryRuleOut], dependencies=[Depends(require_payroll_user)])
def list_salary_rules(structure_id: int = Query(...), db: Session = Depends(get_db)):
    return db.query(SalaryRule).filter(SalaryRule.structure_id == structure_id).order_by(SalaryRule.sequence).all()


@router.post("/salary-rules", response_model=SalaryRuleOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_payroll_manager)])
def create_salary_rule(data: SalaryRuleCreate, db: Session = Depends(get_db)):
    existing = db.query(SalaryRule).filter(
        SalaryRule.structure_id == data.structure_id,
        SalaryRule.code == data.code
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A rule with this code already exists in this structure")

    # If formula type, validate sandbox safety
    if data.computation_type.value == "formula" and data.formula_expression:
        val_res = validate_formula(data.formula_expression)
        if not val_res["valid"]:
            raise HTTPException(status_code=400, detail=f"Invalid formula expression: {val_res['error']}")

    r = SalaryRule(**data.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.put("/salary-rules/{rule_id}", response_model=SalaryRuleOut, dependencies=[Depends(require_payroll_manager)])
def update_salary_rule(rule_id: int, data: SalaryRuleUpdate, db: Session = Depends(get_db)):
    r = db.query(SalaryRule).filter(SalaryRule.id == rule_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Salary rule not found")

    update_dict = data.model_dump(exclude_unset=True)
    if "formula_expression" in update_dict and update_dict["formula_expression"]:
        val_res = validate_formula(update_dict["formula_expression"])
        if not val_res["valid"]:
            raise HTTPException(status_code=400, detail=f"Invalid formula expression: {val_res['error']}")

    for k, v in update_dict.items():
        setattr(r, k, v)

    db.commit()
    db.refresh(r)
    return r


@router.delete("/salary-rules/{rule_id}", response_model=MessageResponse, dependencies=[Depends(require_payroll_manager)])
def delete_salary_rule(rule_id: int, db: Session = Depends(get_db)):
    r = db.query(SalaryRule).filter(SalaryRule.id == rule_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Salary rule not found")

    db.delete(r)
    db.commit()
    return MessageResponse(message="Salary rule deleted", success=True)


@router.post("/salary-rules/validate-formula", response_model=FormulaValidateResponse, dependencies=[Depends(require_payroll_user)])
def test_formula(data: FormulaValidateRequest):
    """Sandbox tester for salary rule mathematical formulas."""
    res = validate_formula(data.formula)
    return FormulaValidateResponse(valid=res["valid"], result=res["result"], error=res["error"])
