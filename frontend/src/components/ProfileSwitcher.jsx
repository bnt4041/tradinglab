import { useEffect, useRef, useState } from "react";
import { ChevronDown, Wallet, Trophy, Check, Bot } from "lucide-react";

export default function ProfileSwitcher({ profiles, activeKey, onSwitch }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const active = profiles.find((p) => p.key === activeKey) || profiles[0];
  if (!active) return null;
  const Icon = active.kind === "challenge" ? Trophy : Wallet;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
          active.kind === "challenge"
            ? "border-brand-200 bg-brand-50 text-brand-700"
            : "border-slate-200 bg-slate-100 text-slate-600"
        }`}
        title="Cambiar de cartera"
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="max-w-[120px] truncate">{active.name}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 animate-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-400">Tus carteras</div>
          <div className="max-h-72 overflow-y-auto pb-1">
            {profiles.map((p) => {
              const PIcon = p.kind === "challenge" ? Trophy : Wallet;
              const isActive = p.key === activeKey;
              return (
                <button
                  key={p.key}
                  onClick={() => { onSwitch(p.key); setOpen(false); }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 ${isActive ? "bg-slate-50" : ""}`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${p.kind === "challenge" ? "bg-brand-100 text-brand-600" : "bg-slate-100 text-slate-500"}`}>
                    <PIcon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-800">{p.name}</div>
                    {p.kind === "challenge" && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        {p.finished ? "Terminado" : "Reto activo"} · {p.tradesUsed}/{p.maxTrades} mov.
                      </div>
                    )}
                    {p.kind === "free" && <div className="text-[11px] text-slate-400">Práctica sin límites</div>}
                  </div>
                  {isActive && <Check className="h-4 w-4 shrink-0 text-up" />}
                </button>
              );
            })}
          </div>
          {profiles.length === 1 && (
            <div className="flex items-center gap-1.5 border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
              <Bot className="h-3.5 w-3.5" /> Únete a un reto para tener más carteras.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
