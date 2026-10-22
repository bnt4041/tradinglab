"""Lógica de simulación de cartera por usuario: operaciones, posiciones,
P&L y movimientos de efectivo (ingresos/retiros)."""
import time

from . import config
from .database import get_conn


def get_account(user_id: int) -> dict:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM account WHERE user_id = ?", (user_id,)).fetchone()
        return dict(row) if row else {}


def get_positions(user_id: int) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM positions WHERE user_id = ? AND quantity > 0 ORDER BY symbol",
            (user_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def all_held_symbols() -> list[str]:
    """Símbolos con posición de cualquier usuario (para refrescar precios)."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT DISTINCT symbol FROM positions WHERE quantity > 0"
        ).fetchall()
        return [r["symbol"] for r in rows]


def get_trades(user_id: int, limit: int = 100) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM trades WHERE user_id = ? ORDER BY ts DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]


def get_cash_movements(user_id: int, limit: int = 50) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM cash_movements WHERE user_id = ? ORDER BY ts DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]


def record_snapshot(user_id: int, equity: float, balance: float, positions_value: float) -> None:
    """Guarda una instantánea del valor de la cartera y poda el histórico."""
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO equity_snapshots (user_id, ts, equity, balance, positions_value) "
            "VALUES (?, ?, ?, ?, ?)",
            (user_id, time.time(), equity, balance, positions_value),
        )
        # Conservar como mucho las últimas 3000 instantáneas por usuario
        conn.execute(
            "DELETE FROM equity_snapshots WHERE user_id = ? AND id NOT IN "
            "(SELECT id FROM equity_snapshots WHERE user_id = ? ORDER BY ts DESC LIMIT 3000)",
            (user_id, user_id),
        )


def get_history(user_id: int, limit: int = 2000) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT ts, equity, balance, positions_value FROM equity_snapshots "
            "WHERE user_id = ? ORDER BY ts ASC LIMIT ?",
            (user_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]


def stats(user_id: int) -> dict:
    """Estadísticas de operaciones cerradas (P&L realizado)."""
    trades = get_trades(user_id, limit=1000)
    sells = [t for t in trades if t["side"] == "SELL"]
    sells.sort(key=lambda t: t["ts"])

    wins = [t for t in sells if t["pnl"] > 0]
    losses = [t for t in sells if t["pnl"] < 0]
    total_realized = sum(t["pnl"] for t in sells)
    best = max((t["pnl"] for t in sells), default=0)
    worst = min((t["pnl"] for t in sells), default=0)

    cumulative = 0.0
    series = []
    for t in sells:
        cumulative += t["pnl"]
        series.append({"t": t["ts"], "value": cumulative})

    return {
        "closedTrades": len(sells),
        "wins": len(wins),
        "losses": len(losses),
        "winRate": round(len(wins) / len(sells) * 100, 1) if sells else 0,
        "totalRealized": total_realized,
        "bestTrade": best,
        "worstTrade": worst,
        "realizedSeries": series,
    }


def _add_notification(conn, user_id, type_, title, message, symbol=""):
    conn.execute(
        "INSERT INTO notifications (user_id, type, title, message, symbol, read, created_at) "
        "VALUES (?, ?, ?, ?, ?, 0, ?)",
        (user_id, type_, title, message, symbol, time.time()),
    )


def buy(user_id: int, symbol: str, quantity: float, price: float,
        ai_signal: str | None = None, ai_prob: float | None = None) -> dict:
    if quantity <= 0:
        raise ValueError("La cantidad debe ser mayor que cero")
    cost = quantity * price
    fee = cost * config.FEE_RATE
    total = cost + fee

    with get_conn() as conn:
        acc = conn.execute("SELECT balance FROM account WHERE user_id = ?", (user_id,)).fetchone()
        balance = acc["balance"]
        if total > balance + 1e-9:
            raise ValueError(
                f"Saldo insuficiente. Necesitas {total:,.2f} USDT y tienes {balance:,.2f}."
            )

        pos = conn.execute(
            "SELECT quantity, avg_price FROM positions WHERE user_id = ? AND symbol = ?",
            (user_id, symbol),
        ).fetchone()
        if pos:
            new_qty = pos["quantity"] + quantity
            new_avg = (pos["quantity"] * pos["avg_price"] + cost) / new_qty
            conn.execute(
                "UPDATE positions SET quantity = ?, avg_price = ? WHERE user_id = ? AND symbol = ?",
                (new_qty, new_avg, user_id, symbol),
            )
        else:
            conn.execute(
                "INSERT INTO positions (user_id, symbol, quantity, avg_price) VALUES (?, ?, ?, ?)",
                (user_id, symbol, quantity, price),
            )

        conn.execute(
            "UPDATE account SET balance = balance - ? WHERE user_id = ?", (total, user_id)
        )
        conn.execute(
            "INSERT INTO trades (user_id, symbol, side, quantity, price, fee, total, pnl, ts, ai_signal, ai_prob) "
            "VALUES (?, ?, 'BUY', ?, ?, ?, ?, 0, ?, ?, ?)",
            (user_id, symbol, quantity, price, fee, total, time.time(), ai_signal, ai_prob),
        )
        _add_notification(
            conn, user_id, "success", "Compra ejecutada",
            f"Compraste {quantity:g} {symbol} a {price:,.2f} USDT (comisión {fee:,.2f}).",
            symbol,
        )
    return {"ok": True, "symbol": symbol, "quantity": quantity, "price": price, "fee": fee}


def sell(user_id: int, symbol: str, quantity: float, price: float,
         ai_signal: str | None = None, ai_prob: float | None = None) -> dict:
    if quantity <= 0:
        raise ValueError("La cantidad debe ser mayor que cero")

    with get_conn() as conn:
        pos = conn.execute(
            "SELECT quantity, avg_price FROM positions WHERE user_id = ? AND symbol = ?",
            (user_id, symbol),
        ).fetchone()
        held = pos["quantity"] if pos else 0
        # Tolerancia por redondeo (p. ej. el botón MÁX): si la diferencia es
        # ínfima respecto a lo que tienes, se vende la posición completa.
        if pos and quantity > held and quantity - held <= held * 1e-4:
            quantity = held
        if not pos or held < quantity - 1e-9:
            raise ValueError(
                f"No tienes suficiente {symbol}. Tienes {held:g} y quieres vender {quantity:g}."
            )

        proceeds = quantity * price
        fee = proceeds * config.FEE_RATE
        net = proceeds - fee
        pnl = (price - pos["avg_price"]) * quantity - fee

        new_qty = pos["quantity"] - quantity
        if new_qty <= 1e-9:
            conn.execute("DELETE FROM positions WHERE user_id = ? AND symbol = ?", (user_id, symbol))
        else:
            conn.execute(
                "UPDATE positions SET quantity = ? WHERE user_id = ? AND symbol = ?",
                (new_qty, user_id, symbol),
            )

        conn.execute("UPDATE account SET balance = balance + ? WHERE user_id = ?", (net, user_id))
        conn.execute(
            "INSERT INTO trades (user_id, symbol, side, quantity, price, fee, total, pnl, ts, ai_signal, ai_prob) "
            "VALUES (?, ?, 'SELL', ?, ?, ?, ?, ?, ?, ?, ?)",
            (user_id, symbol, quantity, price, fee, net, pnl, time.time(), ai_signal, ai_prob),
        )
        result_word = "ganancia" if pnl >= 0 else "pérdida"
        _add_notification(
            conn, user_id, "success" if pnl >= 0 else "warning", "Venta ejecutada",
            f"Vendiste {quantity:g} {symbol} a {price:,.2f} USDT con {result_word} de {pnl:,.2f} USDT.",
            symbol,
        )
    return {"ok": True, "symbol": symbol, "quantity": quantity, "price": price, "pnl": pnl}


def deposit(user_id: int, amount: float) -> dict:
    if amount is None or amount <= 0:
        raise ValueError("El importe a ingresar debe ser mayor que cero")
    with get_conn() as conn:
        conn.execute(
            "UPDATE account SET balance = balance + ?, net_contributions = net_contributions + ? "
            "WHERE user_id = ?",
            (amount, amount, user_id),
        )
        conn.execute(
            "INSERT INTO cash_movements (user_id, type, amount, ts) VALUES (?, 'deposit', ?, ?)",
            (user_id, amount, time.time()),
        )
        _add_notification(
            conn, user_id, "success", "Ingreso realizado",
            f"Ingresaste {amount:,.2f} USDT en tu cuenta demo.",
        )
    return {"ok": True}


def withdraw(user_id: int, amount: float) -> dict:
    if amount is None or amount <= 0:
        raise ValueError("El importe a retirar debe ser mayor que cero")
    with get_conn() as conn:
        acc = conn.execute("SELECT balance FROM account WHERE user_id = ?", (user_id,)).fetchone()
        if amount > acc["balance"] + 1e-9:
            raise ValueError(
                f"No puedes retirar {amount:,.2f} USDT: solo tienes {acc['balance']:,.2f} en efectivo. "
                "Vende posiciones primero si quieres liberar más saldo."
            )
        conn.execute(
            "UPDATE account SET balance = balance - ?, net_contributions = net_contributions - ? "
            "WHERE user_id = ?",
            (amount, amount, user_id),
        )
        conn.execute(
            "INSERT INTO cash_movements (user_id, type, amount, ts) VALUES (?, 'withdraw', ?, ?)",
            (user_id, amount, time.time()),
        )
        _add_notification(
            conn, user_id, "info", "Retiro realizado",
            f"Retiraste {amount:,.2f} USDT de tu cuenta demo.",
        )
    return {"ok": True}


def portfolio_summary(user_id: int, prices: dict[str, float]) -> dict:
    acc = get_account(user_id)
    positions = get_positions(user_id)
    holdings = []
    positions_value = 0.0
    for p in positions:
        current = prices.get(p["symbol"], p["avg_price"])
        value = p["quantity"] * current
        cost = p["quantity"] * p["avg_price"]
        pnl = value - cost
        pnl_pct = (pnl / cost * 100) if cost else 0
        positions_value += value
        holdings.append(
            {
                "symbol": p["symbol"],
                "quantity": p["quantity"],
                "avgPrice": p["avg_price"],
                "currentPrice": current,
                "value": value,
                "pnl": pnl,
                "pnlPercent": pnl_pct,
            }
        )

    net = acc.get("net_contributions", config.INITIAL_BALANCE)
    equity = acc.get("balance", 0) + positions_value
    total_pnl = equity - net
    total_pnl_pct = (total_pnl / net * 100) if net else 0

    return {
        "balance": acc.get("balance", 0),
        "netContributions": net,
        "positionsValue": positions_value,
        "equity": equity,
        "totalPnl": total_pnl,
        "totalPnlPercent": total_pnl_pct,
        "holdings": holdings,
    }
