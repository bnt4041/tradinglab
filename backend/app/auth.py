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

        # La primera cuenta real que se registra en la instancia es la admin
        # (no hay nadie más a quien pedírselo: bootstrap automático).
        is_first = conn.execute(
            "SELECT 1 FROM users WHERE password_hash IS NOT NULL OR google_sub IS NOT NULL LIMIT 1"
        ).fetchone() is None

        count = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        color = USER_COLORS[count % len(USER_COLORS)]
        cur = conn.execute(
            "INSERT INTO users (name, color, created_at, email, password_hash, is_admin) VALUES (?, ?, ?, ?, ?, ?)",
            (name, color, time.time(), email, _hash_password(password), 1 if is_first else 0),
        )
        user_id = cur.lastrowid
        _ensure_account(conn, user_id)
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row)


def upsert_google_user(email: str, name: str | None, sub: str | None) -> dict:
    """Inicia sesión con Google: si el email ya existe, lo reutiliza (y vincula
    el id de Google); si no, crea una cuenta nueva sin contraseña."""
    email = (email or "").strip().lower()
    if not email:
        raise ValueError("Google no devolvió un email")
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if row:
            if sub and not row["google_sub"]:
                conn.execute("UPDATE users SET google_sub = ? WHERE id = ?", (sub, row["id"]))
            return dict(row)

        is_first = conn.execute(
            "SELECT 1 FROM users WHERE password_hash IS NOT NULL OR google_sub IS NOT NULL LIMIT 1"
        ).fetchone() is None

        base = ((name or email.split("@")[0]).strip() or "Usuario")[:24]
        uname = base
        n = 1
        while conn.execute("SELECT 1 FROM users WHERE name = ? COLLATE NOCASE", (uname,)).fetchone():
            n += 1
            suffix = f" {n}"
            uname = base[: 24 - len(suffix)] + suffix

        count = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        color = USER_COLORS[count % len(USER_COLORS)]
        cur = conn.execute(
            "INSERT INTO users (name, color, created_at, email, google_sub, is_admin) VALUES (?, ?, ?, ?, ?, ?)",
            (uname, color, time.time(), email, sub, 1 if is_first else 0),
        )
        user_id = cur.lastrowid
        _ensure_account(conn, user_id)
        return dict(conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone())


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


def is_admin(user_id: int) -> bool:
    with get_conn() as conn:
        row = conn.execute("SELECT is_admin FROM users WHERE id = ?", (user_id,)).fetchone()
        return bool(row and row["is_admin"])


RESET_TOKEN_HOURS = 1


# ---------------- Restablecer contraseña ----------------
# Dos vías, no una: un enlace de un solo uso por email (self-service, ver
# mailer.py) Y una marca visible para el admin en /api/admin/users (en caso
# de que el envío de correo falle — el SMTP es best-effort, sin cola — el
# admin sigue pudiendo resetear la contraseña a mano).
def request_password_reset(email: str) -> str | None:
    """Si el email existe, marca la solicitud y devuelve un token de un solo
    uso (1h) para quien llame lo mande por correo. Devuelve None si el email
    no existe — deliberadamente no se distingue de "token enviado" de cara al
    usuario (evita enumerar cuentas registradas), eso lo decide la capa de
    encima."""
    email = (email or "").strip().lower()
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, name FROM users WHERE email = ? AND password_hash IS NOT NULL", (email,)
        ).fetchone()
        if not row:
            return None
        now = time.time()
        conn.execute("UPDATE users SET reset_requested_at = ? WHERE id = ?", (now, row["id"]))
        token = secrets.token_urlsafe(32)
        conn.execute(
            "INSERT INTO password_resets (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (token, row["id"], now, now + RESET_TOKEN_HOURS * 3600),
        )
        return token


def reset_password_with_token(token: str, new_password: str) -> None:
    if len(new_password or "") < 6:
        raise ValueError("La contraseña debe tener al menos 6 caracteres")
    with get_conn() as conn:
        row = conn.execute(
            "SELECT user_id, expires_at FROM password_resets WHERE token = ?", (token,)
        ).fetchone()
        if not row or row["expires_at"] < time.time():
            raise ValueError("El enlace no es válido o ha caducado. Pide uno nuevo.")
        user_id = row["user_id"]
        conn.execute(
            "UPDATE users SET password_hash = ?, reset_requested_at = NULL WHERE id = ?",
            (_hash_password(new_password), user_id),
        )
        conn.execute("DELETE FROM password_resets WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))


def admin_reset_password(user_id: int, new_password: str) -> None:
    if len(new_password or "") < 6:
        raise ValueError("La contraseña debe tener al menos 6 caracteres")
    with get_conn() as conn:
        if not conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone():
            raise ValueError("Ese usuario no existe")
        conn.execute(
            "UPDATE users SET password_hash = ?, reset_requested_at = NULL WHERE id = ?",
            (_hash_password(new_password), user_id),
        )
        # Cerrar sus sesiones: una contraseña nueva invalida la antigua.
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))


def set_admin(user_id: int, admin_flag: bool) -> None:
    with get_conn() as conn:
        if not conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone():
            raise ValueError("Ese usuario no existe")
        if not admin_flag:
            admins = conn.execute("SELECT COUNT(*) AS c FROM users WHERE is_admin = 1").fetchone()["c"]
            row = conn.execute("SELECT is_admin FROM users WHERE id = ?", (user_id,)).fetchone()
            if admins <= 1 and row["is_admin"]:
                raise ValueError("No puedes quitarte el único admin que queda")
        conn.execute("UPDATE users SET is_admin = ? WHERE id = ?", (1 if admin_flag else 0, user_id))


def list_accounts() -> list[dict]:
    """Cuentas reales (con contraseña, excluye el Agente IA), para el panel de admin."""
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT u.*, a.balance, a.net_contributions FROM users u
               LEFT JOIN account a ON a.user_id = u.id AND a.profile = 'free'
               WHERE u.password_hash IS NOT NULL OR u.google_sub IS NOT NULL
               ORDER BY u.created_at"""
        ).fetchall()
        out = []
        for r in rows:
            r = dict(r)
            trades = conn.execute(
                "SELECT COUNT(*) AS c, MAX(ts) AS last_ts FROM trades WHERE user_id = ?", (r["id"],)
            ).fetchone()
            last_access = conn.execute(
                "SELECT MAX(ts) AS last FROM access_log WHERE user_id = ?", (r["id"],)
            ).fetchone()["last"]
            ai_calls = conn.execute(
                "SELECT COUNT(*) AS c FROM ai_log WHERE user_id = ?", (r["id"],)
            ).fetchone()["c"]
            out.append({
                "id": r["id"], "name": r["name"], "email": r["email"], "color": r["color"],
                "isAdmin": bool(r["is_admin"]), "createdAt": r["created_at"],
                "hasGoogle": bool(r["google_sub"]),
                "balance": r["balance"], "netContributions": r["net_contributions"],
                "tradeCount": trades["c"], "lastTradeAt": trades["last_ts"],
                "lastAccess": last_access, "aiCalls": ai_calls,
                "resetRequestedAt": r["reset_requested_at"],
            })
        return out
