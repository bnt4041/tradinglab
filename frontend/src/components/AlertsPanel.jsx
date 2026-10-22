import { useState } from "react";
import { BellRing, ArrowUpRight, ArrowDownRight, Trash2, Check, Lightbulb } from "lucide-react";
import { api, coinName } from "../api";
import { useCurrency } from "../currency";
import { CONTEXT_TIPS } from "../content";
import CollapseBtn from "./CollapseBtn";

export default function AlertsPanel({ symbol, price, alerts, onChanged, onToast, collapsed, onToggleCollapse }) {
  const { price: fmtPrice, toBase, symbol: curSymbol } = useCurrency();
  const [direction, setDirection] = useState("above");
  const [target, setTarget] = useState("");

  const create = async () => {
    const val = Number(target);
    if (!val || val <= 0) return onToast?.("Introduce un precio objetivo válido", "danger");
    try {
      await api.createAlert({ symbol, direction, targetPrice: toBase(val) });
      setTarget("");
      onToast?.(`Alerta creada para ${coinName(symbol)}`, "success");
      onChanged?.();
    } catch (e) {
      onToast?.(e.message, "danger");
    }
  };

  const remove = async (id) => {
    try {
      await api.deleteAlert(id);
      onChanged?.();
    } catch (e) {
      onToast?.(e.message, "danger");
    }
  };

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-bold text-slate-900">Alertas de precio</h3>
        </div>
        <CollapseBtn collapsed={collapsed} onToggle={onToggleCollapse} />
      </div>

      {!collapsed && (<>
      <div className="space-y-3 p-4">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setDirection("above")}
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold transition ${
              direction === "above" ? "bg-white text-up shadow-sm" : "text-slate-500"
            }`}
          >
            <ArrowUpRight className="h-3.5 w-3.5" /> Sube por encima
          </button>
          <button
            onClick={() => setDirection("below")}
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold transition ${
              direction === "below" ? "bg-white text-down shadow-sm" : "text-slate-500"
            }`}
          >
            <ArrowDownRight className="h-3.5 w-3.5" /> Baja por debajo
          </button>
        </div>

        <div className="flex gap-2">
          <input
            className="input num"
            type="number" min="0" step="any"
            placeholder={`Precio objetivo en ${curSymbol}`}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <button onClick={create} className="btn-primary whitespace-nowrap">Crear</button>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Lightbulb className="h-3 w-3 text-amber-500" /> Precio actual:{" "}
          <b className="num text-slate-600">{fmtPrice(price)}</b>
        </p>
      </div>

      <div className="max-h-56 overflow-y-auto border-t border-slate-100 px-2 py-2">
        {(!alerts || alerts.length === 0) && (
          <div className="px-3 py-6 text-center text-xs text-slate-400">
            No tienes alertas. Crea una para que el simulador vigile por ti.
          </div>
        )}
        {alerts?.map((a) => (
          <div key={a.id} className="mb-0.5 flex items-center justify-between rounded-xl px-3 py-2 hover:bg-slate-50">
            <div className="flex items-center gap-2">
              {a.direction === "above" ? (
                <ArrowUpRight className="h-4 w-4 text-up" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-down" />
              )}
              <div>
                <div className="text-xs font-semibold text-slate-700">
                  {coinName(a.symbol)} {a.direction === "above" ? "≥" : "≤"}{" "}
                  <span className="num">{fmtPrice(a.target_price)}</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {a.active ? "Activa · vigilando" : "Disparada"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!a.active && (
                <span className="chip bg-warn-soft text-warn">
                  <Check className="h-3 w-3" />
                </span>
              )}
              <button onClick={() => remove(a.id)} className="text-slate-300 hover:text-down" title="Eliminar">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      </>)}
    </div>
  );
}
