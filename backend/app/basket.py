"""Operación conjunta (cesta): consejo combinado de varias órdenes a la vez."""
from . import advisor


async def advise(items: list[dict]) -> dict:
    """items: [{symbol, side, notional}]. Devuelve consejo combinado del conjunto."""
    adv_cache: dict[str, dict] = {}
    per = []
    total_w = 0.0
    score_sum = 0.0
    counts = {"a favor": 0, "en contra": 0, "neutral": 0}

    for it in items:
        sym = it["symbol"]
        side = it["side"].upper()
        w = max(float(it.get("notional", 0) or 0), 0)
        if sym not in adv_cache:
            try:
                adv_cache[sym] = await advisor.advise(sym, "1h")
            except Exception:  # noqa: BLE001
                adv_cache[sym] = None
        a = adv_cache[sym]
        if not a:
            per.append({"symbol": sym, "side": side, "notional": w,
                        "aligned": "neutral", "verdict": "—", "bias": "neutral", "signal": "—"})
            counts["neutral"] += 1
            total_w += w
            continue

        comb = a["combined"]
        item_dir = (comb["score"] - 50) / 50.0  # + = alcista
        desir = item_dir if side == "BUY" else -item_dir
        aligned = "a favor" if desir > 0.15 else "en contra" if desir < -0.15 else "neutral"
        counts[aligned] += 1
        per.append({
            "symbol": sym, "side": side, "notional": w,
            "aligned": aligned, "verdict": comb["verdict"], "bias": comb["bias"],
            "signal": a["technical"]["signal"],
        })
        total_w += w
        score_sum += desir * w

    overall_desir = (score_sum / total_w) if total_w else 0.0
    overall01 = round((overall_desir + 1) / 2 * 100, 1)
    if overall_desir > 0.15:
        verdict, bias = "Favorable", "alcista"
    elif overall_desir < -0.15:
        verdict, bias = "Desfavorable", "bajista"
    else:
        verdict, bias = "Mixta · cautela", "neutral"

    explanation = (
        f"{counts['a favor']} órden(es) a favor de la IA, {counts['en contra']} en contra "
        f"y {counts['neutral']} neutrales."
    )
    return {
        "overall": {"verdict": verdict, "bias": bias, "score": overall01, "explanation": explanation},
        "items": per,
        "disclaimer": "Consejo orientativo del conjunto. No es asesoramiento financiero.",
    }
