"""Gestión de usuarios (cuentas reales, ver auth.py) y del Agente IA.
"""
import time

from .database import _ensure_account, get_conn


def list_all_users() -> list[dict]:
    """Todos los perfiles, incluido el Agente IA (uso interno)."""
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM users ORDER BY created_at").fetchall()
        return [dict(r) for r in rows]


def get_bot() -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE is_bot = 1 LIMIT 1").fetchone()
        return dict(row) if row else None


def ensure_bot() -> dict:
    """Crea el perfil del Agente IA si no existe."""
    existing = get_bot()
    if existing:
        return existing
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO users (name, color, created_at, is_bot) VALUES (?, ?, ?, 1)",
            ("Agente IA", "#8b5cf6", time.time()),
        )
        bot_id = cur.lastrowid
        _ensure_account(conn, bot_id)
        return dict(conn.execute("SELECT * FROM users WHERE id = ?", (bot_id,)).fetchone())


def get_user(user_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None


