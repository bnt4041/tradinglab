import { useEffect, useRef, useState } from "react";
import { Euro, DollarSign, PoundSterling, ChevronDown, Check } from "lucide-react";
import { CURRENCIES, useCurrency } from "../currency";

const ICONS = { USD: DollarSign, EUR: Euro, GBP: PoundSterling };

export default function CurrencySelector() {
  const { code, setCode } = useCurrency();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const Current = ICONS[code] || DollarSign;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="icon-btn flex h-10 items-center gap-1.5 px-3 text-sm font-semibold text-slate-700"
        title="Moneda de visualización">
        <Current className="h-4 w-4" />
        <span className="hidden sm:inline">{code}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-48 animate-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-400">Ver importes en</div>
          {Object.values(CURRENCIES).map((c) => {
            const Ic = ICONS[c.code] || DollarSign;
            return (
              <button key={c.code} onClick={() => { setCode(c.code); setOpen(false); }}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-slate-50 ${
                  code === c.code ? "text-slate-900" : "text-slate-600"
                }`}>
                <Ic className="h-4 w-4 text-slate-400" />
                <span className="flex-1">{c.label}</span>
                {code === c.code && <Check className="h-4 w-4 text-up" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
