import { useEffect, useState } from "react";
import { X, Trash2, Sparkles, CheckCircle2, AlertTriangle, Minus, Zap, ShoppingCart } from "lucide-react";
import { api, fmt, coinName } from "../api";
import { useCurrency } from "../currency";
import AssetIcon from "./AssetIcon";

const BIAS_UI = {
  alcista: { color: "text-up", bg: "bg-up-soft" },
  bajista: { color: "text-down", bg: "bg-down-soft" },
  neutral: { color: "text-slate-600", bg: "bg-slate-100" },
};
const ALIGN_UI = {
  "a favor": { Icon: CheckCircle2, color: "text-up", label: "a favor" },
  "en contra": { Icon: AlertTriangle, color: "text-down", label: "en contra" },
  neutral: { Icon: Minus, color: "text-slate-400", label: "neutral" },
};

function toPayload(items) {
  return items.map((it) =>
    it.side === "BUY"
      ? { symbol: it.symbol, side: "BUY", quoteAmount: it.quoteAmount }
      : { symbol: it.symbol, side: "SELL", quantity: it.quantity }
  );
}

const FEE = 0.001;

export default function BasketModal({ items, balance, onRemove, onClear, onExecuted, onClose, onToast }) {
  const { money } = useCurrency();
  const [advice, setAdvice] = useState(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Resumen de saldo: las ventas generan crédito para las compras de la cesta
  let sellCredit = 0, buyCost = 0;
  (advice?.items || []).forEach((i) => {
    if (i.side === "SELL") sellCredit += (i.notional || 0) * (1 - FEE);
    else buyCost += (i.notional || 0) * (1 + FEE);
  });
  const projected = (balance || 0) + sellCredit - buyCost;
  const shortfall = projected < -1e-6;

  useEffect(() => {
    if (items.length === 0) { setAdvice(null); return; }
    setLoadingAdvice(true);
    api.basketAdvice(toPayload(items))
      .then(setAdvice)
      .catch(() => setAdvice(null))
      .finally(() => setLoadingAdvice(false));
  }, [items]);

  const execute = async () => {
    if (items.length === 0) return;
    setExecuting(true);
    try {
      const res = await api.basketExecute(toPayload(items));
      const fails = res.results.filter((r) => !r.ok);
      if (fails.length === 0) onToast?.(`Cesta ejecutada: ${res.executed} órdenes`, "success");
      else onToast?.(`${res.executed}/${res.total} ejecutadas. Fallaron: ${fails.map((f) => f.symbol).join(", ")}`, "warning");
      onExecuted?.();
      onClear();
      onClose();
    } catch (e) {
      onToast?.(e.message, "danger");
    } finally {
      setExecuting(false);
    }
  };

  const bias = advice ? BIAS_UI[advice.overall.bias] || BIAS_UI.neutral : BIAS_UI.neutral;
  const itemAdvice = (sym, side) =>
    advice?.items?.find((i) => i.symbol === sym && i.side === side);

  return (
    <div className="fixed inset-0 z-[66] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <ShoppingCart className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Cesta de órdenes</h2>
              <span className="text-[11px] text-slate-400">Prepara varias compras y ventas y ejecútalas juntas</span>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn h-8 w-8"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              Tu cesta está vacía. Añade órdenes desde el panel de compra/venta con «Añadir a la cesta».
            </div>
          ) : (
            <>
              {/* Items */}
              <div className="space-y-1.5">
                {items.map((it) => {
                  const ia = itemAdvice(it.symbol, it.side);
                  const al = ia ? ALIGN_UI[ia.aligned] || ALIGN_UI.neutral : null;
                  return (
                    <div key={it.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                      <AssetIcon symbol={it.symbol} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-800">
                          <span className={it.side === "BUY" ? "text-up" : "text-down"}>
                            {it.side === "BUY" ? "Comprar" : "Vender"}
                          </span>{" "}
                          {coinName(it.symbol)}
                        </div>
                        <div className="num text-[11px] text-slate-400">
                          {it.side === "BUY" ? money(it.quoteAmount) : `${fmt.qty(it.quantity)} ${coinName(it.symbol)}`}
                        </div>
                      </div>
                      {al && (
                        <span className={`chip bg-white text-[10px] ${al.color}`}>
                          <al.Icon className="h-3 w-3" /> {al.label}
                        </span>
                      )}
                      <button onClick={() => onRemove(it.id)} className="text-slate-300 hover:text-down">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Resumen de saldo con crédito por ventas */}
              {advice && (sellCredit > 0 || buyCost > 0) && (
                <div className="rounded-2xl border border-slate-200 p-3 text-xs">
                  <div className="mb-1.5 flex justify-between">
                    <span className="text-slate-500">Efectivo disponible</span>
                    <span className="num text-slate-700">{money(balance)}</span>
                  </div>
                  {sellCredit > 0 && (
                    <div className="mb-1.5 flex justify-between">
                      <span className="text-up">+ Crédito por ventas de la cesta</span>
                      <span className="num text-up">+{money(sellCredit)}</span>
                    </div>
                  )}
                  {buyCost > 0 && (
                    <div className="mb-1.5 flex justify-between">
                      <span className="text-slate-500">− Coste de las compras</span>
                      <span className="num text-slate-700">−{money(buyCost)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-100 pt-1.5 font-semibold">
                    <span className="text-slate-600">Saldo tras la cesta</span>
                    <span className={`num ${shortfall ? "text-down" : "text-slate-900"}`}>{money(projected)}</span>
                  </div>
                  <p className={`mt-1.5 text-[11px] ${shortfall ? "text-down" : "text-slate-400"}`}>
                    {shortfall
                      ? "Te faltaría saldo: reduce compras o añade ventas a la cesta."
                      : "Las ventas de la cesta generan crédito para financiar sus compras (se ejecutan primero)."}
                  </p>
                </div>
              )}

              {/* Consejo combinado del conjunto */}
              <div className={`rounded-2xl p-4 ${bias.bg}`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <Sparkles className="h-3.5 w-3.5 text-brand-600" /> Consejo combinado de la cesta
                  </span>
                  {advice && <span className={`text-sm font-bold ${bias.color}`}>{advice.overall.verdict}</span>}
                </div>
                {loadingAdvice ? (
                  <p className="text-xs text-slate-500">Analizando el conjunto…</p>
                ) : advice ? (
                  <>
                    <div className="mb-2 h-2 overflow-hidden rounded-full bg-black/5">
                      <div className={`h-full rounded-full ${bias.color.replace("text-", "bg-")}`} style={{ width: `${advice.overall.score}%` }} />
                    </div>
                    <p className="text-xs text-slate-600">{advice.overall.explanation}</p>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">No se pudo calcular el consejo.</p>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={onClear} className="btn-ghost flex-1">
                  <Trash2 className="h-4 w-4" /> Vaciar
                </button>
                <button onClick={execute} disabled={executing} className="btn-primary flex-[2]">
                  <Zap className="h-4 w-4" /> {executing ? "Ejecutando…" : `Ejecutar cesta (${items.length})`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
