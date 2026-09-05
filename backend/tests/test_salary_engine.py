"""
Automated Test Suite: Sequenced Salary Calculation Engine & Safe AST Formula Sandbox
"""
import pytest
from services.salary_engine import safe_eval_formula, compute_payslip, validate_formula
from models import SalaryRule, RuleCategory, ComputationType


class MockContract:
    def __init__(self, wage=6500.0):
        self.wage = wage


def test_safe_formula_evaluator_arithmetic():
    context = {"contract": MockContract(6500.0), "rules": {"BASIC": 6500.0, "HRA": 2600.0}}
    result = safe_eval_formula("rules['BASIC'] + rules['HRA']", context)
    assert result == 9100.0


def test_safe_formula_evaluator_math_functions():
    context = {"rules": {"WAGE": 5000.0}}
    result = safe_eval_formula("round(min(rules['WAGE'], 6000.0) * 0.12, 2)", context)
    assert result == 600.0


def test_malicious_formula_injection_blocked():
    context = {}
    with pytest.raises(ValueError):
        safe_eval_formula("__import__('os').system('ls')", context)

    with pytest.raises(ValueError):
        safe_eval_formula("open('/etc/passwd').read()", context)


def test_alex_rivera_worked_example_calculation():
    """
    Validates exact numerical trace from PEOPLEPAY360_SPECIFICATION.md Section 7:
    Alex Rivera (Base: $6,500.00, Scheduled: 22d, Worked: 20d, Unpaid LOP: 1d, Paid Leave: 1d, OT: 2.5h)
    Expected Net Take-Home Salary: $7,324.09
    """
    contract = MockContract(6500.0)

    rules = [
        SalaryRule(id=1, name="Basic Salary", code="BASIC", category=RuleCategory.BASIC, sequence=10, computation_type=ComputationType.FORMULA, formula_expression="contract.wage", is_active=True),
        SalaryRule(id=2, name="House Rent Allowance", code="HRA", category=RuleCategory.ALLOWANCE, sequence=20, computation_type=ComputationType.PERCENTAGE, percentage_base_code="BASIC", percentage_value=40.0, is_active=True),
        SalaryRule(id=3, name="Conveyance Allowance", code="CONVEYANCE", category=RuleCategory.ALLOWANCE, sequence=30, computation_type=ComputationType.FIXED, fixed_amount=200.0, is_active=True),
        SalaryRule(id=4, name="Gross Before LOP", code="GROSS_BEFORE_LOP", category=RuleCategory.GROSS, sequence=40, computation_type=ComputationType.FORMULA, formula_expression="rules['BASIC'] + rules['HRA'] + rules['CONVEYANCE']", is_active=True),
        SalaryRule(id=5, name="Loss of Pay Deduction", code="LOP_DEDUCTION", category=RuleCategory.DEDUCTION, sequence=50, computation_type=ComputationType.FORMULA, formula_expression="(rules['BASIC'] / total_working_days) * unpaid_leave_days", is_active=True),
        SalaryRule(id=6, name="Gross After LOP", code="GROSS_AFTER_LOP", category=RuleCategory.GROSS, sequence=60, computation_type=ComputationType.FORMULA, formula_expression="rules['GROSS_BEFORE_LOP'] - rules['LOP_DEDUCTION']", is_active=True),
        SalaryRule(id=7, name="Provident Fund (PF)", code="PF_DEDUCTION", category=RuleCategory.DEDUCTION, sequence=70, computation_type=ComputationType.PERCENTAGE, percentage_base_code="BASIC", percentage_value=12.0, is_active=True),
        SalaryRule(id=8, name="Income Tax / TDS", code="TAX_DEDUCTION", category=RuleCategory.DEDUCTION, sequence=80, computation_type=ComputationType.PERCENTAGE, percentage_base_code="GROSS_AFTER_LOP", percentage_value=10.0, is_active=True),
        SalaryRule(id=9, name="Total Statutory Deductions", code="TOTAL_STATUTORY_DEDUCTIONS", category=RuleCategory.DEDUCTION, sequence=90, computation_type=ComputationType.FORMULA, formula_expression="rules['PF_DEDUCTION'] + rules['TAX_DEDUCTION']", is_active=True),
        SalaryRule(id=10, name="Net Salary", code="NET_SALARY", category=RuleCategory.NET, sequence=100, computation_type=ComputationType.FORMULA, formula_expression="rules['GROSS_AFTER_LOP'] - rules['TOTAL_STATUTORY_DEDUCTIONS']", is_active=True),
    ]

    gross, deductions, net, lines = compute_payslip(
        contract=contract,
        worked_days=20.0,
        total_working_days=22,
        unpaid_leave_days=1.0,
        paid_leave_days=1.0,
        overtime_hours=2.5,
        rules_list=rules,
    )

    assert gross == 9004.55
    assert deductions == 1680.46
    assert net == 7324.09
    assert len(lines) == 10
