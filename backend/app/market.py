"""Obtención de datos de mercado reales desde dos fuentes públicas (sin API key):

- Binance  -> criptomonedas (tiempo real)
- Yahoo    -> acciones, índices y materias primas (~15 min de retraso)

Todo se expone de forma uniforme por el 'id' de instrumento del catálogo (config).
"""
import asyncio
import time
from typing import Any

import httpx

from . import config

_price_cache: dict[str, dict[str, Any]] = {}
_klines_cache: dict[str, dict[str, Any]] = {}
_fx_cache: dict[str, Any] = {}


# ===================== Binance (cripto) =====================
async def _binance_get(path: str, params: dict | None = None) -> Any:
    last_err: Exception | None = None
    async with httpx.AsyncClient(timeout=10.0) as client:
        for host in config.BINANCE_HOSTS:
            try:
                resp = await client.get(f"{host}{path}", params=params)
                resp.raise_for_status()
                return resp.json()
            except Exception as exc:  # noqa: BLE001
                last_err = exc
    raise RuntimeError(f"No se pudo contactar con Binance: {last_err}")


async def get_binance_tickers(ids: list[str]) -> list[dict]:
    import json

    data = await _binance_get(
        "/api/v3/ticker/24hr",
        {"symbols": json.dumps(ids, separators=(",", ":"))},
    )
    now = time.time()
    results = []
    for d in data:
        r = {
            "symbol": d["symbol"],
            "price": float(d["lastPrice"]),
            "change": float(d["priceChange"]),
            "changePercent": float(d["priceChangePercent"]),
            "high": float(d["highPrice"]),
            "low": float(d["lowPrice"]),
            "volume": float(d["quoteVolume"]),
            "_ts": now,
        }
        _price_cache[d["symbol"]] = r
        results.append(r)
    return results


async def _binance_klines(iid: str, interval: str, limit: int) -> list[dict]:
    raw = await _binance_get(
        "/api/v3/klines", {"symbol": iid, "interval": interval, "limit": limit}
    )
    return [
        {
            "time": int(k[0] / 1000),
            "open": float(k[1]), "high": float(k[2]), "low": float(k[3]),
            "close": float(k[4]), "volume": float(k[5]),
        }
        for k in raw
    ]


async def filter_valid_symbols(symbols: list[str]) -> list[str]:
    """Filtra símbolos de cripto que existan en Binance (evita pares rotos)."""
    try:
        data = await _binance_get("/api/v3/ticker/price")
        available = {d["symbol"] for d in data}
        valid = [s for s in symbols if s in available]
        return valid or symbols
    except Exception:  # noqa: BLE001
        return symbols


# ===================== Yahoo (bolsa / materias) =====================
# Mapa intervalo de la app -> (intervalo Yahoo, rango). Yahoo no tiene 4h nativo.
_Y_IV = {
    "15m": ("15m", "1mo"),
    "1h": ("60m", "3mo"),
    "4h": ("1d", "1y"),
    "1d": ("1d", "2y"),
}


async def _yahoo_get(path: str, params: dict | None = None) -> Any:
    last_err: Exception | None = None
    headers = {"User-Agent": config.YAHOO_UA, "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=12.0, headers=headers) as client:
        for host in config.YAHOO_HOSTS:
            try:
                resp = await client.get(f"{host}{path}", params=params)
                resp.raise_for_status()
                return resp.json()
            except Exception as exc:  # noqa: BLE001
                last_err = exc
    raise RuntimeError(f"No se pudo contactar con Yahoo: {last_err}")


def _parse_yahoo_chart(iid: str, data: Any) -> dict:
    result = data["chart"]["result"][0]
    meta = result["meta"]
    ts = result.get("timestamp") or []
    quote = (result.get("indicators", {}).get("quote") or [{}])[0]
    opens = quote.get("open") or []
    highs = quote.get("high") or []
    lows = quote.get("low") or []
    closes = quote.get("close") or []
    vols = quote.get("volume") or []

    candles = []
    for i in range(len(ts)):
        o, h, l, c = (
            opens[i] if i < len(opens) else None,
            highs[i] if i < len(highs) else None,
            lows[i] if i < len(lows) else None,
            closes[i] if i < len(closes) else None,
        )
        if None in (o, h, l, c):
            continue
        candles.append({
            "time": int(ts[i]),
            "open": float(o), "high": float(h), "low": float(l),
            "close": float(c), "volume": float(vols[i] or 0) if i < len(vols) else 0,
        })
    return {"meta": meta, "candles": candles}


async def _yahoo_ticker(iid: str) -> dict:
    now = time.time()
    cached = _price_cache.get(iid)
    if cached and now - cached["_ts"] < 15:
        return cached
    y = config.yahoo_symbol(iid)
    data = await _yahoo_get(f"/v8/finance/chart/{y}", {"interval": "1d", "range": "5d"})
    parsed = _parse_yahoo_chart(iid, data)
    meta = parsed["meta"]
    candles = parsed["candles"]
    price = float(meta.get("regularMarketPrice") or (candles[-1]["close"] if candles else 0))
    prev = meta.get("chartPreviousClose") or meta.get("previousClose") or (
        candles[-2]["close"] if len(candles) >= 2 else price
    )
    prev = float(prev) or price
    last = candles[-1] if candles else {}
    r = {
        "symbol": iid,
        "price": price,
        "change": price - prev,
        "changePercent": ((price - prev) / prev * 100) if prev else 0,
        "high": float(meta.get("regularMarketDayHigh") or last.get("high") or price),
        "low": float(meta.get("regularMarketDayLow") or last.get("low") or price),
        "volume": float(meta.get("regularMarketVolume") or last.get("volume") or 0),
        "_ts": now,
    }
    _price_cache[iid] = r
    return r


async def get_yahoo_tickers(ids: list[str]) -> list[dict]:
    """Cotizaciones de varios instrumentos de Yahoo con concurrencia limitada."""
    sem = asyncio.Semaphore(6)

    async def one(iid):
        async with sem:
            try:
                return await _yahoo_ticker(iid)
            except Exception:  # noqa: BLE001
                return None

    res = await asyncio.gather(*[one(i) for i in ids])
    return [r for r in res if r]


async def _yahoo_klines(iid: str, interval: str) -> list[dict]:
    y = config.yahoo_symbol(iid)
    iv, rng = _Y_IV.get(interval, ("1d", "1y"))
    data = await _yahoo_get(f"/v8/finance/chart/{y}", {"interval": iv, "range": rng})
    return _parse_yahoo_chart(iid, data)["candles"]


# ===================== API unificada =====================
def _source(iid: str) -> str:
    d = config.instrument(iid)
    return d["source"] if d else "binance"


async def get_ticker(iid: str) -> dict:
    if _source(iid) == "yahoo":
        return await _yahoo_ticker(iid)
    now = time.time()
    cached = _price_cache.get(iid)
    if cached and now - cached["_ts"] < 2:
        return cached
    data = await _binance_get("/api/v3/ticker/24hr", {"symbol": iid})
    r = {
        "symbol": iid,
        "price": float(data["lastPrice"]),
        "change": float(data["priceChange"]),
        "changePercent": float(data["priceChangePercent"]),
        "high": float(data["highPrice"]),
        "low": float(data["lowPrice"]),
        "volume": float(data["quoteVolume"]),
        "_ts": now,
    }
    _price_cache[iid] = r
    return r


async def get_klines(iid: str, interval: str = "1h", limit: int = 300) -> list[dict]:
    key = f"{iid}:{interval}:{limit}"
    now = time.time()
    cached = _klines_cache.get(key)
    ttl = 15 if _source(iid) == "yahoo" else 5
    if cached and now - cached["_ts"] < ttl:
        return cached["data"]

    if _source(iid) == "yahoo":
        candles = await _yahoo_klines(iid, interval)
        if limit:
            candles = candles[-limit:]
    else:
        candles = await _binance_klines(iid, interval, limit)

    _klines_cache[key] = {"data": candles, "_ts": now}
    return candles


def cached_price(iid: str) -> float | None:
    c = _price_cache.get(iid)
    return c["price"] if c else None


# ===================== Tipos de cambio (divisa) =====================
FX_PAIRS = {"EUR": "EURUSDT", "GBP": "GBPUSDT"}
FX_FALLBACK = {"USD": 1.0, "EUR": 0.92, "GBP": 0.79}


async def get_fx_rates() -> dict[str, float]:
    now = time.time()
    if _fx_cache and now - _fx_cache.get("_ts", 0) < 60:
        return _fx_cache["rates"]
    rates = {"USD": 1.0}
    try:
        for cur, pair in FX_PAIRS.items():
            data = await _binance_get("/api/v3/ticker/price", {"symbol": pair})
            price = float(data["price"])
            rates[cur] = (1.0 / price) if price else FX_FALLBACK.get(cur, 1.0)
        _fx_cache["rates"] = rates
        _fx_cache["_ts"] = now
        return rates
    except Exception:  # noqa: BLE001
        return _fx_cache.get("rates") or dict(FX_FALLBACK)
