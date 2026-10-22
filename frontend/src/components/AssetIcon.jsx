import { instrumentMeta } from "../api";

// Etiquetas cortas y elegantes para índices y materias primas
const SHORT = {
  SP500: "SPX", NAS100: "NDX", DOW: "DJI", DAX: "DAX", IBEX35: "IBX",
  GOLD: "Au", SILVER: "Ag", COPPER: "Cu", OIL_WTI: "WTI", OIL_BRENT: "BRT", NATGAS: "GAS",
};

function label(sym) {
  if (SHORT[sym]) return SHORT[sym];
  const meta = instrumentMeta[sym];
  if (!meta || meta.source === "binance") return sym.replace("USDT", "");
  return sym;
}

function hue(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

// Color sólido del activo (para gráficas), coherente con su ficha
export function assetColor(symbol) {
  return `hsl(${hue(symbol)} 62% 55%)`;
}

export default function AssetIcon({ symbol, size = 36, className = "" }) {
  const text = label(symbol);
  const h = hue(symbol);
  const bg = `hsl(${h} 72% 94%)`;
  const fg = `hsl(${h} 55% 40%)`;
  const ring = `hsl(${h} 60% 86%)`;
  const len = text.length;
  const fontRatio = len <= 2 ? 0.4 : len === 3 ? 0.32 : len === 4 ? 0.26 : 0.22;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        boxShadow: `inset 0 0 0 1px ${ring}`,
        fontSize: Math.round(size * fontRatio),
        letterSpacing: "-0.02em",
      }}
    >
      {text}
    </span>
  );
}
