"""
Automated Test Suite: 5-Tier RBAC Endpoint Isolation
"""
from fastapi.testclient import TestClient
from main import app
from auth import create_access_token

client = TestClient(app)


def test_unauthenticated_blocked():
    response = client.get("/api/employees")
    assert response.status_code == 403 or response.status_code == 401


def test_employee_cannot_access_payruns():
    # Alex Rivera (Employee, ID=1)
    token = create_access_token({"sub": "1", "role": "Employee"})
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/payruns", headers=headers)
    assert response.status_code == 403


def test_payroll_user_can_access_payruns():
    # David Chen (HR_Payroll_User, ID=3)
    token = create_access_token({"sub": "3", "role": "HR_Payroll_User"})
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/payruns", headers=headers)
    assert response.status_code == 200
