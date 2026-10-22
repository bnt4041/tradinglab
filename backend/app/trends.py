"""Tendencias de mercado: panorama global de todos los activos + estudio IA.

Agrega las cotizaciones por categoría (cripto, acciones, índices, materias),
calcula amplitud (cuántos suben), mejores/peores, añade sentimiento (Miedo/
Codicia) y búsquedas en tendencia, y pide a la IA un estudio general combinado.
"""
import time

from . import assistant, config, external, market, social

_cache: dict = {}

STUDY_SYSTEM = (
    "Eres un analista de mercado claro y conciso dentro de un simulador educativo. "
    "A partir de los datos que te doy, escribe en español un ESTUDIO GENERAL del mercado "
    "de HOY en 3-5 frases: menciona el tono general (alcista/bajista/mixto), qué sectores "
    "(cripto, acciones, índices, materias primas) están más fuertes o débiles, el sentimiento "
    "y una conclusión práctica para alguien que aprende. Usa porcentajes y tendencias, NO cifras "
    "de precio. No es asesoramiento financiero. No inventes datos: usa solo los que te doy. "
    "No uses asteriscos ni markdown."
)


def _bias(avg_change: float, up_pct: float) -> tuple[str, str]:
    if avg_change > 0.3 and up_pct >= 55:
        return "Alcista", "alcista"
    if avg_change < -0.3 and up_pct <= 45:
        return "Bajista", "bajista"
    return "Mixto", "neutral"


def _summarize(tickers: list[dict]) -> dict:
    by_cat: dict[str, list[dict]] = {}
    for t in tickers:
        inst = config.instrument(t["symbol"]) or {}
        cat = inst.get("category", "cripto")
        t["_name"] = inst.get("name", t["symbol"])
        by_cat.setdefault(cat, []).append(t)

    categories = []
    for cat in config.CATEGORIES:
        rows = by_cat.get(cat, [])
        if not rows:
            continue
        ups = [r for r in rows if (r.get("changePercent") or 0) >= 0]
        avg = sum(r.get("changePercent") or 0 for r in rows) / len(rows)
        best = max(rows, key=lambda r: r.get("changePercent") or 0)
        worst = min(rows, key=lambda r: r.get("changePercent") or 0)
        categories.append({
            "category": cat,
            "label": config.CATEGORY_LABELS.get(cat, cat),
            "count": len(rows),
            "upPct": round(len(ups) / len(rows) * 100, 1),
            "avgChange": round(avg, 2),
            "topGainer": {"symbol": best["symbol"], "name": best["_name"], "changePercent": round(best.get("changePercent") or 0, 2)},
            "topLoser": {"symbol": worst["symbol"], "name": worst["_name"], "changePercent": round(worst.get("changePercent") or 0, 2)},
        })

    total = len(tickers)
    ups = sum(1 for t in tickers if (t.get("changePercent") or 0) >= 0)
    avg_all = sum(t.get("changePercent") or 0 for t in tickers) / total if total else 0
    up_pct = round(ups / total * 100, 1) if total else 0
    verdict, bias = _bias(avg_all, up_pct)

    ranked = sorted(tickers, key=lambda t: t.get("changePercent") or 0, reverse=True)
    movers = {
        "gainers": [{"symbol": r["symbol"], "name": r["_name"], "changePercent": round(r.get("changePercent") or 0, 2)} for r in ranked[:4]],
        "losers": [{"symbol": r["symbol"], "name": r["_name"], "changePercent": round(r.get("changePercent") or 0, 2)} for r in ranked[-4:][::-1]],
    }

    return {
        "overall": {"verdict": verdict, "bias": bias, "upPct": up_pct,
                    "avgChange": round(avg_all, 2), "assetsUp": ups, "assetsTotal": total},
        "categories": categories,
        "topMovers": movers,
    }


def _study_prompt(data: dict, fng, trending) -> str:
    o = data["overall"]
    lines = [
        f"Tono general: {o['verdict']} ({o['upPct']}% de {o['assetsTotal']} activos en verde, "
        f"variación media {o['avgChange']:+.2f}%).",
        "Por sector:",
    ]
    for c in data["categories"]:
        lines.append(f"- {c['label']}: {c['upPct']}% al alza, media {c['avgChange']:+.2f}%. "
                     f"Mejor {c['topGainer']['name']} {c['topGainer']['changePercent']:+.2f}%, "
                     f"peor {c['topLoser']['name']} {c['topLoser']['changePercent']:+.2f}%.")
    if fng:
        lines.append(f"Sentimiento cripto (Miedo/Codicia): {fng['value']} ({fng['label']}).")
    if trending:
        lines.append("Criptos en tendencia de búsquedas: " + ", ".join(trending[:6]) + ".")
    return "\n".join(lines)


def _rule_study(data: dict, fng) -> str:
    o = data["overall"]
    strong = sorted(data["categories"], key=lambda c: c["avgChange"], reverse=True)
    txt = [f"El mercado está hoy {o['verdict'].lower()}: {o['upPct']}% de los activos suben "
           f"(variación media {o['avgChange']:+.2f}%)."]
    if strong:
        txt.append(f"Lo más fuerte: {strong[0]['label']} ({strong[0]['avgChange']:+.2f}%); "
                   f"lo más débil: {strong[-1]['label']} ({strong[-1]['avgChange']:+.2f}%).")
    if fng:
        txt.append(f"El sentimiento cripto marca {fng['label'].lower()} ({fng['value']}/100).")
    txt.append("Recuerda: opera a favor de la tendencia general y con calma; esto es educativo, no asesoramiento.")
    return " ".join(txt)


async def market_trends() -> dict:
    now = time.time()
    if _cache and now - _cache.get("_ts", 0) < 300:
        return _cache["data"]

    tickers = []
    try:
        tickers += await market.get_binance_tickers(config.CRYPTO_IDS)
    except Exception:  # noqa: BLE001
        pass
    try:
        tickers += await market.get_yahoo_tickers(config.YAHOO_IDS)
    except Exception:  # noqa: BLE001
        pass
    if not tickers:
        raise RuntimeError("No se pudieron cargar los mercados")

    data = _summarize(tickers)
    fng = await external.get_fear_greed()
    trending = [t["symbol"] for t in await social.get_trending()][:7]

    study = await assistant.complete(STUDY_SYSTEM, _study_prompt(data, fng, trending), num_predict=320, kind="trends")
    source = "llm" if study else "rule"
    if not study:
        study = _rule_study(data, fng)

    result = {**data, "fearGreed": fng, "trending": trending, "study": study, "studySource": source,
              "disclaimer": "Panorama orientativo del mercado. No es asesoramiento financiero."}
    _cache.update({"data": result, "_ts": now})
    return result
