import { useState } from "react";
import {
  X, ArrowRight, ArrowLeft, CandlestickChart, Sparkles, Wallet, Trophy, Bot, Search, Check,
} from "lucide-react";

const DEMO_ASSETS = [
  { s: "BTC", n: "Bitcoin", p: "72.480", c: "+3,1%", up: true },
  { s: "ETH", n: "Ethereum", p: "2.118", c: "-1,2%", up: false },
  { s: "SOL", n: "Solana", p: "92,4", c: "+5,6%", up: true },
  { s: "AAPL", n: "Apple", p: "310,1", c: "+0,8%", up: true },
  { s: "Oro", n: "Oro", p: "2.645", c: "+0,4%", up: true },
];

// Cada paso resalta una zona del panel y la explica.
const STEPS = [
  { zone: "watchlist", title: "1. Elige un activo", text: "En la lista de mercados tienes cripto, acciones, índices y materias primas con precio en vivo. Toca uno para operarlo." },
  { zone: "chart", title: "2. Mira el gráfico", text: "El gráfico de velas te muestra la evolución del precio. Cambia el intervalo (15m, 1h, 1D) según si operas a corto o largo plazo." },
  { zone: "ai", title: "3. Consulta la IA", text: "El asesor con IA te da una señal (COMPRA / VENTA), su probabilidad y en qué indicadores se basa. Es una sugerencia, nunca opera por ti." },
  { zone: "trade", title: "4. Compra o vende", text: "Indica cuánto quieres invertir y ejecuta con un clic. Con dinero ficticio: practica sin arriesgar nada." },
  { zone: "portfolio", title: "5. Sigue tu cartera", text: "Aquí ves tu saldo, tus posiciones y tu ganancia o pérdida (P&L) en tiempo real, con gráficas de tu evolución." },
  { zone: "profiles", title: "6. Cambia de cartera", text: "Tienes una cuenta libre de práctica y una cartera independiente por cada reto. Cambia entre ellas desde aquí." },
  { zone: "challenges", title: "7. Reta a tus amigos", text: "Crea grupos o retos abiertos con cuota, premio y aforo, compite en el ranking y mídete contra el robot con IA." },
];

export default function InteractiveDemo({ onClose, onStart }) {
  const [step, setStep] = useState(0);
  const active = STEPS[step].zone;
  const isLast = step === STEPS.length - 1;

  // Clases para resaltar la zona activa y atenuar el resto.
  const zoneCls = (z) =>
    `transition-all duration-300 ${active === z ? "ring-2 ring-brand-500 ring-offset-2 ring-offset-slate-50" : "opacity-45"}`;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <CandlestickChart className="h-4 w-4 text-brand-600" /> Cómo funciona el panel
          </h2>
          <button onClick={onClose} className="icon-btn h-8 w-8"><X className="h-4 w-4" /></button>
        </div>

        <div className="overflow-y-auto p-4">
          {/* Maqueta del panel con datos de ejemplo */}
          <div className="pointer-events-none select-none rounded-2xl bg-slate-50 p-3">
            {/* Barra superior */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white"><CandlestickChart className="h-4 w-4" /></div>
                <span className="text-sm font-extrabold text-slate-800">TradeLab</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 ${zoneCls("profiles")}`}>
                  <Wallet className="h-3 w-3" /> Cuenta libre ▾
                </span>
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 ${zoneCls("challenges")}`}>
                  <Trophy className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3">
              {/* Watchlist */}
              <div className={`col-span-12 rounded-xl border border-slate-200 bg-white p-2.5 sm:col-span-3 ${zoneCls("watchlist")}`}>
                <div className="mb-1.5 flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-400">
                  <Search className="h-3 w-3" /> Buscar activo…
                </div>
                <div className="space-y-1">
                  {DEMO_ASSETS.map((a) => (
                    <div key={a.s} className="flex items-center justify-between rounded-lg px-1.5 py-1">
                      <div>
                        <div className="text-[11px] font-bold text-slate-700">{a.s}</div>
                        <div className="text-[9px] text-slate-400">{a.n}</div>
                      </div>
                      <div className="text-right">
                        <div className="num text-[11px] font-semibold text-slate-700">{a.p} €</div>
                        <div className={`num text-[9px] font-bold ${a.up ? "text-up" : "text-down"}`}>{a.c}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Centro: gráfico + operar */}
              <div className="col-span-12 space-y-3 sm:col-span-6">
                <div className={`rounded-xl border border-slate-200 bg-white p-3 ${zoneCls("chart")}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800">Bitcoin <span className="text-slate-400">BTC/USDT</span></div>
                      <div className="num text-lg font-extrabold text-slate-900">72.480 €</div>
                    </div>
                    <div className="flex gap-1">
                      {["15m", "1h", "1D"].map((t, i) => (
                        <span key={t} className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${i === 1 ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"}`}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <svg viewBox="0 0 300 70" className="mt-2 w-full">
                    {[18, 30, 22, 40, 34, 52, 46, 60].map((h, i) => {
                      const up = i % 2 === 0;
                      return <rect key={i} x={10 + i * 36} y={64 - h} width="10" height={h} rx="1.5" fill={up ? "#22c55e" : "#ef4444"} opacity="0.85" />;
                    })}
                  </svg>
                </div>
                <div className={`rounded-xl border border-slate-200 bg-white p-3 ${zoneCls("trade")}`}>
                  <div className="mb-2 flex gap-1">
                    <span className="flex-1 rounded-lg bg-up-soft py-1 text-center text-[11px] font-bold text-up">Comprar</span>
                    <span className="flex-1 rounded-lg py-1 text-center text-[11px] font-semibold text-slate-400">Vender</span>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] text-slate-400">Importe a invertir (€)… <b className="text-slate-600">500 €</b></div>
                  <div className="mt-2 rounded-lg bg-up py-1.5 text-center text-[11px] font-bold text-white">Comprar Bitcoin</div>
                </div>
              </div>

              {/* Derecha: IA + cartera */}
              <div className="col-span-12 space-y-3 sm:col-span-3">
                <div className={`rounded-xl border border-slate-200 bg-white p-3 ${zoneCls("ai")}`}>
                  <div className="mb-1 flex items-center gap-1 text-[11px] font-bold text-slate-500"><Sparkles className="h-3.5 w-3.5 text-brand-500" /> IA & Asesor</div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-up-soft px-2 py-0.5 text-[11px] font-bold text-up">COMPRA</span>
                    <span className="num text-sm font-extrabold text-slate-800">72%</span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">RSI, tendencia y volumen a favor.</div>
                </div>
                <div className={`rounded-xl border border-slate-200 bg-white p-3 ${zoneCls("portfolio")}`}>
                  <div className="mb-1 flex items-center gap-1 text-[11px] font-bold text-slate-500"><Wallet className="h-3.5 w-3.5 text-brand-500" /> Mi cartera</div>
                  <div className="num text-lg font-extrabold text-slate-900">12.480 €</div>
                  <div className="num text-[11px] font-bold text-up">+24,8%</div>
                  <div className="mt-1.5 flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[10px]">
                    <Bot className="h-3 w-3 text-brand-500" /> Robot IA · 2º en el ranking
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Explicación del paso */}
          <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 p-4">
            <h3 className="text-sm font-bold text-brand-800">{STEPS[step].title}</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-brand-700">{STEPS[step].text}</p>
          </div>
        </div>

        {/* Controles */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
            className="btn-ghost !px-3 !py-2 text-xs disabled:opacity-30">
            <ArrowLeft className="h-3.5 w-3.5" /> Anterior
          </button>
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <button key={i} onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-brand-600" : "w-1.5 bg-slate-300"}`} />
            ))}
          </div>
          {isLast ? (
            <button onClick={onStart} className="btn-primary !px-4 !py-2 text-xs">
              <Check className="h-3.5 w-3.5" /> Empezar gratis
            </button>
          ) : (
            <button onClick={() => setStep((s) => s + 1)} className="btn-primary !px-4 !py-2 text-xs">
              Siguiente <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
