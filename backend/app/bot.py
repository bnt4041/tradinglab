"""Agente IA: opera de forma autónoma cada día siguiendo las señales técnicas,
para que el usuario pueda comparar su rendimiento con el del agente.

Estrategia sencilla y transparente (momentum por señal):
- Vende lo que tenga y cuya señal pase a VENTA.
- Compra las señales de COMPRA más fuertes (hasta un máximo de posiciones),
  repartiendo el efectivo a partes iguales.
"""
import time

from . import config, database, ml, portfolio, users

MAX_POSITIONS = 4
CASH_USE = 0.95  # % del efectivo a invertir al repartir

# Universo del agente: criptos principales (24/7, líquidas)
BOT_UNIVERSE = [
    i for i, d in config.INSTRUMENTS.items()
    if d["source"] == "binance" and d["tier"] == "principal"
]


def last_run() -> float:
    try:
        return float(database.get_setting("bot_last_run", "0") or 0)
    except Exception:  # noqa: BLE001
        return 0.0


def _notify(bot_id: int, msg: str) -> None:
    with database.get_conn() as conn:
        conn.execute(
            "INSERT INTO notifications (user_id, type, title, message, symbol, read, created_at) "
            "VALUES (?, 'signal', '🤖 Agente IA', ?, '', 0, ?)",
            (bot_id, msg, time.time()),
        )


async def run_cycle(prices: dict[str, float]) -> dict:
    """Ejecuta una ronda diaria del agente. Devuelve un resumen."""
    bot = users.ensure_bot()
    bot_id = bot["id"]

    # 1) Señales de la IA para el universo
    signals = {}
    for sym in BOT_UNIVERSE:
        price = prices.get(sym)
        if not price:
            continue
        try:
            pred = await ml.predict(sym, "1h")
            signals[sym] = {"signal": pred["signal"], "prob": pred["probabilityUp"], "price": price}
        except Exception:  # noqa: BLE001
            continue

    actions = []

    # 2) Vender posiciones cuya señal sea VENTA
    held = {p["symbol"]: p["quantity"] for p in portfolio.get_positions(bot_id)}
    for sym, qty in list(held.items()):
        sig = signals.get(sym)
        if sig and sig["signal"] == "VENTA":
            try:
                portfolio.sell(bot_id, sym, qty, sig["price"], "VENTA", sig["prob"])
                actions.append(f"vendió {sym}")
                held.pop(sym, None)
            except Exception:  # noqa: BLE001
                pass

    # 3) Comprar las señales de COMPRA más fuertes que no tenga ya
    slots = MAX_POSITIONS - len(held)
    if slots > 0:
        candidates = sorted(
            [(s, d) for s, d in signals.items() if d["signal"] == "COMPRA" and s not in held],
            key=lambda kv: kv[1]["prob"], reverse=True,
        )[:slots]
        if candidates:
            acc = portfolio.get_account(bot_id)
            cash = acc.get("balance", 0) * CASH_USE
            per = cash / len(candidates)
            for sym, d in candidates:
                if per <= 1:
                    break
                try:
                    qty = per / d["price"]
                    portfolio.buy(bot_id, sym, qty, d["price"], "COMPRA", d["prob"])
                    actions.append(f"compró {sym}")
                except Exception:  # noqa: BLE001
                    pass

    database.set_setting("bot_last_run", str(time.time()))
    summary = "No hizo cambios hoy." if not actions else "Operaciones de hoy: " + ", ".join(actions) + "."
    _notify(bot_id, summary)

    # Instantánea de su valor
    try:
        s = portfolio.portfolio_summary(bot_id, prices)
        portfolio.record_snapshot(bot_id, s["equity"], s["balance"], s["positionsValue"])
    except Exception:  # noqa: BLE001
        pass

    return {"actions": actions, "summary": summary}
