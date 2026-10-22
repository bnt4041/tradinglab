import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, Minus, Newspaper, Lightbulb, AlertTriangle, Flame, Radar, MessageSquare, Users } from "lucide-react";
import { api } from "../api";
import { CONTEXT_TIPS } from "../content";
import CollapseBtn from "./CollapseBtn";

const SIGNAL = {
  COMPRA: { color: "text-up", bg: "bg-up-soft", Icon: TrendingUp, label: "COMPRA" },
  VENTA: { color: "text-down", bg: "bg-down-soft", Icon: TrendingDown, label: "VENTA" },
  NEUTRO: { color: "text-slate-500", bg: "bg-slate-100", Icon: Minus, label: "NEUTRO" },
};

const BIAS = {
  alcista: { color: "text-up", bar: "bg-up", ring: "ring-up/20 bg-up-soft" },
  bajista: { color: "text-down", bar: "bg-down", ring: "ring-down/20 bg-down-soft" },
  neutral: { color: "text-slate-600", bar: "bg-slate-400", ring: "ring-slate-200 bg-slate-100" },
};

const SENT_COLOR = { positivo: "text-up", negativo: "text-down", neutral: "text-slate-400" };
const IMPACT = {
  alcista: { Icon: TrendingUp, color: "text-up" },
  bajista: { Icon: TrendingDown, color: "text-down" },
  neutral: { Icon: Minus, color: "text-slate-400" },
};

export default function AIPanel({ symbol, interval, onData, collapsed, onToggleCollapse }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api.advisor(symbol, interval)
      .then((d) => { setData(d); onData?.(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [symbol, interval]);

  const tech = data?.technical;
  const sig = tech ? SIGNAL[tech.signal] : SIGNAL.NEUTRO;
  const comb = data?.combined;
  const bias = comb ? BIAS[comb.bias] : BIAS.neutral;
  const fg = data?.fearGreed;

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">IA & Asesor</h3>
            <span className="text-[11px] text-slate-400">Técnico + sentimiento · sugerencia</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={load} className="icon-btn h-8 w-8" title="Recalcular">
            <RefreshCw className="h-4 w-4" />
          </button>
          <CollapseBtn collapsed={collapsed} onToggle={onToggleCollapse} />
        </div>
      </div>

      {!collapsed && (<>
      <div className="p-4">
        {loading && (
          <div className="flex flex-col items-center gap-2 py-6 text-sm text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
            Analizando mercado y noticias…
          </div>
        )}
        {error && !loading && <div className="rounded-xl bg-down-soft p-3 text-center text-sm text-down">{error}</div>}

        {data && !loading && (
          <div className="animate-fade-in space-y-4">
            <div className={`rounded-2xl p-4 text-center ring-1 ${bias.ring}`}>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Consejo combinado</div>
              <div className={`text-xl font-extrabold ${bias.color}`}>{comb.verdict}</div>
              <div className="mx-auto mt-2 h-2 max-w-[200px] overflow-hidden rounded-full bg-black/5">
                <div className={`h-full rounded-full ${bias.bar}`} style={{ width: `${comb.score}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-600">{comb.explanation}</p>
            </div>

            <div>
              <div className="card-title mb-2">Análisis técnico (modelo ML)</div>
              <div className={`mb-2 flex items-center justify-between rounded-xl p-3 ${sig.bg}`}>
                <span className={`flex items-center gap-1.5 text-sm font-bold ${sig.color}`}>
                  <sig.Icon className="h-4 w-4" /> {sig.label}
                </span>
                <span className="text-[11px] text-slate-500">{tech.horizon}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Metric label="Prob. subida" value={`${tech.probabilityUp}%`} />
                <Metric label="Confianza" value={`${tech.confidence}%`} />
                <Metric label="Acierto hist." value={`${tech.modelAccuracy}%`} />
              </div>
              {tech.reasons?.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {tech.reasons.map((r, i) => {
                    const im = IMPACT[r.impact] || IMPACT.neutral;
                    return (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <im.Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${im.color}`} />
                        <span className="text-slate-600"><b className="text-slate-800">{r.indicator}:</b> {r.reading}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div>
              <div className="card-title mb-2">Sentimiento del mercado</div>
              {fg && (
                <div className="mb-2 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <div className="relative h-12 w-12 shrink-0">
                    <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="4" />
                      <circle cx="18" cy="18" r="15" fill="none" strokeWidth="4" strokeLinecap="round"
                        stroke={fg.value >= 55 ? "#16a34a" : fg.value <= 45 ? "#e11d48" : "#d97706"}
                        strokeDasharray={`${(fg.value / 100) * 94.2} 94.2`} />
                    </svg>
                    <span className="num absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-800">{fg.value}</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{fg.label}</div>
                    <div className="text-[11px] text-slate-400">Índice Miedo/Codicia (cripto)</div>
                  </div>
                </div>
              )}
              <div className="mb-2 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                <span className="text-slate-500">Tono de las noticias</span>
                <span className={`font-semibold ${SENT_COLOR[data.news?.sentiment?.label] || "text-slate-400"}`}>
                  {data.news?.sentiment?.label || "—"}
                </span>
              </div>
              {data.news?.items?.length > 0 ? (
                <ul className="space-y-1.5">
                  {data.news.items.slice(0, 4).map((n, i) => (
                    <li key={i}>
                      <a href={n.url} target="_blank" rel="noreferrer"
                        className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                        <Newspaper className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /> {n.title}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-400">Sin titulares recientes para este activo.</p>
              )}
            </div>

            {data.social && (
              <div>
                <div className="card-title mb-2 flex items-center gap-1.5">
                  <Radar className="h-3.5 w-3.5" /> Redes sociales y búsquedas
                </div>

                {/* Tendencia de búsquedas */}
                {data.social.trending && (
                  <div className="mb-2 flex items-center gap-2 rounded-xl bg-warn-soft p-3">
                    <Flame className="h-5 w-5 shrink-0 text-warn" />
                    <div className="text-xs">
                      <span className="font-bold text-warn">En tendencia · #{data.social.rank} más buscada</span>
                      {data.social.change24h != null && (
                        <span className={`ml-1 num ${data.social.change24h >= 0 ? "text-up" : "text-down"}`}>
                          ({data.social.change24h >= 0 ? "+" : ""}{data.social.change24h.toFixed(1)}% 24h)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Voto de la comunidad (CoinGecko) */}
                {data.social.community && (
                  <div className="mb-2 rounded-xl bg-slate-50 p-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Users className="h-3.5 w-3.5" /> Comunidad (CoinGecko)
                      </span>
                      <span className="num">
                        <b className="text-up">{data.social.community.upPercent}%</b>
                        <span className="text-slate-400"> / </span>
                        <b className="text-down">{data.social.community.downPercent}%</b>
                      </span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-down/30">
                      <div className="h-full bg-up" style={{ width: `${data.social.community.upPercent}%` }} />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                      <span>alcista</span><span>bajista</span>
                    </div>
                  </div>
                )}

                {/* Reddit */}
                {data.social.reddit?.available && (
                  <div className="mb-2">
                    <div className="mb-1.5 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <MessageSquare className="h-3.5 w-3.5" /> Reddit · {data.social.reddit.mentions} menciones
                      </span>
                      <span className={`font-semibold ${SENT_COLOR[data.social.reddit.sentiment?.label] || "text-slate-400"}`}>
                        {data.social.reddit.sentiment?.label || "—"}
                      </span>
                    </div>
                    {data.social.reddit.items?.length > 0 && (
                      <ul className="space-y-1">
                        {data.social.reddit.items.slice(0, 3).map((n, i) => (
                          <li key={i}>
                            <a href={n.url} target="_blank" rel="noreferrer"
                               className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] leading-snug text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                              <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" /> {n.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Más buscadas ahora */}
                {data.social.top?.length > 0 && (
                  <div>
                    <div className="mb-1 text-[11px] text-slate-400">Cripto más buscadas ahora:</div>
                    <div className="flex flex-wrap gap-1">
                      {data.social.top.map((s) => (
                        <span key={s} className="chip bg-slate-100 text-[10px] text-slate-600">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="flex items-start gap-2 rounded-xl bg-warn-soft p-3 text-[11px] leading-relaxed text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {data.disclaimer}
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> {CONTEXT_TIPS.ai.replace("💡 ", "")}
      </div>
      </>)}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 py-2">
      <div className="num text-base font-bold text-slate-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  );
}
