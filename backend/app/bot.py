"""Agente IA: opera de forma autónoma cada día siguiendo las señales técnicas,
para que el usuario pueda comparar su rendimiento con el del agente.

Estrategia sencilla y transparente (momentum por señal):
- Vende lo que tenga y cuya señal pase a VENTA.
- Compra las señales de COMPRA más fuertes (hasta un máximo de posiciones),
  repartiendo el efectivo a partes iguales.

El agente opera en varios PERFILES: su cuenta libre ('free', el benchmark que
usa "Comparar con el Agente IA") y un perfil por cada reto en que compite. En
los retos respeta el cupo de movimientos del reto, para competir en igualdad.
"""
import time

from . import challenges, config, database, ml, portfolio, users
from .database import FREE_PROFILE, challenge_profile

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


async def _signals_for(universe: list[str], prices: dict[str, float]) -> dict:
    signals = {}
    for sym in universe:
        price = prices.get(sym)
        if not price:
            continue
        try:
            pred = await ml.predict(sym, "1h")
            signals[sym] = {"signal": pred["signal"], "prob": pred["probabilityUp"], "price": price}
        except Exception:  # noqa: BLE001
            continue
    return signals


def _run_profile(bot_id: int, profile: str, signals: dict, prices: dict[str, float],
                 trades_left: int | None) -> list[str]:
    """Aplica la estrategia en un perfil. `trades_left` limita cuántos
    movimientos puede hacer (None = sin límite, cuenta libre)."""
    actions: list[str] = []

    def can_trade() -> bool:
        return trades_left is None or len(actions) < trades_left

    held = {p["symbol"]: p["quantity"] for p in portfolio.get_positions(bot_id, profile=profile)}
    for sym, qty in list(held.items()):
        if not can_trade():
            break
        sig = signals.get(sym)
        if sig and sig["signal"] == "VENTA":
            try:
                portfolio.sell(bot_id, sym, qty, sig["price"], "VENTA", sig["prob"], profile=profile)
                actions.append(f"vendió {sym}")
                held.pop(sym, None)
            except Exception:  # noqa: BLE001
                pass

    slots = MAX_POSITIONS - len(held)
    if slots > 0 and can_trade():
        candidates = sorted(
            [(s, d) for s, d in signals.items() if d["signal"] == "COMPRA" and s not in held],
            key=lambda kv: kv[1]["prob"], reverse=True,
        )[:slots]
        if candidates:
            acc = portfolio.get_account(bot_id, profile=profile)
            cash = acc.get("balance", 0) * CASH_USE
            per = cash / len(candidates)
            for sym, d in candidates:
                if per <= 1 or not can_trade():
                    break
                try:
                    qty = per / d["price"]
                    portfolio.buy(bot_id, sym, qty, d["price"], "COMPRA", d["prob"], profile=profile)
                    actions.append(f"compró {sym}")
                except Exception:  # noqa: BLE001
                    pass

    try:
        s = portfolio.portfolio_summary(bot_id, prices, profile=profile)
        portfolio.record_snapshot(bot_id, s["equity"], s["balance"], s["positionsValue"], profile=profile)
    except Exception:  # noqa: BLE001
        pass
    return actions


async def run_cycle(prices: dict[str, float]) -> dict:
    """Ejecuta una ronda diaria del agente en todos sus perfiles."""
    bot = users.ensure_bot()
    bot_id = bot["id"]

    signals = await _signals_for(BOT_UNIVERSE, prices)

    # Cuenta libre (benchmark, sin límite de movimientos)
    free_actions = _run_profile(bot_id, FREE_PROFILE, signals, prices, trades_left=None)

    # Un perfil por cada reto activo en que compite, respetando su cupo y los
    # mercados permitidos del reto (el bot solo opera cripto, así que si el reto
    # excluye la cripto simplemente no hace nada en él).
    now = time.time()
    for ch in challenges.my_active_challenges(bot_id):
        if ch["start_at"] > now or ch["end_at"] <= now:
            continue
        profile = challenge_profile(ch["id"])
        used = portfolio.count_trades(bot_id, profile=profile)
        left = max(0, ch["max_trades"] - used)
        if left <= 0:
            continue
        ch_signals = {s: v for s, v in signals.items() if challenges.market_allowed(ch, s)}
        if not ch_signals:
            continue
        _run_profile(bot_id, profile, ch_signals, prices, trades_left=left)

    database.set_setting("bot_last_run", str(time.time()))
    summary = "No hizo cambios hoy." if not free_actions else "Operaciones de hoy: " + ", ".join(free_actions) + "."
    _notify(bot_id, summary)
    return {"actions": free_actions, "summary": summary}
