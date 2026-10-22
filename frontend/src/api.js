// Cliente de API + utilidades de formato.
// En Docker nginx hace de proxy, así que usamos rutas relativas por defecto.
const BASE = import.meta.env.VITE_API_BASE || "";

// --- Usuario actual (perfil) ---
let _userId = Number(localStorage.getItem("tradelab_user")) || null;
export function getUserId() {
  return _userId;
}
export function setUserId(id) {
  _userId = id ? Number(id) : null;
  if (_userId) localStorage.setItem("tradelab_user", String(_userId));
  else localStorage.removeItem("tradelab_user");
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (_userId) headers["X-User-Id"] = String(_userId);
  const res = await fetch(`${BASE}/api${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = `Error ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  // Mercado
  symbols: () => request("/symbols"),
  ticker: (s) => request(`/ticker/${s}`),
  klines: (s, interval = "1h", limit = 300) =>
    request(`/klines/${s}?interval=${interval}&limit=${limit}`),
  predict: (s, interval = "1h") => request(`/predict/${s}?interval=${interval}`),
  advisor: (s, interval = "1h") => request(`/advisor/${s}?interval=${interval}`),
  news: (s) => request(`/news/${s}`),
  fearGreed: () => request("/fear-greed"),
  marketTrends: () => request("/market/trends"),
  categories: () => request("/categories"),
  rates: () => request("/rates"),
  assistantStatus: () => request("/assistant/status"),
  assistantChat: (messages, context) =>
    request("/assistant/chat", { method: "POST", body: JSON.stringify({ messages, context }) }),
  settings: () => request("/settings"),
  updateSettings: (payload) => request("/settings", { method: "POST", body: JSON.stringify(payload) }),
  openrouterModels: () => request("/openrouter/models"),
  aiTest: () => request("/ai/test", { method: "POST" }),
  aiLog: () => request("/ai/log"),
  basketAdvice: (items) => request("/basket/advice", { method: "POST", body: JSON.stringify({ items }) }),
  basketExecute: (items) => request("/basket/execute", { method: "POST", body: JSON.stringify({ items }) }),

  // Usuarios
  users: () => request("/users"),
  createUser: (name) => request("/users", { method: "POST", body: JSON.stringify({ name }) }),
  deleteUser: (id) => request(`/users/${id}`, { method: "DELETE" }),

  // Cartera
  portfolio: () => request("/portfolio"),
  portfolioHistory: () => request("/portfolio/history"),
  portfolioStats: () => request("/portfolio/stats"),
  portfolioEvaluation: () => request("/portfolio/evaluation"),
  botCompare: () => request("/bot/compare"),
  botRun: () => request("/bot/run", { method: "POST" }),
  trades: () => request("/trades"),
  movements: () => request("/account/movements"),
  trade: (payload) => request("/trade", { method: "POST", body: JSON.stringify(payload) }),
  deposit: (amount) => request("/account/deposit", { method: "POST", body: JSON.stringify({ amount }) }),
  withdraw: (amount) => request("/account/withdraw", { method: "POST", body: JSON.stringify({ amount }) }),
  resetAccount: () => request("/account/reset", { method: "POST" }),

  // Alertas y notificaciones
  alerts: () => request("/alerts"),
  createAlert: (payload) => request("/alerts", { method: "POST", body: JSON.stringify(payload) }),
  deleteAlert: (id) => request(`/alerts/${id}`, { method: "DELETE" }),
  notifications: () => request("/notifications"),
  markRead: () => request("/notifications/read", { method: "POST" }),
  clearNotifications: () => request("/notifications", { method: "DELETE" }),
};

export function connectWS(onMessage) {
  const base = import.meta.env.VITE_WS_BASE;
  let url;
  if (base) {
    url = `${base}/ws`;
  } else {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    url = `${proto}://${window.location.host}/ws`;
  }
  if (_userId) url += `?userId=${_userId}`;

  let ws;
  let closed = false;
  let retry;

  const open = () => {
    ws = new WebSocket(url);
    ws.onmessage = (ev) => {
      try {
        onMessage(JSON.parse(ev.data));
      } catch (_) {}
    };
    ws.onclose = () => {
      if (!closed) retry = setTimeout(open, 2500);
    };
    ws.onerror = () => ws.close();
  };
  open();

  return () => {
    closed = true;
    clearTimeout(retry);
    if (ws) ws.close();
  };
}

// ---- Formato ----
export const fmt = {
  usd: (n, dp = 2) =>
    n == null || isNaN(n)
      ? "—"
      : n.toLocaleString("es-ES", { minimumFractionDigits: dp, maximumFractionDigits: dp }),
  price: (n) => {
    if (n == null || isNaN(n)) return "—";
    const dp = n >= 1000 ? 2 : n >= 1 ? 2 : n >= 0.01 ? 4 : 6;
    return n.toLocaleString("es-ES", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  },
  pct: (n) => (n == null || isNaN(n) ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`),
  qty: (n) => (n == null ? "—" : Number(n.toPrecision(6)).toString()),
  compact: (n) =>
    n == null ? "—" : Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 1 }).format(n),
};

export const COIN_NAMES = {
  BTCUSDT: "Bitcoin",
  ETHUSDT: "Ethereum",
  BNBUSDT: "BNB",
  SOLUSDT: "Solana",
  XRPUSDT: "XRP",
  ADAUSDT: "Cardano",
  DOGEUSDT: "Dogecoin",
  AVAXUSDT: "Avalanche",
  TRXUSDT: "TRON",
  LINKUSDT: "Chainlink",
  DOTUSDT: "Polkadot",
  MATICUSDT: "Polygon",
  LTCUSDT: "Litecoin",
  BCHUSDT: "Bitcoin Cash",
  ATOMUSDT: "Cosmos",
  UNIUSDT: "Uniswap",
  NEARUSDT: "NEAR",
  FILUSDT: "Filecoin",
  XLMUSDT: "Stellar",
  ICPUSDT: "Internet Computer",
  AAVEUSDT: "Aave",
  INJUSDT: "Injective",
  SUIUSDT: "Sui",
  APTUSDT: "Aptos",
  ARBUSDT: "Arbitrum",
  OPUSDT: "Optimism",
};

// Registro de metadatos de instrumentos (se rellena tras cargar /api/symbols)
export const instrumentMeta = {};
export function setInstrumentMeta(list) {
  list.forEach((t) => {
    instrumentMeta[t.symbol] = {
      name: t.name,
      category: t.category,
      tier: t.tier,
      source: t.source,
    };
  });
}

export const coinName = (s) =>
  instrumentMeta[s]?.name || COIN_NAMES[s] || s.replace("USDT", "");

export const COIN_ICONS = {
  BTCUSDT: "₿", ETHUSDT: "Ξ", BNBUSDT: "◈", SOLUSDT: "◎", XRPUSDT: "✕",
  ADAUSDT: "₳", DOGEUSDT: "Ð", AVAXUSDT: "▲", TRXUSDT: "⟁", LINKUSDT: "⬡",
  DOTUSDT: "●", MATICUSDT: "⬢", LTCUSDT: "Ł", BCHUSDT: "Ƀ", ATOMUSDT: "⚛",
  UNIUSDT: "🦄", NEARUSDT: "Ⓝ", FILUSDT: "⨎", XLMUSDT: "✦", ICPUSDT: "∞",
  AAVEUSDT: "◬", INJUSDT: "⬣", SUIUSDT: "💧", APTUSDT: "◆", ARBUSDT: "◢", OPUSDT: "⬤",
};

const CATEGORY_ICONS = { cripto: "●", acciones: "🏢", indices: "📊", materias: "🛢️" };

export const coinIcon = (s) => {
  if (COIN_ICONS[s]) return COIN_ICONS[s];
  const cat = instrumentMeta[s]?.category;
  return CATEGORY_ICONS[cat] || "●";
};

// Subtítulo para la lista: par para cripto, id para el resto
export const assetSubtitle = (s) => {
  const meta = instrumentMeta[s];
  if (!meta || meta.source === "binance") return `${s.replace("USDT", "")}/USDT`;
  return s;
};

export const CATEGORY_ICON = (cat) => CATEGORY_ICONS[cat] || "●";
