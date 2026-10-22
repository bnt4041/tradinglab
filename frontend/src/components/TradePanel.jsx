import { useState } from "react";
import { TrendingUp, TrendingDown, Lightbulb, Sparkles, CheckCircle2, AlertTriangle, Minus, Plus } from "lucide-react";
import { api, fmt, coinName } from "../api";
import { useCurrency } from "../currency";
import { CONTEXT_TIPS } from "../content";
import CollapseBtn from "./CollapseBtn";

const BIAS_UI = {
  alcista: { color: "text-up", bg: "bg-up-soft" },
  bajista: { color: "text-down", bg: "bg-down-soft" },
  neutral: { color: "text-slate-600", bg: "bg-slate-100" },
};

function AdviceBlock({ advisor, isBuy }) {
  const comb = advisor.combined;
  const bias = comb.bias; // alcista | bajista | neutral
  const ui = BIAS_UI[bias] || BIAS_UI.neutral;
  const action = isBuy ? "comprar" : "vender";
  // ¿La operación va a favor del sesgo de la IA?
  const favorableBias = isBuy ? "alcista" : "bajista";
  const againstBias = isBuy ? "bajista" : "alcista";
  let verdict, Icon, vColor;
  if (bias === favorableBias) {
    verdict = isBuy
      ? "A favor: la IA ve sesgo alcista y quieres comprar."
      : "A favor: la IA ve sesgo bajista y quieres vender.";
    Icon = CheckCircle2; vColor = "text-up";
  } else if (bias === againstBias) {
    verdict = `En contra: la IA ve sesgo ${bias}; ${action} ahora va en sentido opuesto.`;
    Icon = AlertTriangle; vColor = "text-down";
  } else {
    verdict = "La IA está neutral: sin ventaja clara.";
    Icon = Minus; vColor = "text-slate-500";
  }

  return (
    <div className={`rounded-xl p-3 ${ui.bg}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-brand-600" /> Consejo combinado IA
        </span>
        <span className={`text-xs font-bold ${ui.color}`}>{comb.verdict}</span>
      </div>
      <p className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-600">
        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${vColor}`} />
        <span><b className={vColor}>{verdict}</b> {comb.explanation}</span>
      </p>
    </div>
  );
}

export default function TradePanel({ symbol, price, balance, holdingQty, advisor, basketSellCredit = 0, basketAvailable = 0, onTraded, onToast, onAddToBasket, collapsed, onToggleCollapse }) {
  const { price: fmtPrice, money, toBase, rate, symbol: curSymbol } = useCurrency();
  const [side, setSide] = useState("BUY");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const isBuy = side === "BUY";
  const amountUSDT = isBuy ? toBase(amount) : 0;
  const estQty = isBuy && price ? amountUSDT / price : 0;
  const estValueUSDT = !isBuy && price ? Number(amount || 0) * price : 0;

  const setPct = (pct) => {
    if (isBuy) setAmount(((balance || 0) * rate * pct).toFixed(2));
    else if (pct === 1) setAmount(String(holdingQty || 0)); // cantidad exacta, sin redondeo
    else setAmount(String(Math.floor((holdingQty || 0) * pct * 1e8) / 1e8)); // redondeo hacia abajo
  };

  const addToBasket = () => {
    const val = Number(amount);
    if (!val || val <= 0) return onToast?.("Introduce un importe válido", "danger");
    const item = isBuy
      ? { symbol, side: "BUY", quoteAmount: toBase(val) }
      : { symbol, side: "SELL", quantity: val };
    onAddToBasket?.(item);
    setAmount("");
    onToast?.(`Añadido a la cesta: ${isBuy ? "comprar" : "vender"} ${coinName(symbol)}`, "info");
  };

  const submit = async () => {
    const val = Number(amount);
    if (!val || val <= 0) return onToast?.("Introduce un importe válido", "danger");
    setBusy(true);
    try {
      const payload = isBuy
        ? { symbol, side: "BUY", quoteAmount: toBase(val) }
        : { symbol, side: "SELL", quantity: val };
      const res = await api.trade(payload);
      setAmount("");
      if (isBuy) onToast?.(`Compra ejecutada: ${fmt.qty(res.quantity)} ${coinName(symbol)}`, "success");
      else {
        const word = res.pnl >= 0 ? "ganancia" : "pérdida";
        onToast?.(`Venta ejecutada · ${word} ${money(res.pnl)}`, res.pnl >= 0 ? "success" : "warning");
      }
      onTraded?.();
    } catch (e) {
      onToast?.(e.message, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <h3 className="text-sm font-bold text-slate-900">Operar</h3>
        <CollapseBtn collapsed={collapsed} onToggle={onToggleCollapse} />
      </div>
      {!collapsed && (<>
      <div className="grid grid-cols-2 gap-1 p-1.5">
        <button
          onClick={() => { setSide("BUY"); setAmount(""); }}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition ${
            isBuy ? "bg-up-soft text-up ring-1 ring-up/20" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <TrendingUp className="h-4 w-4" /> Comprar
        </button>
        <button
          onClick={() => { setSide("SELL"); setAmount(""); }}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition ${
            !isBuy ? "bg-down-soft text-down ring-1 ring-down/20" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <TrendingDown className="h-4 w-4" /> Vender
        </button>
      </div>

      <div className="space-y-3 px-4 pb-4">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Precio actual</span>
          <span className="num font-semibold text-slate-700">{fmtPrice(price)}</span>
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-500">
            {isBuy ? `Importe a invertir (${curSymbol})` : `Cantidad a vender (${coinName(symbol)})`}
          </label>
          <input
            className="input num"
            type="number" min="0" step="any" placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {[0.25, 0.5, 0.75, 1].map((p) => (
            <button
              key={p}
              onClick={() => setPct(p)}
              className="rounded-lg bg-slate-100 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              {p === 1 ? "MÁX" : `${p * 100}%`}
            </button>
          ))}
        </div>

        <div className="rounded-xl bg-slate-50 p-3 text-xs">
          {isBuy ? (
            <>
              <Row label="Recibirás aprox." value={`${fmt.qty(estQty)} ${coinName(symbol)}`} />
              <Row label="Saldo disponible" value={money(balance)} />
              {basketSellCredit > 0 && (
                <>
                  <div className="flex justify-between py-0.5">
                    <span className="text-up">+ Crédito ventas en cesta</span>
                    <span className="num text-up">+{money(basketSellCredit)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 py-0.5 font-semibold">
                    <span className="text-slate-600">Disponible para la cesta</span>
                    <span className="num text-slate-800">{money(basketAvailable)}</span>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <Row label="Valor aprox." value={money(estValueUSDT)} />
              <Row label="Tienes" value={`${fmt.qty(holdingQty || 0)} ${coinName(symbol)}`} />
            </>
          )}
          <Row label="Comisión simulada" value="0,10%" muted />
        </div>

        {advisor && advisor.symbol === symbol && advisor.combined && (
          <AdviceBlock advisor={advisor} isBuy={isBuy} />
        )}

        <button
          onClick={submit}
          disabled={busy}
          className={`w-full rounded-xl py-3 text-sm font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50 ${
            isBuy ? "bg-up hover:brightness-110" : "bg-down hover:brightness-110"
          }`}
        >
          {busy ? "Procesando…" : isBuy ? `Comprar ${coinName(symbol)}` : `Vender ${coinName(symbol)}`}
        </button>

        <button onClick={addToBasket} className="btn-ghost w-full !py-2 text-xs">
          <Plus className="h-3.5 w-3.5" /> Añadir a la cesta
        </button>

        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
          <Lightbulb className="h-3 w-3 text-amber-500" /> {CONTEXT_TIPS.trade.replace("💡 ", "")}
        </p>
      </div>
      </>)}
    </div>
  );
}

function Row({ label, value, muted }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-slate-400">{label}</span>
      <span className={`num ${muted ? "text-slate-400" : "text-slate-700"}`}>{value}</span>
    </div>
  );
}
