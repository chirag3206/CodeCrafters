"""
Automated Test Suite: HR Financial Exports (Excel & CSV)
"""
from datetime import date
from database import SessionLocal
from models import Payrun, Payslip, Employee
from services.export_service import export_payrun_excel, export_payrun_csv, export_bank_ach_csv


def test_excel_export_stream_generated():
    db = SessionLocal()
    payrun = db.query(Payrun).first()
    if not payrun:
        payrun = Payrun(reference="PAY/TEST/001", name="Test Payrun", period_start=date(2026, 9, 1), period_end=date(2026, 9, 30))
        db.add(payrun)
        db.commit()

    slips = db.query(Payslip).filter(Payslip.payrun_id == payrun.id).all()
    excel_stream = export_payrun_excel(payrun, slips)

    assert excel_stream is not None
    assert excel_stream.getvalue().startswith(b'PK')  # Standard Zip/XLSX header
    db.close()


def test_csv_and_bank_ach_exports():
    db = SessionLocal()
    payrun = db.query(Payrun).first()
    slips = db.query(Payslip).filter(Payslip.payrun_id == payrun.id).all() if payrun else []

    if payrun:
        csv_text = export_payrun_csv(payrun, slips)
        assert "Payrun Reference" in csv_text
        assert "Net Salary Payable" in csv_text

        bank_csv = export_bank_ach_csv(payrun, slips)
        assert "Beneficiary Name" in bank_csv
        assert "Net Amount" in bank_csv
    db.close()
