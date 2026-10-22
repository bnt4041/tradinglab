"""Gestión de usuarios/perfiles del simulador.

Son perfiles locales sin contraseña (como los perfiles de una app de streaming),
pensados para que varias personas practiquen por separado en la misma instancia.
"""
import time

from .database import USER_COLORS, _ensure_account, get_conn


def list_users() -> list[dict]:
    """Perfiles humanos (excluye el Agente IA)."""
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM users WHERE is_bot = 0 ORDER BY created_at").fetchall()
        return [dict(r) for r in rows]


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


def user_exists(user_id: int) -> bool:
    with get_conn() as conn:
        return (
            conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone()
            is not None
        )


def create_user(name: str) -> dict:
    name = (name or "").strip()
    if not name:
        raise ValueError("El nombre no puede estar vacío")
    if len(name) > 24:
        raise ValueError("El nombre es demasiado largo (máx. 24 caracteres)")

    with get_conn() as conn:
        exists = conn.execute(
            "SELECT 1 FROM users WHERE name = ? COLLATE NOCASE", (name,)
        ).fetchone()
        if exists:
            raise ValueError("Ya existe un perfil con ese nombre")

        count = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        color = USER_COLORS[count % len(USER_COLORS)]
        cur = conn.execute(
            "INSERT INTO users (name, color, created_at) VALUES (?, ?, ?)",
            (name, color, time.time()),
        )
        user_id = cur.lastrowid
        _ensure_account(conn, user_id)
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row)


def delete_user(user_id: int) -> None:
    with get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        if total <= 1:
            raise ValueError("No puedes eliminar el único perfil que existe")
        for tbl in ("account", "positions", "trades", "alerts", "notifications", "cash_movements", "equity_snapshots"):
            conn.execute(f"DELETE FROM {tbl} WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
