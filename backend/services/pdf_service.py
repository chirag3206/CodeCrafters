"""
PeoplePay360 — ReportLab PDF Payslip Generator
Generates publication-quality Odoo-style PDF payslips.
"""
import os
from typing import Optional
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from models import Payslip


def generate_payslip_pdf(payslip: Payslip, output_dir: str = "generated_payslips") -> str:
    """Generates a styled PDF file for the payslip and returns the relative/absolute file path."""
    os.makedirs(output_dir, exist_ok=True)
    filename = f"payslip_{payslip.id}_{payslip.employee.first_name}_{payslip.period_start.strftime('%Y%m')}.pdf"
    filepath = os.path.join(output_dir, filename)

    doc = SimpleDocTemplate(
        filepath,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )
    story = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#4338CA"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "SubTitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#6B7280"),
        spaceAfter=12,
    )
    header_lbl_style = ParagraphStyle(
        "HeaderLabel",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#4B5563"),
    )
    header_val_style = ParagraphStyle(
        "HeaderVal",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#111827"),
    )

    # Header section
    story.append(Paragraph("<b>PEOPLEPAY360 ENTERPRISE</b>", title_style))
    story.append(Paragraph("Official Confidential Payslip & Remuneration Statement", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#4F46E5"), spaceAfter=14))

    emp = payslip.employee
    dept_name = emp.department.name if emp.department else "General"
    pos_title = emp.job_position.title if emp.job_position else "Staff"

    emp_meta = [
        [
            Paragraph("<b>Employee Name:</b>", header_lbl_style),
            Paragraph(f"{emp.first_name} {emp.last_name}", header_val_style),
            Paragraph("<b>Pay Period:</b>", header_lbl_style),
            Paragraph(f"{payslip.period_start} to {payslip.period_end}", header_val_style),
        ],
        [
            Paragraph("<b>Employee ID:</b>", header_lbl_style),
            Paragraph(emp.badge_id or f"EMP-{emp.id:03d}", header_val_style),
            Paragraph("<b>Payrun Ref:</b>", header_lbl_style),
            Paragraph(payslip.payrun.reference if payslip.payrun else "N/A", header_val_style),
        ],
        [
            Paragraph("<b>Department:</b>", header_lbl_style),
            Paragraph(dept_name, header_val_style),
            Paragraph("<b>Disbursement Bank:</b>", header_lbl_style),
            Paragraph(f"{emp.bank_name or 'N/A'} (..{str(emp.bank_account_no or '')[-4:]})", header_val_style),
        ],
        [
            Paragraph("<b>Designation:</b>", header_lbl_style),
            Paragraph(pos_title, header_val_style),
            Paragraph("<b>Unpaid Leave (LOP):</b>", header_lbl_style),
            Paragraph(f"{payslip.unpaid_leave_days} Day(s)", header_val_style),
        ],
        [
            Paragraph("<b>Worked Days:</b>", header_lbl_style),
            Paragraph(f"{payslip.worked_days} of {payslip.scheduled_days} scheduled", header_val_style),
            Paragraph("", header_lbl_style),
            Paragraph("", header_val_style),
        ],
    ]

    t_meta = Table(emp_meta, colWidths=[1.4 * inch, 2.2 * inch, 1.4 * inch, 2.2 * inch])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F9FAFB")),
        ('PADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#F3F4F6")),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 14))

    # Earnings & Deductions lines
    lines_data = [
        [
            Paragraph("<b>Seq</b>", header_lbl_style),
            Paragraph("<b>Salary Component / Rule</b>", header_lbl_style),
            Paragraph("<b>Category</b>", header_lbl_style),
            Paragraph("<b>Amount ($)</b>", header_lbl_style),
        ]
    ]

    for line in payslip.lines:
        amt_str = f"${line.amount:,.2f}"
        if line.category in ["DEDUCTION"]:
            amt_str = f"(${line.amount:,.2f})"

        lines_data.append([
            Paragraph(str(line.sequence), header_lbl_style),
            Paragraph(line.rule_name, header_lbl_style),
            Paragraph(line.category, header_lbl_style),
            Paragraph(f"<b>{amt_str}</b>", header_val_style),
        ])

    t_lines = Table(lines_data, colWidths=[0.6 * inch, 3.6 * inch, 1.6 * inch, 1.4 * inch])
    t_lines.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#EEF2FF")),
        ('PADDING', (0, 0), (-1, -1), 5),
        ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor("#C7D2FE")),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#F3F4F6")),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
    ]))
    story.append(t_lines)
    story.append(Spacer(1, 14))

    # Summary Totals Box
    summary_data = [
        [
            Paragraph("<b>Gross Salary (After LOP):</b>", header_lbl_style),
            Paragraph(f"<b>${payslip.gross_pay:,.2f}</b>", header_val_style),
        ],
        [
            Paragraph("<b>Total Statutory Deductions:</b>", header_lbl_style),
            Paragraph(f"<b>(${payslip.total_deductions:,.2f})</b>", header_val_style),
        ],
        [
            Paragraph("<font size='11'><b>NET TAKE-HOME SALARY PAYABLE:</b></font>", header_lbl_style),
            Paragraph(f"<font size='12' color='#10B981'><b>${payslip.net_pay:,.2f}</b></font>", header_val_style),
        ]
    ]

    t_sum = Table(summary_data, colWidths=[4.2 * inch, 3.0 * inch])
    t_sum.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 1), colors.HexColor("#F9FAFB")),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor("#ECFDF5")),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#10B981")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1FAE5")),
    ]))
    story.append(t_sum)
    story.append(Spacer(1, 20))

    story.append(Paragraph(
        "<i>This is a computer-generated document and requires no physical signature. PeoplePay360 Platform Audit Trail #"+str(payslip.id)+"-CONFIDENTIAL</i>",
        subtitle_style
    ))

    doc.build(story)
    return filepath
