"""
PeoplePay360 — Dual-Mode Email Engine
Dispatches real SMTP emails when credentials configured, always logging to the In-App Outbox table.
Supports optional binary attachment (e.g. PDF payslip).
"""
from typing import Optional
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from sqlalchemy.orm import Session

from config import get_settings
from models import EmailOutbox, EmailStatus

settings = get_settings()


def dispatch_email(
    recipient_email: str,
    recipient_name: str,
    subject: str,
    body_html: str,
    email_type: str,
    db: Session,
    payslip_id: Optional[int] = None,
    payrun_id: Optional[int] = None,
    attachment_bytes: Optional[bytes] = None,
    attachment_filename: Optional[str] = None,
) -> EmailOutbox:
    """Dispatches email and records entry in emails_outbox table for demo viewing.

    If attachment_bytes is provided (e.g. a PDF payslip), it is attached as
    application/pdf with the given filename.
    """
    outbox_entry = EmailOutbox(
        payslip_id=payslip_id,
        payrun_id=payrun_id,
        recipient_email=recipient_email,
        recipient_name=recipient_name,
        subject=subject,
        body_html=body_html,
        email_type=email_type,
        status=EmailStatus.QUEUED,
    )
    db.add(outbox_entry)
    db.flush()

    # Try SMTP dispatch if configured
    if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
        try:
            msg = MIMEMultipart("mixed")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_FROM or "payroll@peoplepay360.com"
            msg["To"] = recipient_email

            # HTML body
            alt_part = MIMEMultipart("alternative")
            alt_part.attach(MIMEText(body_html, "html"))
            msg.attach(alt_part)

            # PDF attachment
            if attachment_bytes and attachment_filename:
                part = MIMEBase("application", "pdf")
                part.set_payload(attachment_bytes)
                encoders.encode_base64(part)
                part.add_header(
                    "Content-Disposition",
                    "attachment",
                    filename=attachment_filename,
                )
                msg.attach(part)

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=5) as server:
                if getattr(settings, "SMTP_TLS", False):
                    server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(msg["From"], [recipient_email], msg.as_string())

            outbox_entry.status = EmailStatus.SENT
            outbox_entry.sent_at = datetime.utcnow()
        except Exception as e:
            outbox_entry.status = EmailStatus.FAILED
            outbox_entry.error_message = str(e)
    else:
        # Simulated instant delivery for Demo / Offline mode
        outbox_entry.status = EmailStatus.SENT
        outbox_entry.sent_at = datetime.utcnow()

    db.commit()
    db.refresh(outbox_entry)
    return outbox_entry
