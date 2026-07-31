"""Email delivery for account verification and password reset.

No real mail provider is configured yet - until SMTP_HOST (and friends) are
set in .env, this logs the message (including the verification/reset link)
instead of sending it, so the signup/reset flow can be exercised end-to-end
without any external dependency. Set SMTP_HOST/SMTP_PORT/SMTP_USERNAME/
SMTP_PASSWORD/SMTP_FROM to switch to real delivery - no code changes needed
elsewhere, callers only ever see send_email().
"""
import logging
import os
import smtplib
from email.message import EmailMessage

logger = logging.getLogger("EmailService")

# `or None` / `or "..."` throughout, not just a bare os.getenv default: unset
# docker-compose vars come through as an empty string (not absent) when the
# compose file declares `- SMTP_PORT=${SMTP_PORT}` and .env doesn't set one,
# so int(os.getenv("SMTP_PORT", "587")) still crashes on int("").
SMTP_HOST = os.getenv("SMTP_HOST") or None
SMTP_PORT = int(os.getenv("SMTP_PORT") or "587")
SMTP_USERNAME = os.getenv("SMTP_USERNAME") or None
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD") or None
SMTP_FROM = os.getenv("SMTP_FROM") or "no-reply@veritas-nexus.local"


def send_email(to: str, subject: str, body: str) -> None:
    if not SMTP_HOST:
        logger.warning(
            f"SMTP_HOST not set - logging email instead of sending it.\n"
            f"--- EMAIL (would send to {to}) ---\nSubject: {subject}\n\n{body}\n--- END EMAIL ---"
        )
        return

    message = EmailMessage()
    message["From"] = SMTP_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        if SMTP_USERNAME and SMTP_PASSWORD:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(message)


def send_verification_email(to: str, verification_link: str) -> None:
    send_email(
        to=to,
        subject="Verify your Veritas Nexus account",
        body=(
            "Welcome to Veritas Nexus.\n\n"
            f"Verify your email address by visiting:\n{verification_link}\n\n"
            "This link expires in 24 hours."
        ),
    )


def send_password_reset_email(to: str, reset_link: str) -> None:
    send_email(
        to=to,
        subject="Reset your Veritas Nexus password",
        body=(
            "A password reset was requested for this account.\n\n"
            f"Reset your password by visiting:\n{reset_link}\n\n"
            "If you didn't request this, you can safely ignore this email. "
            "This link expires in 1 hour."
        ),
    )
