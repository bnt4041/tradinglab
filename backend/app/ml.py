"""Modelo de IA predictiva (ML entrenado).

Entrena un RandomForest con datos históricos reales para estimar la
probabilidad de que la PRÓXIMA vela cierre al alza. Es SOLO una sugerencia
educativa: nunca ejecuta operaciones por sí mismo.

El modelo se cachea por símbolo+intervalo y se reentrena cuando caduca.
"""
import time

import numpy as np
from sklearn.ensemble import RandomForestClassifier

from . import config, indicators, market

_model_cache: dict[str, dict] = {}


# Descripciones legibles de cada indicador para explicar la sugerencia
_INDICATOR_LABELS = {
    "ret1": "Momento reciente (última vela)",
    "ret3": "Momento a corto plazo (3 velas)",
    "ret6": "Momento a medio plazo (6 velas)",
    "sma_ratio": "Cruce de medias móviles (10 vs 30)",
    "price_vs_ema": "Precio respecto a su media exponencial",
    "rsi": "RSI (sobrecompra/sobreventa)",
    "macd": "MACD (fuerza de tendencia)",
    "macd_hist": "Histograma MACD (aceleración)",
    "bb_pos": "Posición en las Bandas de Bollinger",
    "atr_pct": "Volatilidad (ATR)",
    "vol_change": "Cambio de volumen",
    "volatility": "Volatilidad reciente",
}


def _interpret(row: dict) -> list[dict]:
    """Genera lecturas humanas de los indicadores clave para la vela actual."""
    reasons = []

    rsi_val = row.get("rsi")
    if rsi_val is not None and not np.isnan(rsi_val):
        if rsi_val >= 70:
            reading, impact = f"RSI {rsi_val:.0f}: sobrecompra, posible corrección", "bajista"
        elif rsi_val <= 30:
            reading, impact = f"RSI {rsi_val:.0f}: sobreventa, posible rebote", "alcista"
        else:
            reading, impact = f"RSI {rsi_val:.0f}: zona neutral", "neutral"
        reasons.append({"indicator": "RSI", "reading": reading, "impact": impact})

    macd_hist = row.get("macd_hist")
    if macd_hist is not None and not np.isnan(macd_hist):
        if macd_hist > 0:
            reading, impact = "MACD por encima de su señal: momento alcista", "alcista"
        else:
            reading, impact = "MACD por debajo de su señal: momento bajista", "bajista"
        reasons.append({"indicator": "MACD", "reading": reading, "impact": impact})

    sma_ratio = row.get("sma_ratio")
    if sma_ratio is not None and not np.isnan(sma_ratio):
        if sma_ratio > 0:
            reading, impact = "Media de 10 por encima de la de 30: tendencia alcista", "alcista"
        else:
            reading, impact = "Media de 10 por debajo de la de 30: tendencia bajista", "bajista"
        reasons.append({"indicator": "Tendencia", "reading": reading, "impact": impact})

    bb_pos = row.get("bb_pos")
    if bb_pos is not None and not np.isnan(bb_pos):
        if bb_pos > 0.9:
            reading, impact = "Precio pegado a la banda superior: estirado al alza", "bajista"
        elif bb_pos < 0.1:
            reading, impact = "Precio pegado a la banda inferior: estirado a la baja", "alcista"
        else:
            reading, impact = "Precio dentro de las bandas: sin extremos", "neutral"
        reasons.append({"indicator": "Bollinger", "reading": reading, "impact": impact})

    return reasons


def _train(symbol: str, candles: list[dict]) -> dict:
    df = indicators.build_feature_frame(candles)
    # Objetivo: ¿la próxima vela cierra por encima de la actual?
    df["target"] = (df["close"].shift(-1) > df["close"]).astype(int)
    feat = df.dropna(subset=indicators.FEATURE_COLUMNS + ["target"]).copy()

    if len(feat) < 60:
        raise ValueError("Datos insuficientes para entrenar el modelo")

    X = feat[indicators.FEATURE_COLUMNS].values
    y = feat["target"].values

    # Split temporal: 80% entrenamiento, 20% test (sin barajar para ser honestos)
    split = int(len(X) * 0.8)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=6,
        min_samples_leaf=5,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    accuracy = float(model.score(X_test, y_test)) if len(X_test) else 0.5

    importances = dict(
        zip(indicators.FEATURE_COLUMNS, model.feature_importances_.tolist())
    )

    return {
        "model": model,
        "accuracy": accuracy,
        "importances": importances,
        "df": df,
        "_ts": time.time(),
    }


async def predict(symbol: str, interval: str = "1h") -> dict:
    """Devuelve la sugerencia de la IA para el símbolo indicado."""
    key = f"{symbol}:{interval}"
    cached = _model_cache.get(key)
    if cached is None or time.time() - cached["_ts"] > config.MODEL_TTL:
        candles = await market.get_klines(symbol, interval=interval, limit=500)
        cached = _train(symbol, candles)
        _model_cache[key] = cached

    model = cached["model"]
    df = cached["df"]
    last = df.dropna(subset=indicators.FEATURE_COLUMNS).iloc[-1]
    X_last = last[indicators.FEATURE_COLUMNS].values.reshape(1, -1)

    proba = model.predict_proba(X_last)[0]
    classes = list(model.classes_)
    prob_up = float(proba[classes.index(1)]) if 1 in classes else 0.0

    # Señal con zona neutral para evitar sobre-operar
    if prob_up >= 0.58:
        signal, direction = "COMPRA", "up"
    elif prob_up <= 0.42:
        signal, direction = "VENTA", "down"
    else:
        signal, direction = "NEUTRO", "flat"

    confidence = abs(prob_up - 0.5) * 2 * 100  # 0-100

    # Top indicadores por importancia global del modelo
    top = sorted(
        cached["importances"].items(), key=lambda kv: kv[1], reverse=True
    )[:4]
    top_features = [
        {"name": _INDICATOR_LABELS.get(k, k), "weight": round(v * 100, 1)}
        for k, v in top
    ]

    return {
        "symbol": symbol,
        "interval": interval,
        "signal": signal,
        "direction": direction,
        "probabilityUp": round(prob_up * 100, 1),
        "confidence": round(confidence, 1),
        "modelAccuracy": round(cached["accuracy"] * 100, 1),
        "horizon": f"próxima vela ({interval})",
        "reasons": _interpret(last.to_dict()),
        "topFeatures": top_features,
        "rsi": None if np.isnan(last.get("rsi", np.nan)) else round(float(last["rsi"]), 1),
        "disclaimer": (
            "Esto es una estimación estadística con fines educativos, NO una "
            "recomendación de inversión. El mercado real es impredecible."
        ),
    }


def peek_signal(symbol: str, interval: str = "1h") -> dict | None:
    """Devuelve la señal de la IA SOLO si el modelo ya está en caché.

    No entrena (no bloquea), así se puede registrar al operar sin latencia.
    """
    key = f"{symbol}:{interval}"
    cached = _model_cache.get(key)
    if cached is None or time.time() - cached["_ts"] > config.MODEL_TTL:
        return None
    try:
        model = cached["model"]
        df = cached["df"]
        last = df.dropna(subset=indicators.FEATURE_COLUMNS).iloc[-1]
        X = last[indicators.FEATURE_COLUMNS].values.reshape(1, -1)
        proba = model.predict_proba(X)[0]
        classes = list(model.classes_)
        prob_up = float(proba[classes.index(1)]) if 1 in classes else 0.0
        signal = "COMPRA" if prob_up >= 0.58 else "VENTA" if prob_up <= 0.42 else "NEUTRO"
        return {"signal": signal, "prob": round(prob_up * 100, 1)}
    except Exception:  # noqa: BLE001
        return None
