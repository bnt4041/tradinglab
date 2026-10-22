import { useEffect, useState } from "react";
import { Activity, RefreshCw, TrendingUp, TrendingDown, Minus, Flame, Sparkles } from "lucide-react";
import { api, coinName } from "../api";
import CollapseBtn from "./CollapseBtn";

const BIAS = {
  alcista: { color: "text-up", bg: "bg-up-soft", Icon: TrendingUp },
  bajista: { color: "text-down", bg: "bg-down-soft", Icon: TrendingDown },
  neutral: { color: "text-slate-600", bg: "bg-slate-100", Icon: Minus },
};

const pct = (n) => `${n >= 0 ? "+" : ""}${Number(n).toFixed(2)}%`;

export default function MarketTrendsCard({ onSelect, collapsed, onToggleCollapse }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api.marketTrends()
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const bias = data ? BIAS[data.overall.bias] || BIAS.neutral : BIAS.neutral;

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Activity className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Tendencias de mercado</h3>
            <span className="text-[11px] text-slate-400">Panorama global · estudio combinado</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={load} disabled={loading} className="icon-btn h-8 w-8" title="Actualizar">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <CollapseBtn collapsed={collapsed} onToggle={onToggleCollapse} />
        </div>
      </div>

      {!collapsed && (
      <div className="p-4">
        {loading && (
          <div className="flex flex-col items-center gap-3 py-8 text-sm text-slate-500">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
            Analizando todas las tendencias del mercado…
            <span className="text-xs text-slate-400">El estudio lo genera la IA; puede tardar unos segundos.</span>
          </div>
        )}
        {error && !loading && <div className="rounded-xl bg-down-soft p-3 text-center text-sm text-down">{error}</div>}

        {data && !loading && (
          <div className="animate-fade-in space-y-4">
            {/* Veredicto global */}
            <div className={`flex items-center justify-between rounded-2xl p-4 ${bias.bg}`}>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Mercado hoy</div>
                <div className={`flex items-center gap-1.5 text-xl font-extrabold ${bias.color}`}>
                  <bias.Icon className="h-5 w-5" /> {data.overall.verdict}
                </div>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div><b className="num text-slate-700">{data.overall.upPct}%</b> en verde</div>
                <div>media <b className={`num ${data.overall.avgChange >= 0 ? "text-up" : "text-down"}`}>{pct(data.overall.avgChange)}</b></div>
              </div>
            </div>

            {/* Estudio combinado (IA) */}
            {data.study && (
              <div className="rounded-2xl border border-slate-200 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <Sparkles className="h-3.5 w-3.5 text-brand-600" /> Estudio combinado
                </div>
                <p className="text-xs leading-relaxed text-slate-600">{data.study}</p>
              </div>
            )}

            {/* Por sector */}
            <div>
              <div className="card-title mb-2">Por sector</div>
              <div className="space-y-2">
                {data.categories.map((c) => {
                  const up = c.avgChange >= 0;
                  return (
                    <div key={c.category}>
                      <div className="mb-0.5 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600">{c.label} <span className="text-slate-400">({c.count})</span></span>
                        <span className={`num font-semibold ${up ? "text-up" : "text-down"}`}>{pct(c.avgChange)}</span>
                      </div>
                      <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className={up ? "bg-up" : "bg-down"} style={{ width: `${c.upPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mejores y peores */}
            <div className="grid grid-cols-2 gap-2">
              <Movers title="Mejores" movers={data.topMovers.gainers} positive onSelect={onSelect} />
              <Movers title="Peores" movers={data.topMovers.losers} onSelect={onSelect} />
            </div>

            {/* Sentimiento + búsquedas */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              {data.fearGreed && (
                <span>Miedo/Codicia: <b className="num text-slate-700">{data.fearGreed.value}</b> ({data.fearGreed.label})</span>
              )}
              {data.trending?.length > 0 && (
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-warn" /> {data.trending.slice(0, 5).join(" · ")}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function Movers({ title, movers, positive, onSelect }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2.5">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">{title}</div>
      <div className="space-y-1">
        {movers.map((m) => (
          <button key={m.symbol} onClick={() => onSelect?.(m.symbol)}
            className="flex w-full items-center justify-between rounded-md px-1 py-0.5 text-left hover:bg-white">
            <span className="truncate text-[11px] font-medium text-slate-600">{coinName(m.symbol)}</span>
            <span className={`num text-[11px] font-semibold ${m.changePercent >= 0 ? "text-up" : "text-down"}`}>{pct(m.changePercent)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
