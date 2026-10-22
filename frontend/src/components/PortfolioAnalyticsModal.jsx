import { useEffect, useMemo, useState } from "react";
import { X, TrendingUp, Wallet, Target, Trophy } from "lucide-react";
import { api, coinName } from "../api";
import { useCurrency } from "../currency";
import { assetColor } from "./AssetIcon";

/* ---------- Gráfica de área (series temporales) ---------- */
function AreaChart({ points, money, color = "#4f46e5" }) {
  const W = 640, H = 200, pad = { l: 8, r: 8, t: 16, b: 22 };
  if (!points || points.length < 2) {
    return (
      <div className="flex h-[200px] items-center justify-center text-center text-xs text-slate-400">
        Aún recopilando datos. La curva se irá rellenando a medida que uses la cuenta.
      </div>
    );
  }
  const xs = points.map((p) => p.t);
  const ys = points.map((p) => p.value);
  const t0 = xs[0], t1 = xs[xs.length - 1];
  let minV = Math.min(...ys), maxV = Math.max(...ys);
  if (minV === maxV) { minV -= Math.abs(minV) * 0.02 + 1; maxV += Math.abs(maxV) * 0.02 + 1; }
  const span = maxV - minV;
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;
  const X = (t) => pad.l + (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)) * innerW;
  const Y = (v) => pad.t + (1 - (v - minV) / span) * innerH;

  const line = points.map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(1)},${Y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${X(t1).toFixed(1)},${pad.t + innerH} L${X(t0).toFixed(1)},${pad.t + innerH} Z`;
  const last = points[points.length - 1].value;
  const fmtDate = (t) =>
    new Date(t * 1000).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }}>
      <defs>
        <linearGradient id={`g-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={pad.l} x2={W - pad.r} y1={pad.t + f * innerH} y2={pad.t + f * innerH}
          stroke="rgba(15,23,42,0.06)" strokeWidth="1" />
      ))}
      <path d={area} fill={`url(#g-${color})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={X(t1)} cy={Y(last)} r="3.5" fill={color} />
      <text x={pad.l} y={11} fill="#94a3b8" fontSize="10">{money(maxV)}</text>
      <text x={pad.l} y={pad.t + innerH} fill="#94a3b8" fontSize="10">{money(minV)}</text>
      <text x={W - pad.r} y={pad.t + innerH + 16} textAnchor="end" fill="#94a3b8" fontSize="10">{fmtDate(t1)}</text>
      <text x={pad.l + 46} y={pad.t + innerH + 16} textAnchor="start" fill="#94a3b8" fontSize="10">{fmtDate(t0)}</text>
    </svg>
  );
}

/* ---------- Donut de distribución ---------- */
function Donut({ segments }) {
  const r = 54, sw = 22, cx = 70, cy = 70, circ = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  let acc = 0;
  return (
    <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef2f7" strokeWidth={sw} />
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {segments.map((s, i) => {
          const dash = (s.value / total) * circ;
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={sw}
              strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-acc} strokeLinecap="butt" />
          );
          acc += dash;
          return el;
        })}
      </g>
    </svg>
  );
}

function StatTile({ Icon, label, value, color = "text-slate-900" }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`num text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

export default function PortfolioAnalyticsModal({ portfolio, onClose }) {
  const { money } = useCurrency();
  const [history, setHistory] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.portfolioHistory().then(setHistory).catch(() => setHistory({ points: [] }));
    api.portfolioStats().then(setStats).catch(() => setStats(null));
  }, []);

  const p = portfolio;
  const up = (p?.totalPnl ?? 0) >= 0;

  // El historial viene como {t, equity}; la gráfica usa {t, value}
  const equityPoints = useMemo(
    () => (history?.points || []).map((pt) => ({ t: pt.t, value: pt.equity })),
    [history]
  );

  // Distribución: efectivo + cada posición
  const allocation = useMemo(() => {
    const segs = [];
    if (p?.balance > 0) segs.push({ label: "Efectivo", value: p.balance, color: "#94a3b8" });
    (p?.holdings || []).forEach((h) =>
      segs.push({ label: coinName(h.symbol), value: h.value, color: assetColor(h.symbol) })
    );
    return segs.sort((a, b) => b.value - a.value);
  }, [p]);

  const holdings = (p?.holdings || []).slice().sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
  const maxAbs = Math.max(1, ...holdings.map((h) => Math.abs(h.pnl)));

  const realizedColor = stats && stats.totalRealized < 0 ? "#e11d48" : "#16a34a";

  return (
    <div className="fixed inset-0 z-[66] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <TrendingUp className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-bold text-slate-900">Análisis de la cartera</h2>
          </div>
          <button onClick={onClose} className="icon-btn h-8 w-8"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-6 overflow-y-auto p-5">
          {/* Tiles resumen */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile Icon={Wallet} label="Valor total" value={money(p?.equity)} />
            <StatTile Icon={TrendingUp} label="P&L total" value={money(p?.totalPnl)} color={up ? "text-up" : "text-down"} />
            <StatTile Icon={Target} label="Operaciones" value={stats?.closedTrades ?? "—"} />
            <StatTile Icon={Trophy} label="Aciertos" value={stats ? `${stats.winRate}%` : "—"} />
          </div>

          {/* Evolución */}
          <section>
            <h3 className="card-title mb-2">Evolución del valor de tu cartera</h3>
            <div className="rounded-2xl border border-slate-200 p-3">
              <AreaChart points={equityPoints} money={money} color="#4f46e5" />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Distribución */}
            <section>
              <h3 className="card-title mb-2">Distribución actual</h3>
              <div className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4">
                {allocation.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">Sin datos de cartera.</div>
                ) : (
                  <>
                    <Donut segments={allocation} />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {allocation.slice(0, 7).map((s, i) => {
                        const pct = (s.value / (p.equity || 1)) * 100;
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                            <span className="flex-1 truncate text-slate-600">{s.label}</span>
                            <span className="num text-slate-400">{pct.toFixed(1)}%</span>
                            <span className="num w-20 text-right font-semibold text-slate-700">{money(s.value)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* P&L por posición */}
            <section>
              <h3 className="card-title mb-2">Resultado por posición (no realizado)</h3>
              <div className="rounded-2xl border border-slate-200 p-4">
                {holdings.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">No tienes posiciones abiertas.</div>
                ) : (
                  <div className="space-y-2.5">
                    {holdings.map((h) => {
                      const gain = h.pnl >= 0;
                      const w = (Math.abs(h.pnl) / maxAbs) * 100;
                      return (
                        <div key={h.symbol}>
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="font-medium text-slate-600">{coinName(h.symbol)}</span>
                            <span className={`num font-semibold ${gain ? "text-up" : "text-down"}`}>
                              {gain ? "+" : ""}{money(h.pnl)}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${gain ? "bg-up" : "bg-down"}`} style={{ width: `${w}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* P&L realizado */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="card-title">P&L realizado (operaciones cerradas)</h3>
              {stats && stats.closedTrades > 0 && (
                <div className="flex gap-3 text-[11px]">
                  <span className="text-slate-500">Mejor: <b className="num text-up">{money(stats.bestTrade)}</b></span>
                  <span className="text-slate-500">Peor: <b className="num text-down">{money(stats.worstTrade)}</b></span>
                  <span className="text-slate-500">Total: <b className={`num ${stats.totalRealized >= 0 ? "text-up" : "text-down"}`}>{money(stats.totalRealized)}</b></span>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 p-3">
              {stats && stats.realizedSeries?.length >= 2 ? (
                <AreaChart points={stats.realizedSeries} money={money} color={realizedColor} />
              ) : (
                <div className="py-10 text-center text-xs text-slate-400">
                  Aún no has cerrado suficientes operaciones. Vende alguna posición para ver aquí tu P&L realizado acumulado.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
