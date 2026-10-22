import { useState } from "react";
import { Wallet, RotateCcw, BarChart3, GraduationCap, Bot } from "lucide-react";
import { api, fmt, coinName } from "../api";
import { useCurrency } from "../currency";
import AssetIcon from "./AssetIcon";
import PortfolioAnalyticsModal from "./PortfolioAnalyticsModal";
import ExperienceEvaluationModal from "./ExperienceEvaluationModal";
import BotCompareModal from "./BotCompareModal";
import CollapseBtn from "./CollapseBtn";

export default function PortfolioPanel({ portfolio, trades, onChanged, onSelect, onToast, collapsed, onToggleCollapse }) {
  const { money, price } = useCurrency();
  const [tab, setTab] = useState("holdings");
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [evalOpen, setEvalOpen] = useState(false);
  const [botOpen, setBotOpen] = useState(false);
  const p = portfolio;

  const reset = async () => {
    if (!window.confirm("¿Reiniciar tu cuenta demo? Se borrarán posiciones e historial y el saldo volverá al inicial.")) return;
    try {
      await api.resetAccount();
      onToast?.("Cuenta reiniciada", "info");
      onChanged?.();
    } catch (e) {
      onToast?.(e.message, "danger");
    }
  };

  const up = (p?.totalPnl ?? 0) >= 0;

  return (
    <>
    <div className={`card flex flex-col overflow-hidden ${collapsed ? "" : "h-full"}`}>
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-bold text-slate-900">Mi cartera</h3>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button onClick={() => setBotOpen(true)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-white hover:brightness-110"
            style={{ background: "#8b5cf6" }} title="Comparar con el Agente IA">
            <Bot className="h-3.5 w-3.5" /> Agente IA
          </button>
          <button onClick={() => setEvalOpen(true)}
            className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-[11px] font-medium text-brand-700 hover:bg-brand-100"
            title="Evaluación de experiencia">
            <GraduationCap className="h-3.5 w-3.5" /> Evaluación
          </button>
          <button onClick={() => setAnalyticsOpen(true)}
            className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-[11px] font-medium text-brand-700 hover:bg-brand-100"
            title="Gráficas de la cartera">
            <BarChart3 className="h-3.5 w-3.5" /> Gráficas
          </button>
          <button onClick={reset} className="icon-btn h-7 w-7" title="Reiniciar cuenta">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <CollapseBtn collapsed={collapsed} onToggle={onToggleCollapse} />
        </div>
      </div>

      {!collapsed && (<>

      <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
        <div className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Valor total</div>
          <div className="num text-xl font-bold text-slate-900">{money(p?.equity)}</div>
        </div>
        <div className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Ganancia / Pérdida</div>
          <div className={`num text-xl font-bold ${up ? "text-up" : "text-down"}`}>
            {up ? "+" : ""}{money(p?.totalPnl)}
          </div>
          <div className={`text-[11px] font-medium ${up ? "text-up" : "text-down"}`}>{fmt.pct(p?.totalPnlPercent)}</div>
        </div>
      </div>

      <div className="flex justify-between border-b border-slate-100 px-4 py-2 text-xs">
        <span className="text-slate-400">Efectivo: <b className="num text-slate-600">{money(p?.balance)}</b></span>
        <span className="text-slate-400">En activos: <b className="num text-slate-600">{money(p?.positionsValue)}</b></span>
      </div>

      <div className="flex gap-1 p-1.5">
        <TabBtn active={tab === "holdings"} onClick={() => setTab("holdings")}>Posiciones</TabBtn>
        <TabBtn active={tab === "history"} onClick={() => setTab("history")}>Historial</TabBtn>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {tab === "holdings" && (
          <>
            {(!p?.holdings || p.holdings.length === 0) && <Empty text="Aún no tienes posiciones. ¡Haz tu primera compra!" />}
            {p?.holdings?.map((h) => {
              const gain = h.pnl >= 0;
              return (
                <button key={h.symbol} onClick={() => onSelect?.(h.symbol)}
                  className="mb-0.5 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-slate-50">
                  <AssetIcon symbol={h.symbol} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800">{coinName(h.symbol)}</div>
                    <div className="num text-[11px] text-slate-400">{fmt.qty(h.quantity)} @ {price(h.avgPrice)}</div>
                  </div>
                  <div className="text-right">
                    <div className="num text-sm font-semibold text-slate-900">{money(h.value)}</div>
                    <div className={`num text-[11px] font-semibold ${gain ? "text-up" : "text-down"}`}>
                      {gain ? "+" : ""}{money(h.pnl)} ({fmt.pct(h.pnlPercent)})
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        )}

        {tab === "history" && (
          <>
            {(!trades || trades.length === 0) && <Empty text="Sin operaciones todavía." />}
            {trades?.map((t) => (
              <div key={t.id} className="mb-0.5 flex items-center justify-between rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`chip ${t.side === "BUY" ? "bg-up-soft text-up" : "bg-down-soft text-down"}`}>
                    {t.side === "BUY" ? "COMPRA" : "VENTA"}
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-slate-700">{coinName(t.symbol)}</div>
                    <div className="num text-[10px] text-slate-400">
                      {new Date(t.ts * 1000).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-xs text-slate-600">{fmt.qty(t.quantity)} @ {price(t.price)}</div>
                  {t.side === "SELL" && (
                    <div className={`num text-[10px] ${t.pnl >= 0 ? "text-up" : "text-down"}`}>
                      {t.pnl >= 0 ? "+" : ""}{money(t.pnl)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      </>)}
    </div>
    {analyticsOpen && (
      <PortfolioAnalyticsModal portfolio={p} onClose={() => setAnalyticsOpen(false)} />
    )}
    {evalOpen && <ExperienceEvaluationModal onClose={() => setEvalOpen(false)} />}
    {botOpen && <BotCompareModal onClose={() => setBotOpen(false)} onToast={onToast} />}
    </>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
        active ? "bg-slate-100 text-slate-800" : "text-slate-400 hover:text-slate-600"
      }`}>
      {children}
    </button>
  );
}

function Empty({ text }) {
  return <div className="px-3 py-8 text-center text-xs text-slate-400">{text}</div>;
}
