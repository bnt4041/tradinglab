"""Envío de correo (recuperación de contraseña) vía SMTP de IONOS — misma
cuenta (info@flexometro.online) y mismo proveedor que ya usa Flexómetro en
este host.

Best-effort, sin cola: si el SMTP no está configurado o el envío falla, se
informa con una excepción clara y quien llama decide qué hacer. Aquí quien
llama (auth.request_password_reset en main.py) ya deja una marca en BD
(`reset_requested_at`) ANTES de intentar el envío, así que un fallo de SMTP
no deja al usuario sin ninguna vía de recuperación — el admin lo ve igual
en el panel.
"""
import logging
from email.message import EmailMessage

import aiosmtplib

from . import config

logger = logging.getLogger(__name__)


class MailerError(Exception):
    pass


async def send_email(*, to: str, subject: str, html_body: str) -> None:
    if not config.SMTP_HOST or not config.SMTP_FROM:
        raise MailerError("El SMTP no está configurado (variables SMTP_* en .env)")

    message = EmailMessage()
    message["From"] = config.SMTP_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content("Este correo requiere un cliente compatible con HTML.")
    message.add_alternative(html_body, subtype="html")

    # El puerto 465 es TLS implícito desde el primer byte (SMTPS); el 587 (y
    # el resto) es texto plano que se negocia a TLS con STARTTLS a mitad de
    # conversación — mezclar ambos da "Unexpected EOF received".
    tls_implicit = config.SMTP_PORT == 465
    try:
        await aiosmtplib.send(
            message,
            hostname=config.SMTP_HOST,
            port=config.SMTP_PORT,
            username=config.SMTP_USER or None,
            password=config.SMTP_PASSWORD or None,
            start_tls=not tls_implicit,
            use_tls=tls_implicit,
        )
    except Exception as exc:  # aiosmtplib lanza varias excepciones propias de SMTP/red
        logger.warning("No se pudo enviar el correo a %s: %s", to, exc)
        raise MailerError(f"No se pudo enviar el correo: {exc}") from exc


def reset_email_html(name: str, reset_url: str) -> str:
    return f"""
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#1e293b;">TradeLab · Restablecer contraseña</h2>
      <p style="color:#475569;">Hola {name},</p>
      <p style="color:#475569;">
        Has pedido restablecer tu contraseña en TradeLab. Pulsa el botón de abajo para elegir una nueva
        (el enlace caduca en 1 hora):
      </p>
      <p style="text-align:center; margin: 28px 0;">
        <a href="{reset_url}"
           style="background:#4f46e5; color:#fff; padding:12px 24px; border-radius:10px;
                  text-decoration:none; font-weight:600;">
          Elegir nueva contraseña
        </a>
      </p>
      <p style="color:#94a3b8; font-size:12px;">
        Si no has sido tú, ignora este correo — tu contraseña actual sigue siendo válida.
      </p>
    </div>
    """
