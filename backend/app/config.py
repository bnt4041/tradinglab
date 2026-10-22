"""Configuración central del emulador de trading (multi-activo)."""
import os

# ---------------- Fuentes de datos ----------------
# Hosts públicos de Binance para cripto (sin API key).
BINANCE_HOSTS = [
    h.strip()
    for h in os.getenv(
        "BINANCE_HOSTS",
        "https://data-api.binance.vision,https://api.binance.com,https://api1.binance.com",
    ).split(",")
    if h.strip()
]

# Yahoo Finance para acciones, índices y materias primas (sin API key).
YAHOO_HOSTS = [
    h.strip()
    for h in os.getenv(
        "YAHOO_HOSTS",
        "https://query1.finance.yahoo.com,https://query2.finance.yahoo.com",
    ).split(",")
    if h.strip()
]
YAHOO_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

# ---------------- Persistencia ----------------
DATA_DIR = os.getenv("DATA_DIR", "/app/data")
DB_PATH = os.path.join(DATA_DIR, "trading.db")
MODEL_DIR = os.path.join(DATA_DIR, "models")

# ---------------- Cuenta demo ----------------
INITIAL_BALANCE = float(os.getenv("INITIAL_BALANCE", "10000"))
FEE_RATE = float(os.getenv("FEE_RATE", "0.001"))

POLL_INTERVAL = float(os.getenv("POLL_INTERVAL", "3"))        # cripto (Binance)
YAHOO_POLL_INTERVAL = float(os.getenv("YAHOO_POLL_INTERVAL", "20"))  # bolsa (Yahoo)
MODEL_TTL = float(os.getenv("MODEL_TTL", "900"))

# ---------------- IA local (Ollama / Llama) ----------------
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

# ---------------- OpenRouter (IA en la nube, opcional) ----------------
OPENROUTER_URL = os.getenv("OPENROUTER_URL", "https://openrouter.ai/api/v1")
# Clave por defecto opcional (el usuario también puede ponerla en Ajustes)
OPENROUTER_KEY_ENV = os.getenv("OPENROUTER_API_KEY", "")

# ---------------- DeepSeek (IA en la nube, opcional) ----------------
DEEPSEEK_URL = os.getenv("DEEPSEEK_URL", "https://api.deepseek.com/v1")
# Clave por defecto opcional (el usuario también puede ponerla en Ajustes)
DEEPSEEK_KEY_ENV = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL_ENV = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

# ---------------- Catálogo de instrumentos ----------------
# id -> {source, yahoo?, name, category, tier}
# Para cripto el id es el símbolo de Binance (p.ej. BTCUSDT).
# Para el resto el id es un alias limpio y 'yahoo' es el ticker real en Yahoo.

_CRYPTO_MAIN = [
    ("BTCUSDT", "Bitcoin"), ("ETHUSDT", "Ethereum"), ("BNBUSDT", "BNB"),
    ("SOLUSDT", "Solana"), ("XRPUSDT", "XRP"), ("ADAUSDT", "Cardano"),
    ("DOGEUSDT", "Dogecoin"), ("AVAXUSDT", "Avalanche"), ("TRXUSDT", "TRON"),
    ("LINKUSDT", "Chainlink"),
]
_CRYPTO_SEC = [
    ("DOTUSDT", "Polkadot"), ("MATICUSDT", "Polygon"), ("LTCUSDT", "Litecoin"),
    ("BCHUSDT", "Bitcoin Cash"), ("ATOMUSDT", "Cosmos"), ("UNIUSDT", "Uniswap"),
    ("NEARUSDT", "NEAR"), ("FILUSDT", "Filecoin"), ("XLMUSDT", "Stellar"),
    ("ICPUSDT", "Internet Computer"), ("AAVEUSDT", "Aave"), ("INJUSDT", "Injective"),
    ("SUIUSDT", "Sui"), ("APTUSDT", "Aptos"), ("ARBUSDT", "Arbitrum"), ("OPUSDT", "Optimism"),
]

# Acciones (Yahoo): (id, nombre, tickerYahoo)
_STOCKS_MAIN = [
    ("AAPL", "Apple", "AAPL"), ("MSFT", "Microsoft", "MSFT"),
    ("NVDA", "Nvidia", "NVDA"), ("AMZN", "Amazon", "AMZN"),
    ("TSLA", "Tesla", "TSLA"), ("META", "Meta", "META"),
    ("GOOGL", "Alphabet (Google)", "GOOGL"),
]
_STOCKS_SEC = [
    ("AMD", "AMD", "AMD"), ("INTC", "Intel", "INTC"), ("NFLX", "Netflix", "NFLX"),
    ("DIS", "Disney", "DIS"), ("KO", "Coca-Cola", "KO"), ("V", "Visa", "V"),
    ("JPM", "JPMorgan", "JPM"), ("BABA", "Alibaba", "BABA"),
    ("PYPL", "PayPal", "PYPL"), ("BA", "Boeing", "BA"),
]
# Índices (Yahoo)
_INDICES = [
    ("SP500", "S&P 500", "^GSPC"), ("NAS100", "Nasdaq 100", "^NDX"),
    ("DOW", "Dow Jones", "^DJI"), ("DAX", "DAX (Alemania)", "^GDAXI"),
    ("IBEX35", "IBEX 35 (España)", "^IBEX"),
]
# Materias primas (futuros, Yahoo)
_COMMODITIES = [
    ("GOLD", "Oro", "GC=F"), ("SILVER", "Plata", "SI=F"),
    ("OIL_WTI", "Petróleo WTI", "CL=F"), ("OIL_BRENT", "Petróleo Brent", "BZ=F"),
    ("NATGAS", "Gas natural", "NG=F"), ("COPPER", "Cobre", "HG=F"),
]


def _build_instruments() -> dict:
    inst: dict[str, dict] = {}
    for sym, name in _CRYPTO_MAIN:
        inst[sym] = {"source": "binance", "name": name, "category": "cripto", "tier": "principal"}
    for sym, name in _CRYPTO_SEC:
        inst[sym] = {"source": "binance", "name": name, "category": "cripto", "tier": "secundario"}
    for iid, name, y in _STOCKS_MAIN:
        inst[iid] = {"source": "yahoo", "yahoo": y, "name": name, "category": "acciones", "tier": "principal"}
    for iid, name, y in _STOCKS_SEC:
        inst[iid] = {"source": "yahoo", "yahoo": y, "name": name, "category": "acciones", "tier": "secundario"}
    for iid, name, y in _INDICES:
        inst[iid] = {"source": "yahoo", "yahoo": y, "name": name, "category": "indices", "tier": "principal"}
    for iid, name, y in _COMMODITIES:
        inst[iid] = {"source": "yahoo", "yahoo": y, "name": name, "category": "materias", "tier": "principal"}
    return inst


INSTRUMENTS = _build_instruments()
ALL_IDS = list(INSTRUMENTS)
CRYPTO_IDS = [i for i, d in INSTRUMENTS.items() if d["source"] == "binance"]
YAHOO_IDS = [i for i, d in INSTRUMENTS.items() if d["source"] == "yahoo"]

CATEGORIES = ["cripto", "acciones", "indices", "materias"]
CATEGORY_LABELS = {
    "cripto": "Cripto",
    "acciones": "Acciones",
    "indices": "Índices",
    "materias": "Materias primas",
}


def instrument(iid: str) -> dict | None:
    return INSTRUMENTS.get(iid)


def yahoo_symbol(iid: str) -> str | None:
    d = INSTRUMENTS.get(iid)
    return d.get("yahoo") if d else None
