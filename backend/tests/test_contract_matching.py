"""
Automated Test Suite: Date-Based Contract Resolution & Overlap Prevention
"""
from datetime import date
from database import SessionLocal
from models import Contract, ContractStatus, Employee


def test_contract_historical_period_resolution():
    """
    Validates date-based resolution for historical pay periods:
    Historical 2024-2025 payrun selects historical contract (5,525/mo),
    Current 2026 payrun selects active contract (6,500/mo).
    """
    db = SessionLocal()
    emp = db.query(Employee).filter(Employee.work_email == "aarav.sharma@peoplepay360.com").first()
    assert emp is not None

    # Historical Period (2025-06-01 to 2025-06-30)
    historical_contract = db.query(Contract).filter(
        Contract.employee_id == emp.id,
        Contract.start_date <= date(2025, 6, 30),
        Contract.end_date >= date(2025, 6, 1),
    ).first()

    assert historical_contract is not None
    assert historical_contract.status == ContractStatus.EXPIRED
    assert historical_contract.wage == 55250.0

    # Current Period (2026-09-01 to 2026-09-30)
    current_contract = db.query(Contract).filter(
        Contract.employee_id == emp.id,
        Contract.start_date <= date(2026, 9, 30),
        Contract.status == ContractStatus.ACTIVE,
    ).first()

    assert current_contract is not None
    assert current_contract.wage == 65000.0
    db.close()
