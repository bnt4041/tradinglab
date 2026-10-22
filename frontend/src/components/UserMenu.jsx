import { useEffect, useRef, useState } from "react";
import { ChevronDown, UserCog, Settings, LogOut } from "lucide-react";

function Avatar({ user, size = 36 }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, backgroundColor: user?.color || "#6366f1", fontSize: size * 0.42 }}
    >
      {(user?.name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

export default function UserMenu({ currentUser, onOpenProfile, onOpenSettings, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="icon-btn flex items-center gap-2 py-1.5 pl-1.5 pr-2.5">
        <Avatar user={currentUser} size={30} />
        <span className="hidden text-sm font-semibold text-slate-700 sm:block">{currentUser?.name || "Cuenta"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 animate-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar user={currentUser} size={44} />
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-900">{currentUser?.name}</div>
                <div className="text-[11px] text-slate-400">Tu cuenta</div>
              </div>
            </div>
            <button onClick={() => { onOpenProfile(); setOpen(false); }} className="btn-primary mt-3 w-full !py-2 text-xs">
              <UserCog className="h-4 w-4" /> Mi perfil · ajustar cartera
            </button>
            <button
              onClick={() => { onOpenSettings?.(); setOpen(false); }}
              className="mt-2 flex w-full items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
              <Settings className="h-4 w-4" /> Ajustes de IA
            </button>
          </div>
          <div className="p-2">
            <button
              onClick={() => { setOpen(false); onLogout?.(); }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-down hover:bg-down-soft"
            >
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
