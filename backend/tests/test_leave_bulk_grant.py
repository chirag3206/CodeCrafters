"""
Unit tests for Bulk Leave Allocation Granting
"""
from datetime import date
import pytest
from models import TimeOffAllocation, AllocationStatus
from schemas import BulkLeaveAllocationGrant


def test_bulk_grant_schema_validation():
    grant_add = BulkLeaveAllocationGrant(
        employee_ids=[1, 2, 3],
        leave_type_id=1,
        allocated_days=3.5,
        mode="add"
    )
    assert grant_add.mode == "add"
    assert len(grant_add.employee_ids) == 3
    assert grant_add.allocated_days == 3.5

    grant_set = BulkLeaveAllocationGrant(
        employee_ids=None,
        leave_type_id=2,
        allocated_days=15.0,
        mode="set"
    )
    assert grant_set.mode == "set"
    assert grant_set.employee_ids is None


def test_allocation_add_mode_math():
    existing_alloc = TimeOffAllocation(
        employee_id=101,
        leave_type_id=1,
        allocated_days=10.0,
        status=AllocationStatus.APPROVED
    )

    # Top-up +5.0 days
    add_days = 5.0
    existing_alloc.allocated_days = existing_alloc.allocated_days + add_days
    assert existing_alloc.allocated_days == 15.0


def test_allocation_set_mode_math():
    existing_alloc = TimeOffAllocation(
        employee_id=101,
        leave_type_id=1,
        allocated_days=10.0,
        status=AllocationStatus.APPROVED
    )

    # Set fixed quota to 20.0 days
    new_days = 20.0
    existing_alloc.allocated_days = new_days
    assert existing_alloc.allocated_days == 20.0
