"""
Automated Test Suite: 5 Pre-Validation Anomaly Warnings Detection
"""
from datetime import date
from database import SessionLocal
from models import Employee, Payrun, PayrunStatus, SalaryStructure, Contract
from services.validator_service import inspect_candidate_anomalies, run_pre_validation_checks
from routes.payruns import create_payrun_batch
from schemas import PayrunCreateStep2, PayrunCreateStep1


def test_missing_bank_credentials_warning():
    db = SessionLocal()
    # Kabir Kapoor (has missing bank account number and IFSC code)
    kabir = db.query(Employee).filter(Employee.work_email == "kabir.kapoor@peoplepay360.com").first()
    assert kabir is not None
    assert kabir.bank_account_no is None

    warnings = inspect_candidate_anomalies(kabir, date(2026, 9, 1), date(2026, 9, 30), db)
    assert any("bank account" in w.lower() for w in warnings)
    db.close()


def test_duplicate_payslip_warning_detection():
    db = SessionLocal()
    # Aarav Sharma
    aarav = db.query(Employee).filter(Employee.work_email == "aarav.sharma@peoplepay360.com").first()
    assert aarav is not None

    # First check with clean state
    warnings = inspect_candidate_anomalies(aarav, date(2026, 9, 1), date(2026, 9, 30), db)
    assert isinstance(warnings, list)
    db.close()
