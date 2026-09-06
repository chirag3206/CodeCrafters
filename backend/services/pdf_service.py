"""
PeoplePay360 — ReportLab PDF Payslip Generator
Generates publication-quality Odoo-style PDF payslips.
Supports both file output and in-memory bytes (for email attachment).
"""
import io
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from models import Payslip


# ─── Shared Story Builder ─────────────────────────────────────────────────────

def _build_payslip_story(payslip: Payslip) -> list:
    """Builds and returns the ReportLab story list for a payslip.
    Shared by both file and bytes generators.
    """
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "DocTitle", parent=styles["Heading1"],
        fontSize=20, leading=24,
        textColor=colors.HexColor("#4338CA"), spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "SubTitle", parent=styles["Normal"],
        fontSize=10, textColor=colors.HexColor("#6B7280"), spaceAfter=12,
    )
    lbl = ParagraphStyle(
        "HeaderLabel", parent=styles["Normal"],
        fontSize=9, leading=12, textColor=colors.HexColor("#4B5563"),
    )
    val = ParagraphStyle(
        "HeaderVal", parent=styles["Normal"],
        fontSize=9, leading=12, fontName="Helvetica-Bold",
        textColor=colors.HexColor("#111827"),
    )

    story = []
    story.append(Paragraph("<b>PEOPLEPAY360 ENTERPRISE</b>", title_style))
    story.append(Paragraph(
        "Official Confidential Payslip &amp; Remuneration Statement", subtitle_style
    ))
    story.append(HRFlowable(
        width="100%", thickness=1.5, color=colors.HexColor("#4F46E5"), spaceAfter=14
    ))

    emp = payslip.employee
    dept_name = emp.department.name if emp.department else "General"
    pos_title = emp.job_position.title if emp.job_position else "Staff"
    contract = payslip.contract
    contract_ref = contract.reference if contract else "N/A"
    contract_wage = f"INR {contract.wage:,.2f}" if contract else "N/A"
    struct_name = (
        contract.salary_structure.name
        if contract and contract.salary_structure
        else (
            payslip.payrun.salary_structure.name
            if payslip.payrun and payslip.payrun.salary_structure
            else "Standard"
        )
    )

    # ── Employee meta grid ────────────────────────────────────────────────
    meta = [
        [Paragraph("<b>Employee Name:</b>", lbl), Paragraph(f"{emp.first_name} {emp.last_name}", val),
         Paragraph("<b>Pay Period:</b>", lbl), Paragraph(f"{payslip.period_start} to {payslip.period_end}", val)],
        [Paragraph("<b>Employee ID:</b>", lbl), Paragraph(emp.badge_id or f"EMP-{emp.id:03d}", val),
         Paragraph("<b>Payrun Ref:</b>", lbl), Paragraph(payslip.payrun.reference if payslip.payrun else "N/A", val)],
        [Paragraph("<b>Department:</b>", lbl), Paragraph(dept_name, val),
         Paragraph("<b>Disbursement Bank:</b>", lbl),
         Paragraph(f"{emp.bank_name or 'N/A'} (..{str(emp.bank_account_no or '')[-4:]})", val)],
        [Paragraph("<b>Designation:</b>", lbl), Paragraph(pos_title, val),
         Paragraph("<b>Unpaid Leave (LOP):</b>", lbl), Paragraph(f"{payslip.unpaid_leave_days} Day(s)", val)],
        [Paragraph("<b>Worked Days:</b>", lbl),
         Paragraph(f"{payslip.worked_days} of {payslip.scheduled_days} scheduled", val),
         Paragraph("<b>Contract Ref:</b>", lbl), Paragraph(contract_ref, val)],
        [Paragraph("<b>Salary Structure:</b>", lbl), Paragraph(struct_name, val),
         Paragraph("<b>Base Contract Wage:</b>", lbl), Paragraph(contract_wage, val)],
    ]
    t_meta = Table(meta, colWidths=[1.4 * inch, 2.2 * inch, 1.4 * inch, 2.2 * inch])
    t_meta.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F9FAFB")),
        ("PADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#F3F4F6")),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 14))

    # ── Salary lines breakdown ────────────────────────────────────────────
    rows = [[
        Paragraph("<b>Seq</b>", lbl), Paragraph("<b>Salary Component / Rule</b>", lbl),
        Paragraph("<b>Category</b>", lbl), Paragraph("<b>Amount (INR)</b>", lbl),
    ]]
    for line in payslip.lines:
        amt = f"INR {line.amount:,.2f}"
        if line.category == "DEDUCTION":
            amt = f"-INR {line.amount:,.2f}"
        rows.append([
            Paragraph(str(line.sequence), lbl),
            Paragraph(line.rule_name, lbl),
            Paragraph(line.category, lbl),
            Paragraph(f"<b>{amt}</b>", val),
        ])
    t_lines = Table(rows, colWidths=[0.6 * inch, 3.6 * inch, 1.6 * inch, 1.4 * inch])
    t_lines.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEF2FF")),
        ("PADDING", (0, 0), (-1, -1), 5),
        ("ALIGN", (3, 0), (3, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#C7D2FE")),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#F3F4F6")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
    ]))
    story.append(t_lines)
    story.append(Spacer(1, 14))

    # ── Summary totals ────────────────────────────────────────────────────
    summary = [
        [Paragraph("<b>Gross Salary (After LOP):</b>", lbl),
         Paragraph(f"<b>INR {payslip.gross_pay:,.2f}</b>", val)],
        [Paragraph("<b>Total Statutory Deductions:</b>", lbl),
         Paragraph(f"<b>-INR {payslip.total_deductions:,.2f}</b>", val)],
        [Paragraph("<font size='11'><b>NET TAKE-HOME SALARY PAYABLE:</b></font>", lbl),
         Paragraph(f"<font size='12' color='#10B981'><b>INR {payslip.net_pay:,.2f}</b></font>", val)],
    ]
    t_sum = Table(summary, colWidths=[4.2 * inch, 3.0 * inch])
    t_sum.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 1), colors.HexColor("#F9FAFB")),
        ("BACKGROUND", (0, 2), (-1, 2), colors.HexColor("#ECFDF5")),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#10B981")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1FAE5")),
    ]))
    story.append(t_sum)
    story.append(Spacer(1, 20))

    story.append(Paragraph(
        f"<i>This is a computer-generated document and requires no physical signature. "
        f"PeoplePay360 Platform Audit Trail #{payslip.id}-CONFIDENTIAL</i>",
        subtitle_style,
    ))
    return story


# ─── Public API ───────────────────────────────────────────────────────────────

def generate_payslip_pdf(payslip: Payslip, output_dir: str = "generated_payslips") -> str:
    """Generates a styled PDF file for the payslip and returns the file path."""
    os.makedirs(output_dir, exist_ok=True)
    filename = (
        f"payslip_{payslip.id}_{payslip.employee.first_name}"
        f"_{payslip.period_start.strftime('%Y%m')}.pdf"
    )
    filepath = os.path.join(output_dir, filename)
    doc = SimpleDocTemplate(
        filepath, pagesize=letter,
        rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36,
    )
    doc.build(_build_payslip_story(payslip))
    return filepath


def generate_payslip_pdf_bytes(payslip: Payslip) -> bytes:
    """Generates a styled PDF in memory and returns raw bytes (for email attachments)."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36,
    )
    doc.build(_build_payslip_story(payslip))
    return buf.getvalue()
