"""Gestión de alertas de precio y notificaciones (por usuario)."""
import time

from .database import get_conn


def create_alert(user_id: int, symbol: str, direction: str, target_price: float, note: str = "") -> dict:
    if direction not in ("above", "below"):
        raise ValueError("La dirección debe ser 'above' o 'below'")
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO alerts (user_id, symbol, direction, target_price, note, active, created_at) "
            "VALUES (?, ?, ?, ?, ?, 1, ?)",
            (user_id, symbol, direction, target_price, note, time.time()),
        )
        return {"id": cur.lastrowid}


def list_alerts(user_id: int) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
        ).fetchall()
        return [dict(r) for r in rows]


def delete_alert(user_id: int, alert_id: int) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM alerts WHERE id = ? AND user_id = ?", (alert_id, user_id))


def check_alerts(prices: dict[str, float]) -> list[dict]:
    """Comprueba las alertas activas de TODOS los usuarios contra los precios.

    Devuelve una lista de {user_id, symbol, message} para las disparadas.
    """
    triggered = []
    now = time.time()
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM alerts WHERE active = 1").fetchall()
        for a in rows:
            price = prices.get(a["symbol"])
            if price is None:
                continue
            hit = (a["direction"] == "above" and price >= a["target_price"]) or (
                a["direction"] == "below" and price <= a["target_price"]
            )
            if hit:
                conn.execute(
                    "UPDATE alerts SET active = 0, triggered_at = ? WHERE id = ?",
                    (now, a["id"]),
                )
                arrow = "subió por encima de" if a["direction"] == "above" else "bajó por debajo de"
                msg = f"{a['symbol']} {arrow} {a['target_price']:,.2f} USDT (precio actual {price:,.2f})."
                conn.execute(
                    "INSERT INTO notifications (user_id, type, title, message, symbol, read, created_at) "
                    "VALUES (?, 'warning', '🔔 Alerta de precio', ?, ?, 0, ?)",
                    (a["user_id"], msg, a["symbol"], now),
                )
                triggered.append({"user_id": a["user_id"], "symbol": a["symbol"], "message": msg})
    return triggered


# ---- Notificaciones ----

def list_notifications(user_id: int, limit: int = 50) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]


def unread_count(user_id: int) -> int:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0", (user_id,)
        ).fetchone()
        return row["c"]


def mark_all_read(user_id: int) -> None:
    with get_conn() as conn:
        conn.execute("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0", (user_id,))


def clear_notifications(user_id: int) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM notifications WHERE user_id = ?", (user_id,))
