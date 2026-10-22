"""Evaluación de experiencia (coach): analiza el historial del usuario,
la alineación con las señales de la IA y la evolución de su cartera, y genera
una valoración global y pormenorizada con consejos usando el LLM local.

Si el LLM no está disponible, usa un respaldo basado en reglas.
"""
from . import assistant, config, portfolio

COACH_SYSTEM = (
    "Eres un coach de trading paciente y motivador dentro de 'TradeLab', un SIMULADOR "
    "con dinero FICTICIO para aprender. Hablas en español, cercano y claro, con frases "
    "cortas. Evalúas el desempeño del usuario con honestidad pero animándole. "
    "NUNCA das asesoramiento financiero real ni recomiendas invertir dinero real; "
    "recuerdas que la IA y el asesor son solo orientativos. Estructura tu respuesta en "
    "secciones breves con estos títulos EXACTOS y en este orden:\n"
    "VALORACIÓN GLOBAL\nQUÉ HAS HECHO BIEN\nQUÉ MEJORAR\nCONSEJOS PARA APRENDER\n"
    "Escribe los títulos tal cual, SIN asteriscos ni almohadillas. "
    "No cites cifras monetarias exactas (nada de '$9997'); habla de forma cualitativa y con "
    "porcentajes/tendencias. No inventes datos: usa solo los que te doy."
)


def _aligned(side: str, sig: str | None) -> str:
    if not sig or sig == "NEUTRO":
        return "neutral"
    if side == "BUY":
        return "followed" if sig == "COMPRA" else "against"
    return "followed" if sig == "VENTA" else "against"


def _build_movements(user_id: int) -> list[dict]:
    trades = portfolio.get_trades(user_id, limit=40)
    cash = portfolio.get_cash_movements(user_id, limit=40)
    items = []
    for t in trades:
        items.append({
            "kind": "trade",
            "ts": t["ts"],
            "side": t["side"],
            "symbol": t["symbol"],
            "quantity": t["quantity"],
            "price": t["price"],
            "pnl": t["pnl"] if t["side"] == "SELL" else None,
            "aiSignal": t.get("ai_signal"),
            "aligned": _aligned(t["side"], t.get("ai_signal")),
        })
    for c in cash:
        items.append({
            "kind": "cash", "ts": c["ts"], "type": c["type"], "amount": c["amount"],
        })
    items.sort(key=lambda x: x["ts"], reverse=True)
    return items


def _compute_metrics(user_id: int, equity: float, net: float) -> dict:
    st = portfolio.stats(user_id)
    trades = portfolio.get_trades(user_id, limit=1000)
    followed = sum(1 for t in trades if _aligned(t["side"], t.get("ai_signal")) == "followed")
    against = sum(1 for t in trades if _aligned(t["side"], t.get("ai_signal")) == "against")
    neutral = len(trades) - followed - against
    decided = followed + against

    hist = portfolio.get_history(user_id)
    recent = 0.0
    if len(hist) >= 3:
        mid = hist[len(hist) // 2]["equity"]
        recent = equity - mid
    pnl = equity - net
    pnl_pct = (pnl / net * 100) if net else 0
    threshold = max(net * 0.001, 1)
    if recent > threshold:
        trend = "mejorando"
    elif recent < -threshold:
        trend = "empeorando"
    else:
        trend = "estable"

    return {
        "equity": equity,
        "net": net,
        "pnl": pnl,
        "pnlPct": round(pnl_pct, 2),
        "trend": trend,
        "closedTrades": st["closedTrades"],
        "winRate": st["winRate"],
        "totalRealized": st["totalRealized"],
        "bestTrade": st["bestTrade"],
        "worstTrade": st["worstTrade"],
        "totalTrades": len(trades),
        "followed": followed,
        "against": against,
        "neutral": neutral,
        "followedPct": round(followed / decided * 100, 1) if decided else None,
    }


def _summary_text(m: dict, movements: list[dict]) -> str:
    lines = [
        f"- Valor actual de la cartera: {m['equity']:.2f} USD (aportado neto {m['net']:.2f}).",
        f"- P&L total: {m['pnl']:.2f} USD ({m['pnlPct']:+.2f}%).",
        f"- Tendencia reciente del valor: {m['trend']}.",
        f"- Operaciones totales: {m['totalTrades']} (cerradas: {m['closedTrades']}).",
        f"- Tasa de acierto en operaciones cerradas: {m['winRate']}%.",
        f"- P&L realizado: {m['totalRealized']:.2f} USD. Mejor: {m['bestTrade']:.2f}, peor: {m['worstTrade']:.2f}.",
    ]
    if m["followedPct"] is not None:
        lines.append(
            f"- Alineación con la IA: seguiste su señal en {m['followed']} operaciones y fuiste en "
            f"contra en {m['against']} ({m['followedPct']}% a favor de la IA)."
        )
    else:
        lines.append("- Aún no hay datos de alineación con la IA (pocas señales registradas).")

    lines.append("\nÚltimos movimientos:")
    for it in movements[:12]:
        if it["kind"] == "trade":
            al = {"followed": "siguió a la IA", "against": "fue contra la IA", "neutral": "IA neutral/sin dato"}[it["aligned"]]
            pnl = f", resultado {it['pnl']:.2f} USD" if it["pnl"] is not None else ""
            lines.append(f"- {it['side']} {it['symbol']} a {it['price']:.2f} ({al}{pnl}).")
        else:
            lines.append(f"- {it['type'].upper()} de {it['amount']:.2f} USD (ajuste de saldo).")
    return "\n".join(lines)


def _rule_based(m: dict) -> str:
    good, improve, tips = [], [], []
    if m["pnl"] >= 0:
        good.append("Tu cartera está en positivo respecto a lo aportado. ¡Buen comienzo!")
    else:
        improve.append("Ahora mismo estás en pérdidas; conviene operar con más calma y tamaños pequeños.")
    if m["closedTrades"] >= 3:
        if m["winRate"] >= 50:
            good.append(f"Aciertas más de la mitad de las operaciones cerradas ({m['winRate']}%).")
        else:
            improve.append(f"Tu tasa de acierto es del {m['winRate']}%: revisa por qué cierras en pérdidas.")
    if m["followedPct"] is not None:
        if m["followedPct"] >= 60:
            good.append("Sueles operar en línea con la IA, buena disciplina.")
        elif m["followedPct"] <= 40:
            improve.append("A menudo operas en contra de la IA; al menos entiende por qué antes de hacerlo.")
    trend_txt = {
        "mejorando": "Tu valor viene mejorando últimamente: sigue así.",
        "empeorando": "Tu valor viene bajando últimamente: baja el ritmo y revisa tu plan.",
        "estable": "Tu valor está estable últimamente.",
    }[m["trend"]]
    tips += [
        "Define antes de entrar cuánto ganas o pierdes como máximo en cada operación.",
        "No operes por impulso: usa las alertas y deja que el mercado venga a ti.",
        "Revisa tu historial para aprender de las operaciones que salieron mal.",
    ]
    parts = ["VALORACIÓN GLOBAL", trend_txt, "", "QUÉ HAS HECHO BIEN"]
    parts += [f"• {g}" for g in (good or ["Estás practicando, que es el primer paso."])]
    parts += ["", "QUÉ MEJORAR"]
    parts += [f"• {i}" for i in (improve or ["Sigue sumando operaciones para tener más datos."])]
    parts += ["", "CONSEJOS PARA APRENDER"]
    parts += [f"• {t}" for t in tips]
    return "\n".join(parts)


async def evaluate(user_id: int, equity: float, net: float) -> dict:
    m = _compute_metrics(user_id, equity, net)
    movements = _build_movements(user_id)

    narrative, source = None, "rule"
    if m["totalTrades"] == 0 and abs(m["pnl"]) < 1e-6:
        narrative = (
            "VALORACIÓN GLOBAL\nAún no has hecho operaciones. ¡Empieza con una compra pequeña "
            "para tener algo que evaluar!\n\nQUÉ HAS HECHO BIEN\n• Has dado el primer paso abriendo "
            "el simulador.\n\nQUÉ MEJORAR\n• Haz tu primera operación para empezar a aprender.\n\n"
            "CONSEJOS PARA APRENDER\n• Mira la señal de la IA y el gráfico antes de comprar.\n"
            "• Empieza con importes pequeños: aquí equivocarse es gratis."
        )
        source = "empty"
    else:
        llm = await assistant.complete(COACH_SYSTEM, _summary_text(m, movements), num_predict=600)
        if llm:
            narrative, source = llm, "llm"
        else:
            narrative = _rule_based(m)

    status = await assistant.status()
    return {
        "metrics": m,
        "movements": movements[:15],
        "narrative": narrative,
        "source": source,
        "llmState": status.get("state"),
    }
