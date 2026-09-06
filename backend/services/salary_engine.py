"""
PeoplePay360 — Safe Sequenced Salary Rule Engine
Evaluates salary rules in strict ascending sequence using a restricted AST evaluator.
"""
import ast
import math
from typing import Dict, List, Tuple, Any

ALLOWED_NAMES = {"min", "max", "round", "abs", "math", "int", "float"}
ALLOWED_NODES = {
    ast.Expression, ast.BinOp, ast.UnaryOp, ast.Compare,
    ast.BoolOp, ast.IfExp, ast.Call, ast.Constant,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod,
    ast.Pow, ast.USub, ast.UAdd,
    ast.And, ast.Or, ast.Not,
    ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE,
    ast.Subscript, ast.Index, ast.Name, ast.Attribute, ast.Load,
}


def safe_eval_formula(formula: str, context: dict) -> float:
    """Safely evaluate a salary formula expression without arbitrary code execution."""
    try:
        clean_formula = formula.strip()
        tree = ast.parse(clean_formula, mode="eval")
        for node in ast.walk(tree):
            if type(node) not in ALLOWED_NODES:
                raise ValueError(f"Disallowed syntax: {type(node).__name__}")
            if isinstance(node, ast.Name) and node.id.startswith("__"):
                raise ValueError("Dunder access is prohibited")
            if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
                raise ValueError("Dunder attribute access is prohibited")
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name) and node.func.id not in ALLOWED_NAMES:
                    raise ValueError(f"Function call '{node.func.id}' is not allowed in sandbox")

        safe_globals = {
            "__builtins__": {},
            "min": min,
            "max": max,
            "round": round,
            "abs": abs,
            "math": math,
            "int": int,
            "float": float,
        }
        result = eval(compile(tree, "<formula>", "eval"), safe_globals, context)
        return float(result)
    except Exception as e:
        raise ValueError(f"Formula evaluation error: {e}")


def compute_payslip(
    contract: Any,
    worked_days: float,
    total_working_days: int,
    unpaid_leave_days: float,
    paid_leave_days: float,
    overtime_hours: float,
    rules_list: List[Any],
    leave_encashment_amount: float = 0.0,
) -> Tuple[float, float, float, List[dict]]:
    """
    Execute salary rules in strict ascending sequence.
    Returns: (gross_pay, total_deductions, net_pay, payslip_lines)
    """
    if total_working_days <= 0:
        total_working_days = 22  # Fallback standard month working days

    # Safe proxy for contract if ORM model or mock
    wage_val = getattr(contract, "wage", 0.0) if contract else 0.0

    # Prorated wage calculation:
    total_accounted_days = worked_days + paid_leave_days + unpaid_leave_days
    if total_working_days > 0 and total_accounted_days < total_working_days:
        prorated_wage = round((wage_val / total_working_days) * total_accounted_days, 2)
    else:
        prorated_wage = wage_val

    # Build a contract proxy that exposes prorated_wage as .wage
    class _ContractProxy:
        def __init__(self, orig, prorated):
            self._orig = orig
            self.wage = prorated
        def __getattr__(self, name):
            return getattr(self._orig, name)

    contract_proxy = _ContractProxy(contract, prorated_wage) if contract else type("ContractMock", (), {"wage": 0.0})()

    payable_days = worked_days + paid_leave_days

    context = {
        "contract": contract_proxy,
        "worked_days": worked_days,
        "total_working_days": total_working_days,
        "unpaid_leave_days": unpaid_leave_days,
        "paid_leave_days": paid_leave_days,
        "payable_days": payable_days,
        "prorated_wage": prorated_wage,
        "overtime_hours": overtime_hours,
        "rules": {},
        "categories": {
            "BASIC": 0.0,
            "ALLOWANCE": 0.0,
            "GROSS": 0.0,
            "DEDUCTION": 0.0,
            "NET": 0.0,
        },
    }

    # Filter active rules and sort strictly ascending by sequence
    active_rules = [r for r in rules_list if getattr(r, "is_active", True) is not False]
    sorted_rules = sorted(active_rules, key=lambda r: getattr(r, "sequence", 0))
    payslip_lines = []

    for rule in sorted_rules:
        amount = 0.0
        comp_type = rule.computation_type.value if hasattr(rule.computation_type, "value") else str(rule.computation_type)

        if comp_type == "fixed":
            amount = float(rule.fixed_amount or 0.0)
        elif comp_type == "percentage":
            base_code = rule.percentage_base_code
            base_amount = context["rules"].get(base_code, wage_val) if base_code else wage_val
            amount = float(base_amount) * (float(rule.percentage_value or 0.0) / 100.0)
        elif comp_type == "formula":
            if rule.formula_expression:
                amount = safe_eval_formula(rule.formula_expression, context)
            else:
                amount = 0.0

        amount = round(amount + 1e-9, 2)
        rule_code = str(rule.code)
        category_val = rule.category.value if hasattr(rule.category, "value") else str(rule.category)

        context["rules"][rule_code] = amount
        context["categories"][category_val] = round(
            context["categories"].get(category_val, 0.0) + amount + 1e-9, 2
        )

        payslip_lines.append({
            "rule_id": rule.id,
            "rule_name": rule.name,
            "rule_code": rule_code,
            "category": category_val,
            "sequence": rule.sequence,
            "amount": amount,
        })

    # Derive canonical Gross, Deductions, and Net
    gross = context["rules"].get(
        "GROSS_AFTER_LOP",
        context["rules"].get(
            "GROSS_BEFORE_LOP",
            context["categories"].get("BASIC", 0.0) + context["categories"].get("ALLOWANCE", 0.0)
        )
    )
    deductions = context["rules"].get(
        "TOTAL_STATUTORY_DEDUCTIONS",
        context["categories"].get("DEDUCTION", 0.0)
    )
    net = context["rules"].get(
        "NET_SALARY",
        round(gross - deductions, 2)
    )

    if leave_encashment_amount > 0:
        encash_val = round(leave_encashment_amount, 2)
        payslip_lines.append({
            "rule_id": None,
            "rule_name": "Leave Encashment (EL)",
            "rule_code": "LEAVE_ENCASHMENT",
            "category": "ALLOWANCE",
            "sequence": 15,
            "amount": encash_val,
        })
        gross = round(gross + encash_val, 2)
        net = round(net + encash_val, 2)

    return round(gross, 2), round(deductions, 2), round(net, 2), payslip_lines


def validate_formula(formula: str) -> dict:
    """Validate sandbox execution of a given formula string against sample mock values."""
    try:
        sample_context = {
            "contract": type("MockContract", (), {"wage": 6500.0})(),
            "worked_days": 20.0,
            "total_working_days": 22,
            "unpaid_leave_days": 1.0,
            "paid_leave_days": 1.0,
            "payable_days": 21.0,
            "prorated_wage": round((6500.0 / 22) * 21, 2),
            "overtime_hours": 2.5,
            "rules": {
                "BASIC": 6500.0,
                "HRA": 2600.0,
                "CONVEYANCE": 200.0,
                "GROSS_BEFORE_LOP": 9300.0,
                "LOP_DEDUCTION": 295.45,
                "GROSS_AFTER_LOP": 9004.55,
                "PF_DEDUCTION": 780.0,
                "TAX_DEDUCTION": 900.46,
                "TOTAL_STATUTORY_DEDUCTIONS": 1680.46,
            },
            "categories": {
                "BASIC": 6500.0,
                "ALLOWANCE": 2800.0,
                "GROSS": 9004.55,
                "DEDUCTION": 1680.46,
                "NET": 7324.09,
            },
        }
        val = safe_eval_formula(formula, sample_context)
        return {"valid": True, "result": val, "error": None}
    except Exception as e:
        return {"valid": False, "result": None, "error": str(e)}
