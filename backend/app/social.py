"""Señales de redes sociales y atención web como ayuda al asesor.

Fuentes gratuitas y sin clave (reachables desde este entorno):
- CoinGecko 'trending'      -> criptos más buscadas (atención/tráfico).
- CoinGecko community votes -> % de usuarios alcistas/bajistas (cripto).
- Reddit (RSS de búsqueda)  -> menciones recientes + tono (cripto y acciones).

El sentimiento de titulares reutiliza el analizador de external.
"""
import time
import xml.etree.ElementTree as ET

import httpx

from . import config, external

_trending_cache: dict = {}
_community_cache: dict[str, dict] = {}
_reddit_cache: dict[str, dict] = {}
_COINGECKO = "https://api.coingecko.com/api/v3"
_ATOM = "{http://www.w3.org/2005/Atom}"

# Mapa símbolo Binance -> id de CoinGecko (para el voto de comunidad)
_CG_IDS = {
    "BTCUSDT": "bitcoin", "ETHUSDT": "ethereum", "BNBUSDT": "binancecoin",
    "SOLUSDT": "solana", "XRPUSDT": "ripple", "ADAUSDT": "cardano",
    "DOGEUSDT": "dogecoin", "AVAXUSDT": "avalanche-2", "TRXUSDT": "tron",
    "LINKUSDT": "chainlink", "DOTUSDT": "polkadot", "MATICUSDT": "matic-network",
    "LTCUSDT": "litecoin", "BCHUSDT": "bitcoin-cash", "ATOMUSDT": "cosmos",
    "UNIUSDT": "uniswap", "NEARUSDT": "near", "FILUSDT": "filecoin",
    "XLMUSDT": "stellar", "ICPUSDT": "internet-computer", "AAVEUSDT": "aave",
    "INJUSDT": "injective-protocol", "SUIUSDT": "sui", "APTUSDT": "aptos",
    "ARBUSDT": "arbitrum", "OPUSDT": "optimism",
}


async def get_trending() -> list[dict]:
    now = time.time()
    if _trending_cache and now - _trending_cache.get("_ts", 0) < 600:
        return _trending_cache["data"]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{_COINGECKO}/search/trending")
            r.raise_for_status()
            coins = r.json().get("coins", [])
    except Exception:  # noqa: BLE001
        return _trending_cache.get("data", [])
    out = []
    for i, c in enumerate(coins):
        it = c.get("item", {})
        try:
            change = it["data"]["price_change_percentage_24h"]["usd"]
        except Exception:  # noqa: BLE001
            change = None
        out.append({"symbol": (it.get("symbol") or "").upper(), "name": it.get("name"),
                    "rank": i + 1, "change24h": change})
    _trending_cache.update({"data": out, "_ts": now})
    return out


async def _community_sentiment(symbol: str) -> dict | None:
    """Voto de la comunidad de CoinGecko (cripto): % alcista/bajista."""
    cg_id = _CG_IDS.get(symbol)
    if not cg_id:
        return None
    now = time.time()
    cached = _community_cache.get(symbol)
    if cached and now - cached["_ts"] < 1200:
        return cached["data"]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{_COINGECKO}/coins/{cg_id}",
                params={"localization": "false", "tickers": "false", "market_data": "false",
                        "community_data": "false", "developer_data": "false", "sparkline": "false"},
            )
            r.raise_for_status()
            d = r.json()
        up = d.get("sentiment_votes_up_percentage")
        if up is None:
            return None
        data = {"upPercent": round(up, 1), "downPercent": round(100 - up, 1)}
        _community_cache[symbol] = {"data": data, "_ts": now}
        return data
    except Exception:  # noqa: BLE001
        return (cached or {}).get("data")


async def _reddit(query: str) -> dict:
    """Menciones recientes en Reddit (RSS de búsqueda) + tono de los títulos."""
    now = time.time()
    cached = _reddit_cache.get(query)
    if cached and now - cached["_ts"] < 1200:
        return cached["data"]
    titles, items = [], []
    try:
        headers = {"User-Agent": "Mozilla/5.0 TradeLab/1.0"}
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            r = await client.get(
                "https://www.reddit.com/search.rss",
                params={"q": query, "sort": "new", "limit": "25", "t": "week"},
            )
            r.raise_for_status()
            root = ET.fromstring(r.content)
        for entry in root.findall(f"{_ATOM}entry"):
            title = (entry.findtext(f"{_ATOM}title") or "").strip()
            link_el = entry.find(f"{_ATOM}link")
            link = link_el.get("href") if link_el is not None else ""
            if title:
                titles.append(title)
                items.append({"title": title, "url": link})
    except Exception:  # noqa: BLE001
        data = (cached or {}).get("data") or {"available": False}
        return data
    sentiment = external._score_sentiment(titles)
    data = {"available": True, "mentions": len(items), "sentiment": sentiment,
            "items": items[:4], "source": "Reddit"}
    _reddit_cache[query] = {"data": data, "_ts": now}
    return data


def _reddit_query(symbol: str) -> str:
    # El nombre funciona mucho mejor que el ticker en el buscador de Reddit
    # (p. ej. "Apple" devuelve resultados y "AAPL" no).
    inst = config.instrument(symbol) or {}
    name = inst.get("name") or symbol.replace("USDT", "")
    return name.split("(")[0].strip()  # "Alphabet (Google)" -> "Alphabet"


async def get_social(symbol: str) -> dict:
    inst = config.instrument(symbol) or {}
    is_crypto = inst.get("source") == "binance"

    trending = await get_trending()
    top = [t["symbol"] for t in trending[:7]]
    base = symbol.replace("USDT", "").upper()
    match = next((t for t in trending if t["symbol"] == base), None) if is_crypto else None

    community = await _community_sentiment(symbol) if is_crypto else None
    reddit = await _reddit(_reddit_query(symbol))

    # Puntuación social combinada (-1..1) con las señales disponibles
    parts = []
    if match and match.get("change24h") is not None:
        import math
        parts.append(max(-1.0, min(1.0, math.tanh(match["change24h"] / 10.0))))
    if community:
        parts.append((community["upPercent"] - 50) / 50.0)
    if reddit.get("available") and reddit.get("mentions", 0) > 0:
        parts.append(reddit["sentiment"]["score"])
    score = sum(parts) / len(parts) if parts else None

    return {
        "symbol": symbol,
        "trending": match is not None,
        "rank": match["rank"] if match else None,
        "change24h": match["change24h"] if match else None,
        "top": top,
        "community": community,          # {upPercent, downPercent} o None
        "reddit": reddit,                # {available, mentions, sentiment, items}
        "score": None if score is None else round(score, 3),
        "note": (
            f"{base} está entre lo más buscado ahora." if match
            else "Sin pico de búsquedas destacado ahora mismo." if is_crypto
            else "Señales de búsquedas/comunidad disponibles solo para cripto."
        ),
    }


def social_score(social: dict) -> float | None:
    return social.get("score") if social else None
