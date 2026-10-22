import { useEffect, useRef, useState } from "react";
import { ChevronDown, UserCog, UserPlus, Check, Settings } from "lucide-react";

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

export default function UserMenu({ users, currentUser, onSwitch, onCreate, onOpenProfile, onOpenSettings }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setCreating(false); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const submitCreate = async () => {
    if (!name.trim()) return;
    await onCreate(name.trim());
    setName(""); setCreating(false); setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="icon-btn flex items-center gap-2 py-1.5 pl-1.5 pr-2.5">
        <Avatar user={currentUser} size={30} />
        <span className="hidden text-sm font-semibold text-slate-700 sm:block">{currentUser?.name || "Perfil"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 animate-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar user={currentUser} size={44} />
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-900">{currentUser?.name}</div>
                <div className="text-[11px] text-slate-400">Perfil activo</div>
              </div>
            </div>
            <button onClick={() => { onOpenProfile(); setOpen(false); }} className="btn-primary mt-3 w-full !py-2 text-xs">
              <UserCog className="h-4 w-4" /> Mi perfil · ajustar cartera
            </button>
            <button
              onClick={() => { onOpenSettings?.(); setOpen(false); }}
              className="mt-2 flex w-full items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
              <Settings className="h-4 w-4" /> Ajustes de IA (local u OpenRouter)
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto p-2">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-400">Cambiar de perfil</div>
            {users.map((u) => (
              <button key={u.id} onClick={() => { onSwitch(u.id); setOpen(false); }}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50 ${
                  u.id === currentUser?.id ? "bg-slate-50" : ""
                }`}>
                <Avatar user={u} size={30} />
                <span className="flex-1 truncate text-sm text-slate-700">{u.name}</span>
                {u.id === currentUser?.id && <Check className="h-4 w-4 text-up" />}
              </button>
            ))}
          </div>

          <div className="border-t border-slate-100 p-2">
            {creating ? (
              <div className="flex gap-2 p-1">
                <input autoFocus className="input !py-2 text-sm" placeholder="Nombre del perfil"
                  value={name} maxLength={24}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitCreate()} />
                <button onClick={submitCreate} className="btn-primary !px-3 !py-2 text-xs">Crear</button>
              </div>
            ) : (
              <button onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <UserPlus className="h-4 w-4" />
                </span>
                Crear nuevo perfil
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
