"""Indicadores técnicos calculados con pandas/numpy.

Se usan tanto para mostrar en el gráfico como de features para el modelo ML.
"""
import numpy as np
import pandas as pd


def sma(series: pd.Series, period: int) -> pd.Series:
    return series.rolling(period).mean()


def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    macd_line = ema(series, fast) - ema(series, slow)
    signal_line = ema(macd_line, signal)
    hist = macd_line - signal_line
    return macd_line, signal_line, hist


def bollinger(series: pd.Series, period: int = 20, mult: float = 2.0):
    mid = sma(series, period)
    std = series.rolling(period).std()
    return mid + mult * std, mid, mid - mult * std


def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high_low = df["high"] - df["low"]
    high_close = (df["high"] - df["close"].shift()).abs()
    low_close = (df["low"] - df["close"].shift()).abs()
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / period, adjust=False).mean()


def build_feature_frame(candles: list[dict]) -> pd.DataFrame:
    """Convierte velas en un DataFrame con todas las features técnicas."""
    df = pd.DataFrame(candles)
    df = df.sort_values("time").reset_index(drop=True)

    close = df["close"]
    df["ret1"] = close.pct_change()
    df["ret3"] = close.pct_change(3)
    df["ret6"] = close.pct_change(6)
    df["sma10"] = sma(close, 10)
    df["sma30"] = sma(close, 30)
    df["sma_ratio"] = df["sma10"] / df["sma30"] - 1
    df["ema12"] = ema(close, 12)
    df["price_vs_ema"] = close / df["ema12"] - 1
    df["rsi"] = rsi(close, 14)
    macd_line, signal_line, hist = macd(close)
    df["macd"] = macd_line
    df["macd_hist"] = hist
    upper, mid, lower = bollinger(close)
    df["bb_pos"] = (close - lower) / (upper - lower).replace(0, np.nan)
    df["atr"] = atr(df, 14)
    df["atr_pct"] = df["atr"] / close
    # El volumen puede ser 0 (p. ej. índices): evitamos inf / división por cero
    df["vol_change"] = df["volume"].pct_change().replace([np.inf, -np.inf], 0).fillna(0)
    df["volatility"] = close.pct_change().rolling(10).std()

    # Saneado final: ningún infinito debe llegar al modelo (rompe scikit-learn)
    df = df.replace([np.inf, -np.inf], np.nan)

    return df


FEATURE_COLUMNS = [
    "ret1",
    "ret3",
    "ret6",
    "sma_ratio",
    "price_vs_ema",
    "rsi",
    "macd",
    "macd_hist",
    "bb_pos",
    "atr_pct",
    "vol_change",
    "volatility",
]
