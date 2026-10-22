"""Retos dentro de un grupo: X días + X movimientos, con ranking por
rentabilidad y la opción de que compita el Agente IA.

Cada participación es un PERFIL de cartera aislado ('challenge:<id>', ver
database/portfolio): al unirse se crea una cartera nueva con el saldo inicial
del reto, sin tocar la cuenta libre ni otros retos. Por eso los movimientos
se cuentan por perfil y un usuario puede estar en varios retos a la vez (cada
uno con su propio cupo), cosa que antes no era posible.
"""
import time

from . import config, database, groups, portfolio, users
from .database import challenge_profile, get_conn

MIN_INITIAL_BALANCE = 100
MAX_INITIAL_BALANCE = 10_000_000


def challenge_id_from_profile(profile: str) -> int | None:
    if not profile or not profile.startswith("challenge:"):
        return None
    try:
        return int(profile.split(":", 1)[1])
    except (ValueError, IndexError):
        return None


def allowed_markets(challenge: dict) -> list[str]:
    """Categorías de mercado permitidas en el reto. '' = todas."""
    raw = (challenge.get("markets") or "").strip()
    if not raw:
        return list(config.CATEGORIES)
    return [c for c in raw.split(",") if c in config.CATEGORIES]


def market_allowed(challenge: dict, symbol: str) -> bool:
    inst = config.instrument(symbol) or {}
    return inst.get("category", "cripto") in allowed_markets(challenge)


def human_participant_count(challenge_id: int) -> int:
    with get_conn() as conn:
        return conn.execute(
            """SELECT COUNT(*) AS c FROM challenge_participants cp
               JOIN users u ON u.id = cp.user_id
               WHERE cp.challenge_id = ? AND u.is_bot = 0""",
            (challenge_id,),
        ).fetchone()["c"]


def create_challenge(
    created_by: int, name: str, days: int, max_trades: int, include_bot: bool,
    initial_balance: float, *, group_id: int | None = None, is_open: bool = False,
    entry_fee: float = 0, prize: float = 0, max_participants: int = 0, markets: list[str] | None = None,
) -> dict:
    name = (name or "").strip()
    if not name or len(name) > 60:
        raise ValueError("El nombre del reto debe tener entre 1 y 60 caracteres")
    if not (1 <= days <= 365):
        raise ValueError("La duración debe ser entre 1 y 365 días")
    if not (1 <= max_trades <= 1000):
        raise ValueError("El número de movimientos debe ser entre 1 y 1000")
    if not (MIN_INITIAL_BALANCE <= initial_balance <= MAX_INITIAL_BALANCE):
        raise ValueError(f"El importe inicial debe estar entre {MIN_INITIAL_BALANCE:,.0f} y {MAX_INITIAL_BALANCE:,.0f} USDT")
    if entry_fee < 0 or prize < 0:
        raise ValueError("La cuota y el premio no pueden ser negativos")
    if max_participants < 0 or max_participants > 10000:
        raise ValueError("El aforo no es válido")

    mk = [c for c in (markets or []) if c in config.CATEGORIES]
    if markets and not mk:
        raise ValueError("Elige al menos un mercado válido")
    markets_str = "" if (not mk or len(mk) == len(config.CATEGORIES)) else ",".join(mk)

    if is_open:
        group_id = None  # un reto abierto no pertenece a ningún grupo
    else:
        if group_id is None or not groups.is_member(group_id, created_by):
            raise ValueError("No perteneces a este grupo")

    now = time.time()
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO challenges
               (group_id, name, days, max_trades, include_bot, initial_balance, is_open, entry_fee, prize,
                max_participants, markets, start_at, end_at, created_by, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (group_id, name, days, max_trades, 1 if include_bot else 0, initial_balance,
             1 if is_open else 0, entry_fee, prize, max_participants, markets_str,
             now, now + days * 86400, created_by, now),
        )
        challenge_id = cur.lastrowid
        row = dict(conn.execute("SELECT * FROM challenges WHERE id = ?", (challenge_id,)).fetchone())

    # El creador se apunta a su propio reto. Cada reto es un perfil aparte con
    # su propio cupo de operaciones (puedes estar en varios a la vez).
    _join_raw(challenge_id, created_by, initial_balance)
    if include_bot:
        bot = users.ensure_bot()
        _join_raw(challenge_id, bot["id"], initial_balance)
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


def is_participant(challenge_id: int, user_id: int) -> bool:
    with get_conn() as conn:
        return conn.execute(
            "SELECT 1 FROM challenge_participants WHERE challenge_id = ? AND user_id = ?",
            (challenge_id, user_id),
        ).fetchone() is not None


def _join_raw(challenge_id: int, user_id: int, initial_balance: float) -> None:
    with get_conn() as conn:
        already = conn.execute(
            "SELECT 1 FROM challenge_participants WHERE challenge_id = ? AND user_id = ?",
            (challenge_id, user_id),
        ).fetchone()
        if already:
            return
        conn.execute(
            "INSERT INTO challenge_participants (challenge_id, user_id, joined_at, start_equity) VALUES (?, ?, ?, ?)",
            (challenge_id, user_id, time.time(), initial_balance),
        )
    # Crea el perfil de cartera del reto con el saldo inicial (no toca la
    # cuenta libre del usuario).
    database.create_profile_account(user_id, challenge_profile(challenge_id), initial_balance)


def join_challenge(challenge_id: int, user_id: int) -> dict:
    challenge = get_challenge(challenge_id)
    if not challenge:
        raise ValueError("El reto no existe")
    if challenge["end_at"] <= time.time():
        raise ValueError("Este reto ya ha terminado")
    if not challenge["is_open"] and not groups.is_member(challenge["group_id"], user_id):
        raise ValueError("No perteneces al grupo de este reto")
    if not is_participant(challenge_id, user_id):
        cap = challenge["max_participants"]
        if cap and human_participant_count(challenge_id) >= cap:
            raise ValueError(f"El reto está completo (aforo de {cap} personas)")
    _join_raw(challenge_id, user_id, challenge["initial_balance"])
    return challenge


def list_open_challenges(limit: int = 50) -> list[dict]:
    """Retos abiertos (cualquiera se une). Los que no han terminado, primero."""
    now = time.time()
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM challenges WHERE is_open = 1 ORDER BY (end_at > ?) DESC, created_at DESC LIMIT ?",
            (now, limit),
        ).fetchall()
        out = []
        for r in rows:
            c = dict(r)
            c["participantCount"] = conn.execute(
                "SELECT COUNT(*) AS n FROM challenge_participants WHERE challenge_id = ?", (c["id"],)
            ).fetchone()["n"]
            c["finished"] = c["end_at"] <= now
            out.append(c)
        return out


def my_active_challenges(user_id: int) -> list[dict]:
    """Retos en los que participa el usuario (para construir sus perfiles)."""
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT c.*, cp.joined_at AS participant_joined_at FROM challenge_participants cp
               JOIN challenges c ON c.id = cp.challenge_id
               WHERE cp.user_id = ? ORDER BY c.end_at DESC""",
            (user_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def trades_used(challenge_id: int, user_id: int) -> int:
    return portfolio.count_trades(user_id, profile=challenge_profile(challenge_id))


def check_trade_allowed(user_id: int, profile: str, symbol: str | None = None) -> None:
    """Valida un intento de operar en el perfil dado. Solo los perfiles de reto
    tienen restricciones (reto terminado, cupo agotado o mercado no permitido)."""
    cid = challenge_id_from_profile(profile)
    if cid is None:
        return
    challenge = get_challenge(cid)
    if not challenge:
        return
    if challenge["end_at"] <= time.time():
        raise ValueError(f"El reto «{challenge['name']}» ya ha terminado")
    if symbol is not None and not market_allowed(challenge, symbol):
        labels = ", ".join(config.CATEGORY_LABELS.get(c, c) for c in allowed_markets(challenge))
        raise ValueError(f"En este reto solo puedes operar: {labels}")
    used = trades_used(cid, user_id)
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
            "initialBalance": challenge["initial_balance"],
            "tradesUsed": trades_used(challenge_id, p["user_id"]),
            "maxTrades": challenge["max_trades"],
            "joinedAt": p["joined_at"],
        })
    return out
