import { useEffect, useState } from "react";
import {
  X, GraduationCap, TrendingUp, TrendingDown, Minus, ThumbsUp, Wrench, Lightbulb,
  Target, CheckCircle2, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Sparkles,
} from "lucide-react";
import { api, coinName } from "../api";
import { useCurrency } from "../currency";

const HEADINGS = ["VALORACIÓN GLOBAL", "QUÉ HAS HECHO BIEN", "QUÉ MEJORAR", "CONSEJOS PARA APRENDER"];
const SECTION_UI = {
  "VALORACIÓN GLOBAL": { Icon: Target, color: "text-brand-600", bg: "bg-brand-50" },
  "QUÉ HAS HECHO BIEN": { Icon: ThumbsUp, color: "text-up", bg: "bg-up-soft" },
  "QUÉ MEJORAR": { Icon: Wrench, color: "text-warn", bg: "bg-warn-soft" },
  "CONSEJOS PARA APRENDER": { Icon: Lightbulb, color: "text-brand-600", bg: "bg-brand-50" },
};

const clean = (l) => l.replace(/\*\*/g, "").replace(/^#+\s*/, "").trim();
const BULLET = /^(\d+[.)]|[•\-*])\s+/;

function parseNarrative(text) {
  const sections = [];
  let cur = null;
  for (const raw of (text || "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const norm = line.replace(/[*#]/g, "").replace(/[:：]\s*$/, "").trim().toUpperCase();
    const h = HEADINGS.find((hd) => norm === hd || norm.startsWith(hd));
    if (h) { cur = { title: h, items: [], text: [] }; sections.push(cur); continue; }
    if (!cur) { cur = { title: null, items: [], text: [] }; sections.push(cur); }
    if (BULLET.test(line)) cur.items.push(clean(line.replace(BULLET, "")));
    else cur.text.push(clean(line));
  }
  return sections;
}

const TREND_UI = {
  mejorando: { Icon: TrendingUp, color: "text-up", label: "Mejorando" },
  empeorando: { Icon: TrendingDown, color: "text-down", label: "Empeorando" },
  estable: { Icon: Minus, color: "text-slate-500", label: "Estable" },
};

const ALIGN_UI = {
  followed: { Icon: CheckCircle2, color: "text-up", label: "siguió IA" },
  against: { Icon: AlertTriangle, color: "text-warn", label: "contra IA" },
  neutral: { Icon: Minus, color: "text-slate-400", label: "IA neutral" },
};

export default function ExperienceEvaluationModal({ onClose }) {
  const { money, price } = useCurrency();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.portfolioEvaluation().then(setData).catch((e) => setError(e.message));
  }, []);

  const m = data?.metrics;
  const trend = m ? TREND_UI[m.trend] || TREND_UI.estable : null;
  const sections = data ? parseNarrative(data.narrative) : [];

  return (
    <div className="fixed inset-0 z-[66] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Evaluación de experiencia</h2>
              <span className="text-[11px] text-slate-400">Tu coach analiza tu historial y tu uso de la IA</span>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn h-8 w-8"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-5 overflow-y-auto p-5">
          {error && <div className="rounded-xl bg-down-soft p-3 text-center text-sm text-down">{error}</div>}

          {!data && !error && (
            <div className="flex flex-col items-center gap-3 py-12 text-sm text-slate-500">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
              Tu coach está analizando tu experiencia…
              <span className="text-xs text-slate-400">Puede tardar hasta un minuto (lo genera la IA local en tu equipo).</span>
            </div>
          )}

          {data && (
            <>
              {/* Métricas globales */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Tile label="Tendencia" value={trend.label} Icon={trend.Icon} color={trend.color} />
                <Tile label="P&L total" value={`${m.pnlPct >= 0 ? "+" : ""}${m.pnlPct}%`} Icon={TrendingUp}
                  color={m.pnl >= 0 ? "text-up" : "text-down"} />
                <Tile label="Aciertos" value={m.closedTrades ? `${m.winRate}%` : "—"} Icon={Target} />
                <Tile label="Con la IA" value={m.followedPct != null ? `${m.followedPct}%` : "—"} Icon={Sparkles} />
              </div>

              {/* Fuente */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Sparkles className="h-3.5 w-3.5 text-brand-500" />
                {data.source === "llm"
                  ? "Evaluación generada por tu coach IA local (Llama)."
                  : data.source === "empty"
                  ? "Haz alguna operación para una evaluación más completa."
                  : "Generado con la guía integrada (el modelo local se está preparando)."}
              </div>

              {/* Narrativa del coach */}
              <div className="space-y-3">
                {sections.map((s, i) => {
                  const ui = s.title ? SECTION_UI[s.title] : null;
                  return (
                    <div key={i} className="rounded-2xl border border-slate-200 p-4">
                      {s.title && (
                        <div className={`mb-2 flex items-center gap-2 text-sm font-bold ${ui.color}`}>
                          <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${ui.bg}`}>
                            <ui.Icon className="h-3.5 w-3.5" />
                          </span>
                          {s.title.charAt(0) + s.title.slice(1).toLowerCase()}
                        </div>
                      )}
                      {s.text.map((p, j) => (
                        <p key={j} className="mb-1 text-sm leading-relaxed text-slate-600">{p}</p>
                      ))}
                      {s.items.length > 0 && (
                        <ul className="space-y-1">
                          {s.items.map((it, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm text-slate-600">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" /> {it}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Detalle por movimiento */}
              {data.movements?.length > 0 && (
                <div>
                  <h3 className="card-title mb-2">Detalle por movimiento</h3>
                  <div className="space-y-1.5">
                    {data.movements.map((it, i) =>
                      it.kind === "trade" ? (
                        <TradeRow key={i} it={it} money={money} price={price} />
                      ) : (
                        <CashRow key={i} it={it} money={money} />
                      )
                    )}
                  </div>
                </div>
              )}

              <p className="flex items-start gap-2 rounded-xl bg-warn-soft p-3 text-[11px] leading-relaxed text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Evaluación educativa con dinero ficticio. No es asesoramiento financiero.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, Icon, color = "text-slate-900" }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`text-base font-bold ${color}`}>{value}</div>
    </div>
  );
}

function TradeRow({ it, money, price }) {
  const al = ALIGN_UI[it.aligned] || ALIGN_UI.neutral;
  const isBuy = it.side === "BUY";
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-2">
        <al.Icon className={`h-4 w-4 shrink-0 ${al.color}`} />
        <div>
          <div className="text-xs font-semibold text-slate-700">
            <span className={isBuy ? "text-up" : "text-down"}>{isBuy ? "Compra" : "Venta"}</span>{" "}
            {coinName(it.symbol)} <span className="num text-slate-400">@ {price(it.price)}</span>
          </div>
          <div className="text-[10px] text-slate-400">
            {new Date(it.ts * 1000).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            {it.aiSignal ? ` · IA: ${it.aiSignal}` : ""}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {it.pnl != null && (
          <span className={`num text-xs font-semibold ${it.pnl >= 0 ? "text-up" : "text-down"}`}>
            {it.pnl >= 0 ? "+" : ""}{money(it.pnl)}
          </span>
        )}
        <span className={`chip bg-white text-[10px] ${al.color}`}>{al.label}</span>
      </div>
    </div>
  );
}

function CashRow({ it, money }) {
  const dep = it.type === "deposit";
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-2">
        {dep ? <ArrowDownToLine className="h-4 w-4 text-up" /> : <ArrowUpFromLine className="h-4 w-4 text-warn" />}
        <div>
          <div className="text-xs font-semibold text-slate-700">{dep ? "Ingreso" : "Retiro"} de efectivo</div>
          <div className="text-[10px] text-slate-400">
            {new Date(it.ts * 1000).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
      <span className="num text-xs font-semibold text-slate-700">{money(it.amount)}</span>
    </div>
  );
}
