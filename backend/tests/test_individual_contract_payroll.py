"""
Test Suite: Individual Contract-Based Payroll and Payslip Generation
"""
from datetime import date
from database import SessionLocal
from models import (
    Employee, Contract, ContractStatus, SalaryStructure, Payrun, PayrunStatus,
    Payslip, PayslipStatus
)
from services.pdf_service import generate_payslip_pdf
from routes.payruns import _execute_compute_payrun


def test_individual_contract_payroll_computation():
    db = SessionLocal()
    try:
        exec_struct = db.query(SalaryStructure).filter(SalaryStructure.code == "EXECUTIVE_LEADERSHIP").first()
        contractor_struct = db.query(SalaryStructure).filter(SalaryStructure.code == "CONTRACTOR_TDS").first()
        standard_struct = db.query(SalaryStructure).filter(SalaryStructure.code == "STANDARD_REGULAR").first()

        assert exec_struct is not None, "Executive structure should exist"
        assert contractor_struct is not None, "Contractor structure should exist"

        employees = db.query(Employee).limit(2).all()
        assert len(employees) >= 2, "Need at least 2 employees"
        emp1, emp2 = employees[0], employees[1]

        c1 = db.query(Contract).filter(
            Contract.employee_id == emp1.id,
            Contract.status == ContractStatus.ACTIVE
        ).first()
        orig_wage1 = c1.wage if c1 else None
        orig_struct1 = c1.salary_structure_id if c1 else None
        if c1:
            c1.salary_structure_id = exec_struct.id
            c1.wage = 120000.0
        else:
            c1 = Contract(
                reference=f"CNT.991.{emp1.badge_id or emp1.id}",
                employee_id=emp1.id,
                salary_structure_id=exec_struct.id,
                wage=120000.0,
                start_date=date(2026, 1, 1),
                status=ContractStatus.ACTIVE,
            )
            db.add(c1)

        c2 = db.query(Contract).filter(
            Contract.employee_id == emp2.id,
            Contract.status == ContractStatus.ACTIVE
        ).first()
        orig_wage2 = c2.wage if c2 else None
        orig_struct2 = c2.salary_structure_id if c2 else None
        if c2:
            c2.salary_structure_id = contractor_struct.id
            c2.wage = 45000.0
        else:
            c2 = Contract(
                reference=f"CNT.992.{emp2.badge_id or emp2.id}",
                employee_id=emp2.id,
                salary_structure_id=contractor_struct.id,
                wage=45000.0,
                start_date=date(2026, 1, 1),
                status=ContractStatus.ACTIVE,
            )
            db.add(c2)

        # Ensure emp1 and emp2 have full attendance in August 2026 for testing contract formulas
        from datetime import timedelta
        from models import Attendance, AttendanceStatus
        for emp in [emp1, emp2]:
            cur = date(2026, 8, 1)
            while cur <= date(2026, 8, 31):
                if cur.weekday() < 5:
                    att = db.query(Attendance).filter(Attendance.employee_id == emp.id, Attendance.date == cur).first()
                    if not att:
                        db.add(Attendance(employee_id=emp.id, date=cur, status=AttendanceStatus.PRESENT, worked_hours=8.0))
                cur += timedelta(days=1)

        import time
        # Clean up any leftover test payruns
        for old in db.query(Payrun).filter(Payrun.reference.like("TEST/PAY/%")).all():
            db.delete(old)
        db.commit()

        unique_ref = f"TEST/PAY/{int(time.time() * 1000)}"
        test_payrun = Payrun(
            reference=unique_ref,
            name="Contract Individual Verification Batch",
            salary_structure_id=standard_struct.id if standard_struct else None,
            period_start=date(2026, 8, 1),
            period_end=date(2026, 8, 31),
            status=PayrunStatus.DRAFT,
        )
        db.add(test_payrun)
        db.flush()

        slip1 = Payslip(
            payrun_id=test_payrun.id,
            employee_id=emp1.id,
            contract_id=c1.id,
            period_start=date(2026, 8, 1),
            period_end=date(2026, 8, 31),
            scheduled_days=22,
            status=PayslipStatus.DRAFT,
        )
        slip2 = Payslip(
            payrun_id=test_payrun.id,
            employee_id=emp2.id,
            contract_id=c2.id,
            period_start=date(2026, 8, 1),
            period_end=date(2026, 8, 31),
            scheduled_days=22,
            status=PayslipStatus.DRAFT,
        )
        db.add(slip1)
        db.add(slip2)
        db.commit()

        _execute_compute_payrun(test_payrun, db)
        db.commit()

        db.refresh(slip1)
        slip1_codes = {line.rule_code: line.amount for line in slip1.lines}
        assert "HRA" in slip1_codes, "Employee 1 must have HRA from Executive contract structure"
        assert slip1_codes["BASIC"] == 120000.0, f"Expected 120,000 BASIC, got {slip1_codes.get('BASIC')}"
        assert slip1_codes["HRA"] == 60000.0, f"Expected 60,000 HRA (50%), got {slip1_codes.get('HRA')}"
        assert "SPECIAL_ALLOWANCE" in slip1_codes, "Executive must have SPECIAL_ALLOWANCE"
        assert slip1_codes["SPECIAL_ALLOWANCE"] == 30000.0, f"Expected 30,000 Special Allowance"

        db.refresh(slip2)
        slip2_codes = {line.rule_code: line.amount for line in slip2.lines}
        assert "TAX_DEDUCTION" in slip2_codes, "Employee 2 must have TAX_DEDUCTION rule"
        assert slip2_codes["TAX_DEDUCTION"] == 4500.0, f"Expected 4,500 TDS (10%), got {slip2_codes.get('TAX_DEDUCTION')}"
        assert slip2_codes["NET_SALARY"] == 40500.0, f"Expected 40,500 Net, got {slip2_codes.get('NET_SALARY')}"
        assert "HRA" not in slip2_codes, "Contractor must NOT have HRA"
        assert "PF_DEDUCTION" not in slip2_codes, "Contractor must NOT have PF"

        pdf1 = generate_payslip_pdf(slip1)
        pdf2 = generate_payslip_pdf(slip2)
        assert pdf1 is not None and pdf1.endswith(".pdf")
        assert pdf2 is not None and pdf2.endswith(".pdf")

        db.delete(test_payrun)
        db.commit()
    finally:
        if c1 and orig_wage1 is not None:
            c1.wage = orig_wage1
            c1.salary_structure_id = orig_struct1
        if c2 and orig_wage2 is not None:
            c2.wage = orig_wage2
            c2.salary_structure_id = orig_struct2
        db.commit()
        db.close()
