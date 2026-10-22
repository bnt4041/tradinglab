"""Retos dentro de un grupo: X días + X movimientos (operaciones), con
ranking por rentabilidad y la opción de que compita el Agente IA.

Simplificación deliberada: un usuario solo puede tener UN reto activo a la
vez (no puede unirse a otro mientras el actual siga en curso). Así "X
movimientos" es inequívoco: cuenta las operaciones (trades) que hace desde
que se unió, sin tener que repartir cada trade entre varios retos
simultáneos con límites distintos.
"""
import time

from . import groups, users
from .database import get_conn


def create_challenge(
    group_id: int, created_by: int, name: str, days: int, max_trades: int, include_bot: bool,
    creator_equity: float, bot_equity: float = 0.0,
) -> dict:
    name = (name or "").strip()
    if not name or len(name) > 60:
        raise ValueError("El nombre del reto debe tener entre 1 y 60 caracteres")
    if not (1 <= days <= 365):
        raise ValueError("La duración debe ser entre 1 y 365 días")
    if not (1 <= max_trades <= 1000):
        raise ValueError("El número de movimientos debe ser entre 1 y 1000")
    if not groups.is_member(group_id, created_by):
        raise ValueError("No perteneces a este grupo")

    now = time.time()
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO challenges (group_id, name, days, max_trades, include_bot, start_at, end_at, created_by, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (group_id, name, days, max_trades, 1 if include_bot else 0, now, now + days * 86400, created_by, now),
        )
        challenge_id = cur.lastrowid
        row = dict(conn.execute("SELECT * FROM challenges WHERE id = ?", (challenge_id,)).fetchone())

    # El creador se une automáticamente a su propio reto, pero solo si no
    # está ya metido en otro reto activo (si lo está, el reto se crea para
    # el grupo igualmente; el creador podrá unirse cuando acabe el suyo).
    if active_participation(created_by) is None:
        _join_raw(challenge_id, created_by, creator_equity)
    if include_bot:
        # El Agente IA no cuenta sus trades contra ningún cupo (los hace su
        # propio ciclo autónomo, ajeno a los retos), así que puede competir
        # en varios retos a la vez sin la restricción de "uno activo".
        bot = users.ensure_bot()
        _join_raw(challenge_id, bot["id"], bot_equity)
    return row


def get_challenge(challenge_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM challenges WHERE id = ?", (challenge_id,)).fetchone()
        return dict(row) if row else None


def list_group_challenges(group_id: int) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM challenges WHERE group_id = ? ORDER BY created_at DESC", (group_id,)
        ).fetchall()
        return [dict(r) for r in rows]


def _join_raw(challenge_id: int, user_id: int, start_equity: float) -> None:
    with get_conn() as conn:
        already = conn.execute(
            "SELECT 1 FROM challenge_participants WHERE challenge_id = ? AND user_id = ?",
            (challenge_id, user_id),
        ).fetchone()
        if already:
            return
        conn.execute(
            "INSERT INTO challenge_participants (challenge_id, user_id, joined_at, start_equity) VALUES (?, ?, ?, ?)",
            (challenge_id, user_id, time.time(), start_equity),
        )


def active_participation(user_id: int) -> dict | None:
    """El reto activo (no terminado) en el que ya está metido este usuario, si hay alguno."""
    now = time.time()
    with get_conn() as conn:
        row = conn.execute(
            """SELECT c.*, cp.joined_at AS participant_joined_at FROM challenge_participants cp
               JOIN challenges c ON c.id = cp.challenge_id
               WHERE cp.user_id = ? AND c.end_at > ?
               ORDER BY cp.joined_at DESC LIMIT 1""",
            (user_id, now),
        ).fetchone()
        return dict(row) if row else None


def join_challenge(challenge_id: int, user_id: int, current_equity: float) -> dict:
    challenge = get_challenge(challenge_id)
    if not challenge:
        raise ValueError("El reto no existe")
    if challenge["end_at"] <= time.time():
        raise ValueError("Este reto ya ha terminado")
    if not groups.is_member(challenge["group_id"], user_id):
        raise ValueError("No perteneces al grupo de este reto")

    existing = active_participation(user_id)
    if existing and existing["id"] != challenge_id:
        raise ValueError(
            f"Ya estás participando en el reto «{existing['name']}». Termina ese reto antes de unirte a otro."
        )
    _join_raw(challenge_id, user_id, current_equity)
    return challenge


def trades_used(challenge_id: int, user_id: int) -> int:
    with get_conn() as conn:
        part = conn.execute(
            "SELECT joined_at FROM challenge_participants WHERE challenge_id = ? AND user_id = ?",
            (challenge_id, user_id),
        ).fetchone()
        if not part:
            return 0
        return conn.execute(
            "SELECT COUNT(*) AS c FROM trades WHERE user_id = ? AND ts >= ?",
            (user_id, part["joined_at"]),
        ).fetchone()["c"]


def check_trade_allowed(user_id: int) -> None:
    """Lanza ValueError si el usuario ha agotado los movimientos de su reto activo."""
    challenge = active_participation(user_id)
    if not challenge:
        return
    used = trades_used(challenge["id"], user_id)
    if used >= challenge["max_trades"]:
        raise ValueError(
            f"Has agotado tus {challenge['max_trades']} movimientos en el reto «{challenge['name']}»"
        )


def participants(challenge_id: int) -> list[dict]:
    """Participantes crudos (sin equity en vivo: main.py la calcula con precios reales)."""
    challenge = get_challenge(challenge_id)
    if not challenge:
        raise ValueError("El reto no existe")
    with get_conn() as conn:
        parts = conn.execute(
            "SELECT * FROM challenge_participants WHERE challenge_id = ?", (challenge_id,)
        ).fetchall()

    out = []
    for p in parts:
        p = dict(p)
        u = users.get_user(p["user_id"]) or {}
        out.append({
            "userId": p["user_id"],
            "name": u.get("name", "?"),
            "color": u.get("color", "#6366f1"),
            "isBot": bool(u.get("is_bot")),
            "startEquity": p["start_equity"] or 0,
            "tradesUsed": trades_used(challenge_id, p["user_id"]),
            "maxTrades": challenge["max_trades"],
            "joinedAt": p["joined_at"],
        })
    return out
