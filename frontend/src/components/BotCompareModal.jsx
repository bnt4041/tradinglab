import { useEffect, useState } from "react";
import { X, Bot, Trophy, Zap, TrendingUp, TrendingDown, ScrollText } from "lucide-react";
import { api, fmt, coinName } from "../api";
import { useCurrency } from "../currency";
import AssetIcon from "./AssetIcon";

const USER_COLOR = "#4f46e5";

/* Gráfica de dos líneas (tú vs agente) */
function DualLine({ series, money }) {
  const W = 620, H = 200, pad = { l: 8, r: 8, t: 14, b: 22 };
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) {
    return <div className="flex h-[200px] items-center justify-center text-center text-xs text-slate-400">
      Aún recopilando datos; vuelve en un rato para ver la evolución comparada.
    </div>;
  }
  const ts = all.map((p) => p.t), ys = all.map((p) => p.value);
  const t0 = Math.min(...ts), t1 = Math.max(...ts);
  let minV = Math.min(...ys), maxV = Math.max(...ys);
  if (minV === maxV) { minV -= 1; maxV += 1; }
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const X = (t) => pad.l + (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)) * iw;
  const Y = (v) => pad.t + (1 - (v - minV) / (maxV - minV)) * ih;
  const fmtDate = (t) => new Date(t * 1000).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }}>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={pad.l} x2={W - pad.r} y1={pad.t + f * ih} y2={pad.t + f * ih} stroke="rgba(15,23,42,0.06)" />
      ))}
      {series.map((s, i) => {
        const pts = s.points.slice().sort((a, b) => a.t - b.t);
        const d = pts.map((p, j) => `${j ? "L" : "M"}${X(p.t).toFixed(1)},${Y(p.value).toFixed(1)}`).join(" ");
        return <path key={i} d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />;
      })}
      <text x={pad.l} y={11} fill="#94a3b8" fontSize="10">{money(maxV)}</text>
      <text x={pad.l} y={pad.t + ih} fill="#94a3b8" fontSize="10">{money(minV)}</text>
      <text x={W - pad.r} y={H - 6} textAnchor="end" fill="#94a3b8" fontSize="10">{fmtDate(t1)}</text>
    </svg>
  );
}

export default function BotCompareModal({ onClose, onToast }) {
  const { money, price } = useCurrency();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);

  const load = () => {
    setError(null);
    api.botCompare().then(setData).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, []);

  const runBot = async () => {
    setRunning(true);
    try {
      const res = await api.botRun();
      onToast?.(res.summary || "El agente ha operado", "info");
      load();
    } catch (e) {
      onToast?.(e.message, "danger");
    } finally {
      setRunning(false);
    }
  };

  const leaderText = !data ? "" :
    data.leader === "user" ? `Vas ${Math.abs(data.diffPct)}% por delante del Agente IA` :
    data.leader === "bot" ? `El Agente IA va ${Math.abs(data.diffPct)}% por delante de ti` :
    "Vais prácticamente empatados";

  return (
    <div className="fixed inset-0 z-[66] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: "#8b5cf6" }}>
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Tú vs Agente IA</h2>
              <span className="text-[11px] text-slate-400">El agente opera solo siguiendo sus señales. Compárate con él.</span>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn h-8 w-8"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {error && <div className="rounded-xl bg-down-soft p-3 text-center text-sm text-down">{error}</div>}
          {!data && !error && (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-slate-500">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" /> Cargando comparación…
            </div>
          )}

          {data && (
            <>
              {/* Veredicto */}
              <div className="flex items-center gap-2 rounded-2xl bg-brand-50 p-3 text-sm font-semibold text-brand-700">
                <Trophy className="h-4 w-4" /> {leaderText}
              </div>

              {/* Tarjetas comparadas */}
              <div className="grid grid-cols-2 gap-3">
                <CompareCard label="Tú" color={USER_COLOR} equity={money(data.user.equity)} pnl={data.user.pnlPct}
                  win={data.leader === "user"} />
                <CompareCard label="Agente IA" color="#8b5cf6" equity={money(data.bot.equity)} pnl={data.bot.pnlPct}
                  win={data.leader === "bot"} />
              </div>

              {/* Gráfica comparada */}
              <div className="rounded-2xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center gap-4 text-[11px]">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full" style={{ background: USER_COLOR }} /> Tú</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full" style={{ background: "#8b5cf6" }} /> Agente IA</span>
                </div>
                <DualLine money={money} series={[
                  { color: USER_COLOR, points: data.user.history.map((p) => ({ t: p.t, value: p.equity })) },
                  { color: "#8b5cf6", points: data.bot.history.map((p) => ({ t: p.t, value: p.equity })) },
                ]} />
              </div>

              {/* Cartera del agente */}
              <div>
                <div className="card-title mb-2">Cartera del Agente IA</div>
                {data.bot.holdings?.length === 0 ? (
                  <p className="text-xs text-slate-400">El agente está en efectivo ahora mismo.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.bot.holdings.map((h) => (
                      <span key={h.symbol} className="flex items-center gap-1.5 rounded-full bg-slate-50 py-1 pl-1 pr-2.5 text-xs">
                        <AssetIcon symbol={h.symbol} size={20} /> {coinName(h.symbol)}
                        <span className={`num font-semibold ${h.pnl >= 0 ? "text-up" : "text-down"}`}>{fmt.pct(h.pnlPercent)}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Últimas operaciones del agente */}
              {data.bot.trades?.length > 0 && (
                <div>
                  <div className="card-title mb-2">Últimos movimientos del agente</div>
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {data.bot.trades.slice(0, 8).map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                        <span className="flex items-center gap-1.5">
                          {t.side === "BUY" ? <TrendingUp className="h-3.5 w-3.5 text-up" /> : <TrendingDown className="h-3.5 w-3.5 text-down" />}
                          <b className={t.side === "BUY" ? "text-up" : "text-down"}>{t.side === "BUY" ? "Compró" : "Vendió"}</b>
                          {coinName(t.symbol)}
                        </span>
                        <span className="num text-[10px] text-slate-400">
                          {new Date(t.ts * 1000).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })}
                          {t.ai_signal ? ` · IA: ${t.ai_signal}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Registro del agente (sus decisiones diarias) */}
              {data.bot.log?.length > 0 && (
                <div>
                  <div className="card-title mb-2 flex items-center gap-1.5">
                    <ScrollText className="h-3.5 w-3.5" /> Registro del agente
                  </div>
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {data.bot.log.map((l) => (
                      <div key={l.id} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                        <span className="num shrink-0 text-[10px] text-slate-400">
                          {new Date(l.created_at * 1000).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-slate-600">{l.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={runBot} disabled={running} className="btn-ghost w-full">
                <Zap className="h-4 w-4" /> {running ? "El agente está operando…" : "Simular su movimiento de hoy"}
              </button>
              <p className="text-center text-[11px] text-slate-400">
                El Agente IA opera automáticamente una vez al día. Esto es educativo, no asesoramiento.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CompareCard({ label, color, equity, pnl, win }) {
  const up = pnl >= 0;
  return (
    <div className={`rounded-2xl border p-4 ${win ? "border-brand-300 bg-brand-50" : "border-slate-200"}`}>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {label} {win && <Trophy className="h-3.5 w-3.5 text-amber-500" />}
      </div>
      <div className="num text-lg font-bold text-slate-900">{equity}</div>
      <div className={`num text-xs font-semibold ${up ? "text-up" : "text-down"}`}>{up ? "+" : ""}{pnl}%</div>
    </div>
  );
}
