import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { fmt, coinName, assetSubtitle } from "../api";
import { useCurrency } from "../currency";
import AssetIcon from "./AssetIcon";
import CollapseBtn from "./CollapseBtn";

const TABS = [
  { v: "all", label: "Todos" },
  { v: "cripto", label: "Cripto" },
  { v: "acciones", label: "Acciones" },
  { v: "indices", label: "Índices" },
  { v: "materias", label: "Materias" },
];

const TIER_RANK = { principal: 0, secundario: 1 };

export default function Watchlist({ tickers, selected, onSelect, collapsed, onToggleCollapse }) {
  const { price } = useCurrency();
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    let arr = Object.values(tickers);
    if (tab !== "all") arr = arr.filter((t) => t.category === tab);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      arr = arr.filter(
        (t) => t.symbol.toLowerCase().includes(q) || coinName(t.symbol).toLowerCase().includes(q)
      );
    }
    return arr.sort((a, b) => {
      const tr = (TIER_RANK[a.tier] ?? 1) - (TIER_RANK[b.tier] ?? 1);
      if (tr !== 0) return tr;
      return (b.volume || 0) - (a.volume || 0);
    });
  }, [tickers, tab, query]);

  return (
    <div className={`card flex flex-col overflow-hidden ${collapsed ? "pb-1" : "h-full"}`}>
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="card-title">Mercados</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-up" />
            en vivo
          </span>
          <CollapseBtn collapsed={collapsed} onToggle={onToggleCollapse} />
        </div>
      </div>

      {!collapsed && (
      <>
      <div className="px-3 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input !py-2 !pl-9 text-xs"
            placeholder="Buscar activo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1 px-3 pt-2">
        {TABS.map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
              tab === t.v ? "bg-brand-600 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex-1 overflow-y-auto px-2 pb-2">
        {Object.keys(tickers).length === 0 &&
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="mx-1 mb-1 h-14 animate-pulse rounded-xl bg-slate-100" />
          ))}
        {Object.keys(tickers).length > 0 && list.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-slate-400">Sin resultados.</div>
        )}
        {list.map((t) => {
          const up = (t.changePercent ?? 0) >= 0;
          const active = t.symbol === selected;
          return (
            <button
              key={t.symbol}
              onClick={() => onSelect(t.symbol)}
              className={`group mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                active ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-slate-50"
              }`}
            >
              <AssetIcon symbol={t.symbol} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-800">{coinName(t.symbol)}</span>
                  <span className="num shrink-0 text-sm font-semibold text-slate-900">{price(t.price)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="truncate text-[11px] text-slate-400">{assetSubtitle(t.symbol)}</span>
                  <span
                    className={`num shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                      up ? "bg-up-soft text-up" : "bg-down-soft text-down"
                    }`}
                  >
                    {fmt.pct(t.changePercent)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      </>
      )}
    </div>
  );
}
