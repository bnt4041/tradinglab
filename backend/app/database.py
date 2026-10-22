"""Capa de base de datos SQLite (multiusuario).

Guarda usuarios/perfiles y, por cada uno, su cuenta demo, posiciones,
operaciones, alertas, notificaciones y movimientos de efectivo.
Incluye migración automática desde el esquema antiguo de un solo usuario.
"""
import os
import sqlite3
import threading
import time
from contextlib import contextmanager

from . import config

_lock = threading.Lock()

# Perfil de la cuenta libre de práctica. Los retos usan 'challenge:<id>'.
FREE_PROFILE = "free"


def challenge_profile(challenge_id: int) -> str:
    return f"challenge:{challenge_id}"


USER_COLORS = [
    "#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4",
    "#a855f7", "#ef4444", "#14b8a6", "#f97316", "#3b82f6",
]


def _connect() -> sqlite3.Connection:
    os.makedirs(config.DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


@contextmanager
def get_conn():
    with _lock:
        conn = _connect()
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()


def _table_exists(conn, name: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone()
    return row is not None


def _columns(conn, table: str) -> set[str]:
    return {r["name"] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}


SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT NOT NULL,
    created_at REAL NOT NULL,
    is_bot INTEGER NOT NULL DEFAULT 0,
    email TEXT UNIQUE,
    password_hash TEXT,
    is_admin INTEGER NOT NULL DEFAULT 0,
    reset_requested_at REAL
);

CREATE TABLE IF NOT EXISTS password_resets (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at REAL NOT NULL,
    expires_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at REAL NOT NULL,
    expires_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    owner_id INTEGER NOT NULL,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at REAL NOT NULL,
    PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER,                      -- NULL en los retos abiertos (sin grupo)
    name TEXT NOT NULL,
    days INTEGER NOT NULL,
    max_trades INTEGER NOT NULL,
    include_bot INTEGER NOT NULL DEFAULT 0,
    initial_balance REAL NOT NULL DEFAULT 10000,
    is_open INTEGER NOT NULL DEFAULT 0,        -- 1 = cualquiera puede unirse
    entry_fee REAL NOT NULL DEFAULT 0,         -- cuota ficticia (informativa)
    prize REAL NOT NULL DEFAULT 0,             -- premio ficticio (informativo)
    max_participants INTEGER NOT NULL DEFAULT 0, -- 0 = sin límite (cuenta personas, no el bot)
    markets TEXT NOT NULL DEFAULT '',          -- categorías permitidas, coma-separadas; '' = todas
    start_at REAL NOT NULL,
    end_at REAL NOT NULL,
    created_by INTEGER NOT NULL,
    created_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_challenges_group ON challenges(group_id);

CREATE TABLE IF NOT EXISTS challenge_participants (
    challenge_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at REAL NOT NULL,
    start_equity REAL NOT NULL,
    PRIMARY KEY (challenge_id, user_id)
);

-- Cada cuenta de usuario tiene varios PERFILES de cartera: 'free' (la cuenta
-- libre de práctica) y 'challenge:<id>' (una cartera aislada por cada reto en
-- el que participa). Posiciones, operaciones y saldo son independientes por
-- perfil, así que entrar en un reto no toca tu cuenta libre.
CREATE TABLE IF NOT EXISTS account (
    user_id INTEGER NOT NULL,
    profile TEXT NOT NULL DEFAULT 'free',
    balance REAL NOT NULL,
    net_contributions REAL NOT NULL,
    created_at REAL NOT NULL,
    PRIMARY KEY (user_id, profile)
);

CREATE TABLE IF NOT EXISTS positions (
    user_id INTEGER NOT NULL,
    profile TEXT NOT NULL DEFAULT 'free',
    symbol TEXT NOT NULL,
    quantity REAL NOT NULL,
    avg_price REAL NOT NULL,
    PRIMARY KEY (user_id, profile, symbol)
);

CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    profile TEXT NOT NULL DEFAULT 'free',
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    fee REAL NOT NULL,
    total REAL NOT NULL,
    pnl REAL NOT NULL DEFAULT 0,
    ts REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    direction TEXT NOT NULL,
    target_price REAL NOT NULL,
    note TEXT DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at REAL NOT NULL,
    triggered_at REAL
);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    symbol TEXT DEFAULT '',
    read INTEGER NOT NULL DEFAULT 0,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS cash_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    profile TEXT NOT NULL DEFAULT 'free',
    type TEXT NOT NULL,            -- deposit | withdraw
    amount REAL NOT NULL,
    ts REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS equity_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    profile TEXT NOT NULL DEFAULT 'free',
    ts REAL NOT NULL,
    equity REAL NOT NULL,
    balance REAL NOT NULL,
    positions_value REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    provider TEXT NOT NULL,
    model TEXT,
    kind TEXT NOT NULL,            -- chat | coach | test | basket
    ok INTEGER NOT NULL,
    latency_ms INTEGER,
    error TEXT
);
"""


def _migrate_v1_to_v2(conn) -> None:
    """Migra el esquema antiguo (un único usuario) al multiusuario (user 1)."""
    now = time.time()

    # Asegurar usuario por defecto
    conn.execute(
        "INSERT OR IGNORE INTO users (id, name, color, created_at) VALUES (1, 'Invitado', ?, ?)",
        (USER_COLORS[0], now),
    )

    # --- account: renombrar columnas (id->user_id, initial_balance->net_contributions)
    if _table_exists(conn, "account") and "user_id" not in _columns(conn, "account"):
        old = conn.execute("SELECT * FROM account WHERE id = 1").fetchone()
        conn.execute("ALTER TABLE account RENAME TO account_old")
        conn.execute(
            """CREATE TABLE account (
                user_id INTEGER PRIMARY KEY,
                balance REAL NOT NULL,
                net_contributions REAL NOT NULL,
                created_at REAL NOT NULL
            )"""
        )
        if old:
            keys = old.keys()
            net = old["initial_balance"] if "initial_balance" in keys else old["balance"]
            conn.execute(
                "INSERT INTO account (user_id, balance, net_contributions, created_at) VALUES (1, ?, ?, ?)",
                (old["balance"], net, old["created_at"] if "created_at" in keys else now),
            )
        conn.execute("DROP TABLE account_old")

    # --- positions: añadir user_id y PK compuesta
    if _table_exists(conn, "positions") and "user_id" not in _columns(conn, "positions"):
        conn.execute("ALTER TABLE positions RENAME TO positions_old")
        conn.execute(
            """CREATE TABLE positions (
                user_id INTEGER NOT NULL,
                symbol TEXT NOT NULL,
                quantity REAL NOT NULL,
                avg_price REAL NOT NULL,
                PRIMARY KEY (user_id, symbol)
            )"""
        )
        conn.execute(
            "INSERT INTO positions (user_id, symbol, quantity, avg_price) "
            "SELECT 1, symbol, quantity, avg_price FROM positions_old"
        )
        conn.execute("DROP TABLE positions_old")

    # --- trades / alerts / notifications: basta con añadir columna user_id
    for tbl in ("trades", "alerts", "notifications"):
        if _table_exists(conn, tbl) and "user_id" not in _columns(conn, tbl):
            conn.execute(f"ALTER TABLE {tbl} ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1")


def _migrate_add_profiles(conn) -> None:
    """Añade la columna `profile` a las tablas de cartera (perfiles por reto).

    `account` y `positions` se reconstruyen porque su clave primaria tiene que
    incluir el perfil (SQLite no permite cambiar la PK con ALTER); el resto
    basta con ADD COLUMN. Todo lo existente queda bajo el perfil 'free'.
    """
    if _table_exists(conn, "account") and "profile" not in _columns(conn, "account"):
        conn.execute("ALTER TABLE account RENAME TO account_old")
        conn.execute(
            """CREATE TABLE account (
                user_id INTEGER NOT NULL,
                profile TEXT NOT NULL DEFAULT 'free',
                balance REAL NOT NULL,
                net_contributions REAL NOT NULL,
                created_at REAL NOT NULL,
                PRIMARY KEY (user_id, profile)
            )"""
        )
        conn.execute(
            "INSERT INTO account (user_id, profile, balance, net_contributions, created_at) "
            "SELECT user_id, 'free', balance, net_contributions, created_at FROM account_old"
        )
        conn.execute("DROP TABLE account_old")

    if _table_exists(conn, "positions") and "profile" not in _columns(conn, "positions"):
        conn.execute("ALTER TABLE positions RENAME TO positions_old")
        conn.execute(
            """CREATE TABLE positions (
                user_id INTEGER NOT NULL,
                profile TEXT NOT NULL DEFAULT 'free',
                symbol TEXT NOT NULL,
                quantity REAL NOT NULL,
                avg_price REAL NOT NULL,
                PRIMARY KEY (user_id, profile, symbol)
            )"""
        )
        conn.execute(
            "INSERT INTO positions (user_id, profile, symbol, quantity, avg_price) "
            "SELECT user_id, 'free', symbol, quantity, avg_price FROM positions_old"
        )
        conn.execute("DROP TABLE positions_old")

    for tbl in ("trades", "cash_movements", "equity_snapshots"):
        if _table_exists(conn, tbl) and "profile" not in _columns(conn, tbl):
            conn.execute(f"ALTER TABLE {tbl} ADD COLUMN profile TEXT NOT NULL DEFAULT 'free'")

    # Índices que referencian `profile` — se crean aquí (no en SCHEMA) porque la
    # columna puede acabar de añadirse justo arriba en una base de datos ya existente.
    conn.execute("CREATE INDEX IF NOT EXISTS idx_trades_user_profile ON trades(user_id, profile, ts)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_snap_user_ts ON equity_snapshots(user_id, profile, ts)")


def _migrate_challenge_props(conn) -> None:
    """Añade a los retos: tipo abierto/grupo, cuota, premio, aforo y mercados.

    Se reconstruye la tabla porque `group_id` pasa de NOT NULL a admitir NULL
    (retos abiertos sin grupo), y eso ALTER no lo permite."""
    if not _table_exists(conn, "challenges") or "is_open" in _columns(conn, "challenges"):
        return
    conn.execute("ALTER TABLE challenges RENAME TO challenges_old")
    conn.execute(
        """CREATE TABLE challenges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER,
            name TEXT NOT NULL,
            days INTEGER NOT NULL,
            max_trades INTEGER NOT NULL,
            include_bot INTEGER NOT NULL DEFAULT 0,
            initial_balance REAL NOT NULL DEFAULT 10000,
            is_open INTEGER NOT NULL DEFAULT 0,
            entry_fee REAL NOT NULL DEFAULT 0,
            prize REAL NOT NULL DEFAULT 0,
            max_participants INTEGER NOT NULL DEFAULT 0,
            markets TEXT NOT NULL DEFAULT '',
            start_at REAL NOT NULL,
            end_at REAL NOT NULL,
            created_by INTEGER NOT NULL,
            created_at REAL NOT NULL
        )"""
    )
    conn.execute(
        "INSERT INTO challenges (id, group_id, name, days, max_trades, include_bot, initial_balance, "
        "start_at, end_at, created_by, created_at) "
        "SELECT id, group_id, name, days, max_trades, include_bot, initial_balance, "
        "start_at, end_at, created_by, created_at FROM challenges_old"
    )
    conn.execute("DROP TABLE challenges_old")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_challenges_group ON challenges(group_id)")


def init_db() -> None:
    with get_conn() as conn:
        needs_migration = _table_exists(conn, "account") and "user_id" not in _columns(
            conn, "account"
        )

        # Crear tablas que falten (no toca las existentes)
        conn.executescript(SCHEMA)

        if needs_migration:
            _migrate_v1_to_v2(conn)

        _migrate_add_profiles(conn)
        _migrate_challenge_props(conn)

        # Columnas para registrar la señal de la IA en el momento de operar
        trade_cols = _columns(conn, "trades")
        if "ai_signal" not in trade_cols:
            conn.execute("ALTER TABLE trades ADD COLUMN ai_signal TEXT")
        if "ai_prob" not in trade_cols:
            conn.execute("ALTER TABLE trades ADD COLUMN ai_prob REAL")
        if "is_bot" not in _columns(conn, "users"):
            conn.execute("ALTER TABLE users ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0")
        user_cols = _columns(conn, "users")
        if "email" not in user_cols:
            conn.execute("ALTER TABLE users ADD COLUMN email TEXT")
        if "password_hash" not in user_cols:
            conn.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
        if "is_admin" not in user_cols:
            conn.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
        if "reset_requested_at" not in user_cols:
            conn.execute("ALTER TABLE users ADD COLUMN reset_requested_at REAL")
        if _table_exists(conn, "challenges") and "initial_balance" not in _columns(conn, "challenges"):
            conn.execute("ALTER TABLE challenges ADD COLUMN initial_balance REAL NOT NULL DEFAULT 10000")

        # Usuario por defecto si no hay ninguno
        count = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        if count == 0:
            conn.execute(
                "INSERT INTO users (id, name, color, created_at) VALUES (1, 'Invitado', ?, ?)",
                (USER_COLORS[0], time.time()),
            )

        # Asegurar cuenta para cada usuario
        for u in conn.execute("SELECT id FROM users").fetchall():
            _ensure_account(conn, u["id"])

        conn.execute(
            "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '2')"
        )


def get_setting(key: str, default: str = "") -> str:
    with get_conn() as conn:
        row = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
        return row["value"] if row and row["value"] is not None else default


def set_setting(key: str, value: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO meta (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )


def log_ai(provider: str, model: str, kind: str, ok: bool, latency_ms: int, error: str | None) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO ai_log (ts, provider, model, kind, ok, latency_ms, error) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (time.time(), provider, model, kind, 1 if ok else 0, latency_ms, (error or "")[:300]),
        )
        conn.execute(
            "DELETE FROM ai_log WHERE id NOT IN (SELECT id FROM ai_log ORDER BY ts DESC LIMIT 200)"
        )


def get_ai_log(limit: int = 50) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM ai_log ORDER BY ts DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


def _ensure_account(conn, user_id: int, profile: str = FREE_PROFILE, balance: float | None = None) -> None:
    amount = config.INITIAL_BALANCE if balance is None else balance
    row = conn.execute(
        "SELECT 1 FROM account WHERE user_id = ? AND profile = ?", (user_id, profile)
    ).fetchone()
    if row is None:
        now = time.time()
        conn.execute(
            "INSERT INTO account (user_id, profile, balance, net_contributions, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, profile, amount, amount, now),
        )
        if profile == FREE_PROFILE:
            conn.execute(
                "INSERT INTO notifications (user_id, type, title, message, symbol, read, created_at) "
                "VALUES (?, 'info', '¡Bienvenido!', ?, '', 0, ?)",
                (user_id, f"Tu cuenta demo empieza con {amount:,.0f} USDT ficticios. ¡A practicar!", now),
            )


def create_profile_account(user_id: int, profile: str, balance: float) -> None:
    """Crea (o reinicia) el perfil de cartera de un reto con el saldo inicial.

    Al unirse a un reto se parte de cero en ese perfil, sin tocar la cuenta
    libre ni ningún otro reto."""
    with get_conn() as conn:
        now = time.time()
        conn.execute("DELETE FROM positions WHERE user_id = ? AND profile = ?", (user_id, profile))
        conn.execute("DELETE FROM trades WHERE user_id = ? AND profile = ?", (user_id, profile))
        conn.execute("DELETE FROM cash_movements WHERE user_id = ? AND profile = ?", (user_id, profile))
        conn.execute("DELETE FROM equity_snapshots WHERE user_id = ? AND profile = ?", (user_id, profile))
        conn.execute(
            "INSERT INTO account (user_id, profile, balance, net_contributions, created_at) VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT(user_id, profile) DO UPDATE SET balance = excluded.balance, "
            "net_contributions = excluded.net_contributions, created_at = excluded.created_at",
            (user_id, profile, balance, balance, now),
        )


def list_account_keys() -> list[tuple[int, str]]:
    """Todas las parejas (user_id, perfil) con cartera — para el snapshot periódico."""
    with get_conn() as conn:
        rows = conn.execute("SELECT user_id, profile FROM account").fetchall()
        return [(r["user_id"], r["profile"]) for r in rows]


def reset_account(user_id: int, profile: str = FREE_PROFILE, balance: float | None = None, reason: str | None = None) -> None:
    amount = config.INITIAL_BALANCE if balance is None else balance
    with get_conn() as conn:
        now = time.time()
        conn.execute("DELETE FROM positions WHERE user_id = ? AND profile = ?", (user_id, profile))
        conn.execute("DELETE FROM trades WHERE user_id = ? AND profile = ?", (user_id, profile))
        conn.execute("DELETE FROM cash_movements WHERE user_id = ? AND profile = ?", (user_id, profile))
        conn.execute("DELETE FROM equity_snapshots WHERE user_id = ? AND profile = ?", (user_id, profile))
        conn.execute(
            "UPDATE account SET balance = ?, net_contributions = ?, created_at = ? WHERE user_id = ? AND profile = ?",
            (amount, amount, now, user_id, profile),
        )
        message = reason or f"Tu cuenta demo se ha reiniciado a {amount:,.0f} USDT."
        conn.execute(
            "INSERT INTO notifications (user_id, type, title, message, symbol, read, created_at) "
            "VALUES (?, 'info', 'Cuenta reiniciada', ?, '', 0, ?)",
            (user_id, message, now),
        )
