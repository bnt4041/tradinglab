import { useEffect, useState } from "react";
import { X, ArrowDownToLine, ArrowUpFromLine, RotateCcw } from "lucide-react";
import { api, fmt } from "../api";
import { useCurrency } from "../currency";

export default function ProfileModal({ user, portfolio, onClose, onChanged, onToast }) {
  const { money, toBase, symbol } = useCurrency();
  const [mode, setMode] = useState("deposit");
  const [amount, setAmount] = useState("");
  const [movements, setMovements] = useState([]);
  const [busy, setBusy] = useState(false);

  const loadMovements = () => api.movements().then(setMovements).catch(() => {});
  useEffect(() => { loadMovements(); /* eslint-disable-next-line */ }, [user?.id]);

  const submit = async () => {
    const val = Number(amount);
    if (!val || val <= 0) return onToast?.("Introduce un importe válido", "danger");
    setBusy(true);
    try {
      if (mode === "deposit") { await api.deposit(toBase(val)); onToast?.(`Has ingresado ${money(toBase(val))}`, "success"); }
      else { await api.withdraw(toBase(val)); onToast?.(`Has retirado ${money(toBase(val))}`, "info"); }
      setAmount(""); onChanged?.(); loadMovements();
    } catch (e) { onToast?.(e.message, "danger"); } finally { setBusy(false); }
  };

  const reset = async () => {
    if (!window.confirm("¿Reiniciar esta cuenta demo? Se borrarán posiciones e historial y el saldo volverá al inicial.")) return;
    try { await api.resetAccount(); onToast?.("Cuenta reiniciada", "info"); onChanged?.(); loadMovements(); }
    catch (e) { onToast?.(e.message, "danger"); }
  };

  const up = (portfolio?.totalPnl ?? 0) >= 0;

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg animate-fade-in overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
              style={{ backgroundColor: user?.color }}>
              {(user?.name || "?").charAt(0).toUpperCase()}
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{user?.name}</h2>
              <span className="text-xs text-slate-400">Tu perfil de práctica</span>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn h-8 w-8"><X className="h-4 w-4" /></button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3">
            <Box label="Valor total (equity)" value={money(portfolio?.equity)} big />
            <Box label="Ganancia / Pérdida"
              value={`${up ? "+" : ""}${money(portfolio?.totalPnl)} (${fmt.pct(portfolio?.totalPnlPercent)})`}
              color={up ? "text-up" : "text-down"} big />
            <Box label="Efectivo disponible" value={money(portfolio?.balance)} />
            <Box label="Aportado neto" value={money(portfolio?.netContributions)} />
          </div>

          <p className="mt-2 text-[11px] text-slate-400">
            El P&L se calcula frente a lo que has <b>aportado neto</b> (ingresos − retiros), así que ingresar o
            retirar no falsea tus resultados.
          </p>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="card-title mb-3">Ajustar cartera</h3>
            <div className="mb-3 flex gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200">
              <button onClick={() => setMode("deposit")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold ${
                  mode === "deposit" ? "bg-up-soft text-up" : "text-slate-500"
                }`}>
                <ArrowDownToLine className="h-4 w-4" /> Ingresar fondos
              </button>
              <button onClick={() => setMode("withdraw")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold ${
                  mode === "withdraw" ? "bg-warn-soft text-warn" : "text-slate-500"
                }`}>
                <ArrowUpFromLine className="h-4 w-4" /> Retirar fondos
              </button>
            </div>
            <div className="flex gap-2">
              <input className="input num" type="number" min="0" step="any"
                placeholder={`Importe en ${symbol}`} value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()} />
              <button onClick={submit} disabled={busy} className="btn-primary whitespace-nowrap">
                {busy ? "…" : mode === "deposit" ? "Ingresar" : "Retirar"}
              </button>
            </div>
            <div className="mt-2 flex gap-1.5">
              {[1000, 5000, 10000].map((v) => (
                <button key={v} onClick={() => setAmount(String(v))}
                  className="rounded-lg bg-white px-2.5 py-1 text-[11px] text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100">
                  {symbol}{fmt.compact(v)}
                </button>
              ))}
            </div>
          </div>

          {movements.length > 0 && (
            <div className="mt-5">
              <h3 className="card-title mb-2">Movimientos de efectivo</h3>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {movements.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <span className={`flex items-center gap-1 ${m.type === "deposit" ? "text-up" : "text-warn"}`}>
                      {m.type === "deposit" ? <ArrowDownToLine className="h-3.5 w-3.5" /> : <ArrowUpFromLine className="h-3.5 w-3.5" />}
                      {m.type === "deposit" ? "Ingreso" : "Retiro"}
                    </span>
                    <span className="num text-slate-700">{money(m.amount)}</span>
                    <span className="num text-[10px] text-slate-400">{new Date(m.ts * 1000).toLocaleDateString("es-ES")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button onClick={reset} className="btn-ghost flex-1 text-xs">
              <RotateCcw className="h-4 w-4" /> Reiniciar cuenta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Box({ label, value, color = "text-slate-900", big }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`num font-bold ${big ? "text-lg" : "text-sm"} ${color}`}>{value}</div>
    </div>
  );
}
