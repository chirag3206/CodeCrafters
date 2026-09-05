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


def test_contract_overlap_prevention():
    """
    Validates that creating an active contract that overlaps in date range
    with an existing active contract for the same employee is rejected.
    """
    from fastapi.testclient import TestClient
    from main import app
    from auth import create_access_token
    from models import User, UserRole

    client = TestClient(app)
    db = SessionLocal()
    hr_user = db.query(User).filter(User.role == UserRole.HR_MANAGER).first()
    assert hr_user is not None
    token = create_access_token(data={"sub": str(hr_user.id), "role": hr_user.role.value})
    headers = {"Authorization": f"Bearer {token}"}

    emp = db.query(Employee).filter(Employee.work_email == "aarav.sharma@peoplepay360.com").first()
    assert emp is not None

    # Try to create an active contract that overlaps with 2026-01-01 -> Indefinite
    overlapping_payload = {
        "reference": "CNT-OVERLAP-TEST-99",
        "name": "Overlapping Contract Test",
        "employee_id": emp.id,
        "contract_type": "Permanent",
        "wage": 70000.0,
        "start_date": "2026-06-01",
        "end_date": "2026-12-31",
        "payment_frequency": "Monthly",
    }

    res = client.post("/api/contracts", json=overlapping_payload, headers=headers)
    assert res.status_code == 400
    assert "already exists for this employee covering the specified dates" in res.json()["detail"]
    db.close()

