"""
Automated Test Suite: Employee Offboarding & Contract RBAC
- Tests that offboarding an employee moves their status to Retired/Terminated/Left Job/Resigned
- Tests that active/draft contracts for the offboarded employee automatically expire with end_date set to today
- Tests that HR_Manager CANNOT edit or delete contracts (restricted to Payroll Manager and Admin only)
"""
import pytest
from datetime import date
from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from auth import create_access_token
from models import (
    User, UserRole, Employee, EmployeeStatus, Contract, ContractStatus, SalaryStructure
)

client = TestClient(app)


def test_employee_offboarding_and_contract_expiration():
    db = SessionLocal()
    import time
    unique_suffix = int(time.time())
    test_email = f"offboard.test.{unique_suffix}@peoplepay360.com"
    try:
        # Create a test employee with a linked user
        user = User(
            email=test_email,
            hashed_password="hashed_dummy_pw",
            role=UserRole.EMPLOYEE,
            is_active=True,
        )
        db.add(user)
        db.flush()

        emp = Employee(
            user_id=user.id,
            badge_id=f"EMP-TEST-{unique_suffix}",
            first_name="Testy",
            last_name="Tester",
            work_email=test_email,
            status=EmployeeStatus.ACTIVE,
            employment_type="Full-Time",
        )
        db.add(emp)
        db.flush()

        # Create an active contract
        structure = db.query(SalaryStructure).first()
        contract = Contract(
            reference=f"CNT.999.EMP-{unique_suffix}",
            name="Test Offboard Contract",
            employee_id=emp.id,
            salary_structure_id=structure.id if structure else None,
            wage=50000.0,
            start_date=date(2026, 1, 1),
            end_date=None,
            status=ContractStatus.ACTIVE,
        )
        db.add(contract)
        db.commit()

        # Authenticate as HR Manager
        hr_user = db.query(User).filter(User.role == UserRole.HR_MANAGER).first()
        assert hr_user is not None
        token = create_access_token(data={"sub": str(hr_user.id), "role": hr_user.role.value})
        headers = {"Authorization": f"Bearer {token}"}

        # Send offboard request
        res = client.post(
            f"/api/employees/{emp.id}/offboard",
            json={
                "reason": "Resigned",
                "notes": "Transitioned to new venture; handover completed.",
            },
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "offboarded as 'Resigned'" in data["message"]

        # Verify DB: Employee is Resigned, user is inactive
        db.refresh(emp)
        db.refresh(user)
        assert emp.status == EmployeeStatus.RESIGNED
        assert emp.departure_reason == "Resigned"
        assert emp.departure_date == date.today()
        assert user.is_active is False

        # Verify DB: Contract is Expired with end_date set to today
        db.refresh(contract)
        assert contract.status == ContractStatus.EXPIRED
        assert contract.end_date == date.today()

        # Clean up
        db.delete(contract)
        db.delete(emp)
        db.delete(user)
        db.commit()
    finally:
        db.close()


def test_contract_edit_and_delete_rbac():
    db = SessionLocal()
    try:
        # Get an existing contract
        contract = db.query(Contract).filter(Contract.status == ContractStatus.ACTIVE).first()
        assert contract is not None

        # 1. HR Manager should get 403 Forbidden on update and delete
        hr_user = db.query(User).filter(User.role == UserRole.HR_MANAGER).first()
        assert hr_user is not None
        hr_token = create_access_token(data={"sub": str(hr_user.id), "role": hr_user.role.value})
        hr_headers = {"Authorization": f"Bearer {hr_token}"}

        res_update = client.put(
            f"/api/contracts/{contract.id}",
            json={"wage": 99999.0},
            headers=hr_headers,
        )
        assert res_update.status_code == 403

        res_delete = client.delete(
            f"/api/contracts/{contract.id}",
            headers=hr_headers,
        )
        assert res_delete.status_code == 403

        # 2. Payroll Manager should succeed
        pm_user = db.query(User).filter(User.role == UserRole.HR_PAYROLL_MANAGER).first()
        assert pm_user is not None
        pm_token = create_access_token(data={"sub": str(pm_user.id), "role": pm_user.role.value})
        pm_headers = {"Authorization": f"Bearer {pm_token}"}

        original_wage = contract.wage
        res_pm_update = client.put(
            f"/api/contracts/{contract.id}",
            json={"wage": original_wage + 100.0},
            headers=pm_headers,
        )
        assert res_pm_update.status_code == 200
        assert res_pm_update.json()["wage"] == original_wage + 100.0

        # Restore original wage
        client.put(
            f"/api/contracts/{contract.id}",
            json={"wage": original_wage},
            headers=pm_headers,
        )
    finally:
        db.close()


def test_el_carry_forward_and_encashment_on_offboard():
    db = SessionLocal()
    import time
    from models import TimeOffType, TimeOffAllocation, AllocationStatus
    unique_suffix = int(time.time())
    test_email = f"el.encash.{unique_suffix}@peoplepay360.com"
    try:
        user = User(
            email=test_email,
            hashed_password="hashed_dummy_pw",
            role=UserRole.EMPLOYEE,
            is_active=True,
        )
        db.add(user)
        db.flush()

        emp = Employee(
            user_id=user.id,
            badge_id=f"EMP-EL-{unique_suffix}",
            first_name="Earned",
            last_name="LeaveTester",
            work_email=test_email,
            status=EmployeeStatus.ACTIVE,
            employment_type="Full-Time",
        )
        db.add(emp)
        db.flush()

        # Contract wage = 60000 -> Daily rate = 2000
        structure = db.query(SalaryStructure).first()
        contract = Contract(
            reference=f"CNT.EL.{unique_suffix}",
            employee_id=emp.id,
            salary_structure_id=structure.id if structure else None,
            wage=60000.0,
            start_date=date(2026, 1, 1),
            status=ContractStatus.ACTIVE,
        )
        db.add(contract)

        # Paid leave type (Earned Leave)
        el_type = db.query(TimeOffType).filter(TimeOffType.is_paid == True).first()
        assert el_type is not None

        alloc = TimeOffAllocation(
            employee_id=emp.id,
            leave_type_id=el_type.id,
            allocated_days=10.0,
            carried_forward_days=5.0,  # 5 days carried forward from previous year
            valid_from=date(2026, 1, 1),
            valid_to=date(2026, 12, 31),
            status=AllocationStatus.APPROVED,
        )
        db.add(alloc)
        db.commit()

        # HR Manager offboards employee
        hr_user = db.query(User).filter(User.role == UserRole.HR_MANAGER).first()
        token = create_access_token(data={"sub": str(hr_user.id), "role": hr_user.role.value})
        headers = {"Authorization": f"Bearer {token}"}

        res = client.post(
            f"/api/employees/{emp.id}/offboard",
            json={"reason": "Resigned", "notes": "EL encashment test"},
            headers=headers,
        )
        assert res.status_code == 200
        msg = res.json()["message"]
        assert "Unused EL Paid Leaves: 15.0 day(s)" in msg
        assert "Leave Encashment ₹30,000.00" in msg

        db.refresh(emp)
        assert emp.leave_encashment_days == 15.0
        assert emp.leave_encashment_amount == 30000.0

        # Cleanup
        db.delete(alloc)
        db.delete(contract)
        db.delete(emp)
        db.delete(user)
        db.commit()
    finally:
        db.close()


def test_payrun_candidates_endpoint():
    db = SessionLocal()
    try:
        payroll_user = db.query(User).filter(User.role.in_([UserRole.HR_PAYROLL_MANAGER, UserRole.ADMIN])).first()
        assert payroll_user is not None
        token = create_access_token(data={"sub": str(payroll_user.id), "role": payroll_user.role.value})
        headers = {"Authorization": f"Bearer {token}"}

        res = client.get(
            "/api/payruns/eligible-candidates?period_start=2026-08-01&period_end=2026-08-31",
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
    finally:
        db.close()

