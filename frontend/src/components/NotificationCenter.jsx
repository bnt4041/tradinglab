import { useEffect, useRef, useState } from "react";
import { Bell, CheckCircle2, AlertTriangle, XCircle, Info, Sparkles } from "lucide-react";

const TYPE = {
  success: { Icon: CheckCircle2, color: "text-up" },
  warning: { Icon: AlertTriangle, color: "text-warn" },
  danger: { Icon: XCircle, color: "text-down" },
  signal: { Icon: Sparkles, color: "text-brand-600" },
  info: { Icon: Info, color: "text-slate-500" },
};

export default function NotificationCenter({ items, unread, onOpen, onClear }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) onOpen?.();
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="icon-btn relative h-10 w-10" title="Notificaciones">
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-down px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 animate-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-bold text-slate-900">Notificaciones</span>
            <button onClick={onClear} className="text-[11px] text-slate-400 hover:text-slate-700">Limpiar</button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {(!items || items.length === 0) && (
              <div className="px-4 py-8 text-center text-xs text-slate-400">No hay notificaciones todavía.</div>
            )}
            {items?.map((n) => {
              const s = TYPE[n.type] || TYPE.info;
              return (
                <div key={n.id} className={`flex gap-3 border-b border-slate-50 px-4 py-3 ${n.read ? "opacity-60" : "bg-brand-50/40"}`}>
                  <s.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.color}`} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-semibold ${s.color}`}>{n.title}</div>
                    <div className="text-xs text-slate-600">{n.message}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      {new Date(n.created_at * 1000).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
