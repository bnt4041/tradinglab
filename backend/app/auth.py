"""Autenticación por cuenta real (email + contraseña) con sesión por cookie.

Sustituye el antiguo "perfil sin contraseña" (ver users.py): ahora cada
usuario es una cuenta identificable de verdad, necesaria para que grupos,
retos y el ranking tengan sentido (no se puede competir contra alguien que
cualquiera puede suplantar cambiando un header).

Hash de contraseña con PBKDF2-HMAC-SHA256 (librería estándar, sin añadir
dependencias) en vez de bcrypt/passlib.
"""
import hashlib
import hmac
import os
import secrets
import time

from . import database
from .database import USER_COLORS, _ensure_account, get_conn

SESSION_DAYS = 30
PBKDF2_ITERATIONS = 260_000


def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"{salt.hex()}:{dk.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, hash_hex = stored.split(":", 1)
    except (ValueError, AttributeError):
        return False
    salt = bytes.fromhex(salt_hex)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return hmac.compare_digest(dk.hex(), hash_hex)


def _public(row: dict) -> dict:
    return {"id": row["id"], "name": row["name"], "color": row["color"]}


def register(name: str, email: str, password: str) -> dict:
    name = (name or "").strip()
    email = (email or "").strip().lower()
    if not name or len(name) > 24:
        raise ValueError("El nombre debe tener entre 1 y 24 caracteres")
    if "@" not in email or len(email) > 120:
        raise ValueError("Introduce un email válido")
    if len(password or "") < 6:
        raise ValueError("La contraseña debe tener al menos 6 caracteres")

    with get_conn() as conn:
        if conn.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
            raise ValueError("Ya existe una cuenta con ese email")
        if conn.execute("SELECT 1 FROM users WHERE name = ? COLLATE NOCASE", (name,)).fetchone():
            raise ValueError("Ese nombre ya está en uso")

        count = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        color = USER_COLORS[count % len(USER_COLORS)]
        cur = conn.execute(
            "INSERT INTO users (name, color, created_at, email, password_hash) VALUES (?, ?, ?, ?, ?)",
            (name, color, time.time(), email, _hash_password(password)),
        )
        user_id = cur.lastrowid
        _ensure_account(conn, user_id)
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row)


def login(email: str, password: str) -> dict:
    email = (email or "").strip().lower()
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not row or not row["password_hash"] or not _verify_password(password, row["password_hash"]):
        raise ValueError("Email o contraseña incorrectos")
    return dict(row)


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    now = time.time()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (token, user_id, now, now + SESSION_DAYS * 86400),
        )
    return token


def delete_session(token: str) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def get_user_id_from_token(token: str | None) -> int | None:
    if not token:
        return None
    with get_conn() as conn:
        row = conn.execute(
            "SELECT user_id, expires_at FROM sessions WHERE token = ?", (token,)
        ).fetchone()
        if not row or row["expires_at"] < time.time():
            return None
        return row["user_id"]


def cleanup_expired_sessions() -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM sessions WHERE expires_at < ?", (time.time(),))
