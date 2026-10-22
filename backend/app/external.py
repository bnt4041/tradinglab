"""Datos externos que influyen como 'asesor': sentimiento de mercado y noticias.

Fuentes gratuitas y sin API key:
- Índice Miedo/Codicia de cripto (alternative.me)
- Titulares por activo vía RSS de Yahoo Finance, con análisis de sentimiento simple
"""
import time
import xml.etree.ElementTree as ET

import httpx

from . import config

_fng_cache: dict = {}
_news_cache: dict[str, dict] = {}

# Palabras para un sentimiento sencillo basado en titulares (EN + ES)
_POS = {
    "surge", "soar", "rally", "gain", "gains", "jump", "jumps", "rise", "rises", "up",
    "high", "record", "bullish", "boom", "beat", "beats", "strong", "growth", "profit",
    "buy", "upgrade", "outperform", "soars", "rallies", "breakout", "sube", "suben",
    "máximo", "maximos", "alza", "gana", "ganancias", "fuerte", "récord", "optimismo",
}
_NEG = {
    "plunge", "crash", "fall", "falls", "drop", "drops", "slump", "sink", "sinks",
    "down", "low", "bearish", "loss", "losses", "weak", "miss", "misses", "sell",
    "downgrade", "fear", "fears", "warning", "cut", "cuts", "tumble", "slide", "baja",
    "bajan", "cae", "caen", "mínimo", "minimos", "pérdidas", "perdidas", "débil", "miedo",
    "desplome", "riesgo", "crisis",
}


async def get_fear_greed() -> dict | None:
    """Índice Miedo/Codicia de cripto (0-100). Cacheado 10 min."""
    now = time.time()
    if _fng_cache and now - _fng_cache.get("_ts", 0) < 600:
        return _fng_cache["data"]
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get("https://api.alternative.me/fng/", params={"limit": 1})
            resp.raise_for_status()
            d = resp.json()["data"][0]
        es = {
            "Extreme Fear": "Miedo extremo", "Fear": "Miedo", "Neutral": "Neutral",
            "Greed": "Codicia", "Extreme Greed": "Codicia extrema",
        }
        result = {
            "value": int(d["value"]),
            "label": es.get(d["value_classification"], d["value_classification"]),
        }
        _fng_cache.update({"data": result, "_ts": now})
        return result
    except Exception:  # noqa: BLE001
        return _fng_cache.get("data")


def _news_symbol(iid: str) -> str:
    """Símbolo que entiende el RSS de Yahoo."""
    inst = config.instrument(iid)
    if inst and inst["source"] == "binance":
        return iid.replace("USDT", "") + "-USD"  # BTCUSDT -> BTC-USD
    return config.yahoo_symbol(iid) or iid


def _score_sentiment(titles: list[str]) -> dict:
    pos = neg = 0
    for t in titles:
        words = {w.strip(".,:;!?()[]\"'").lower() for w in t.split()}
        pos += len(words & _POS)
        neg += len(words & _NEG)
    total = pos + neg
    if total == 0:
        return {"score": 0, "label": "neutral"}
    score = round((pos - neg) / total, 2)  # -1..1
    label = "positivo" if score > 0.15 else "negativo" if score < -0.15 else "neutral"
    return {"score": score, "label": label}


async def get_news(iid: str, limit: int = 6) -> dict:
    """Titulares recientes del activo + sentimiento agregado. Cacheado 5 min."""
    now = time.time()
    cached = _news_cache.get(iid)
    if cached and now - cached["_ts"] < 300:
        return cached["data"]

    sym = _news_symbol(iid)
    items = []
    try:
        url = "https://feeds.finance.yahoo.com/rss/2.0/headline"
        headers = {"User-Agent": config.YAHOO_UA}
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            resp = await client.get(url, params={"s": sym, "region": "US", "lang": "en-US"})
            resp.raise_for_status()
            root = ET.fromstring(resp.content)
        for item in root.iter("item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub = (item.findtext("pubDate") or "").strip()
            if title:
                items.append({"title": title, "url": link, "pub": pub})
            if len(items) >= limit:
                break
    except Exception:  # noqa: BLE001
        items = []

    sentiment = _score_sentiment([i["title"] for i in items])
    data = {"items": items, "sentiment": sentiment}
    _news_cache[iid] = {"data": data, "_ts": now}
    return data
