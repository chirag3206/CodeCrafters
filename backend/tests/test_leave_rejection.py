"""
Unit tests for Leave Request Rejection Reasons
"""
from datetime import date
import pytest
from models import TimeOffRequest, TimeOffRequestStatus, UserRole
from schemas import TimeOffRequestRefuse


def test_leave_refusal_with_rejection_reason():
    payload = TimeOffRequestRefuse(rejection_reason="Project deployment deadline requires full team presence")
    assert payload.rejection_reason == "Project deployment deadline requires full team presence"

    req = TimeOffRequest(
        employee_id=1,
        leave_type_id=1,
        start_date=date(2026, 9, 10),
        end_date=date(2026, 9, 12),
        duration_days=3.0,
        reason="Personal trip",
        status=TimeOffRequestStatus.SUBMITTED
    )

    # Apply refusal
    req.status = TimeOffRequestStatus.REFUSED
    req.rejection_reason = payload.rejection_reason

    assert req.status == TimeOffRequestStatus.REFUSED
    assert req.rejection_reason == "Project deployment deadline requires full team presence"
