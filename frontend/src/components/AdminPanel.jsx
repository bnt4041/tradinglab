import { useEffect, useState } from "react";
import { X, ShieldCheck, KeyRound, ShieldAlert, Bell, Mail, ChevronDown, Sparkles, Clock, LogIn } from "lucide-react";
import { api, fmt } from "../api";

const METHOD_LABEL = { password: "Contraseña", google: "Google", register: "Registro" };
const AI_KIND_LABEL = { chat: "Asistente", coach: "Coach", test: "Prueba", basket: "Cesta" };
const fmtDateTime = (ts) =>
  ts ? new Date(ts * 1000).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export default function AdminPanel({ currentUserId, onClose, onToast }) {
  const [users, setUsers] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [resetTarget, setResetTarget] = useState(null); // {id, name}
  const [newPassword, setNewPassword] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);
  const [expanded, setExpanded] = useState(null);     // id del usuario desplegado
  const [activity, setActivity] = useState({});       // {userId: datos}

  const load = () => api.adminUsers().then(setUsers).catch((e) => onToast?.(e.message, "danger"));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const toggleActivity = async (u) => {
    if (expanded === u.id) { setExpanded(null); return; }
    setExpanded(u.id);
    if (!activity[u.id]) {
      try {
        const d = await api.adminUserActivity(u.id);
        setActivity((a) => ({ ...a, [u.id]: d }));
      } catch (e) { onToast?.(e.message, "danger"); }
    }
  };

  const testEmail = async () => {
    setTestingEmail(true);
    try {
      await api.adminTestEmail();
      onToast?.("Correo de prueba enviado a tu email", "success");
    } catch (e) { onToast?.(e.message, "danger"); } finally { setTestingEmail(false); }
  };

  const toggleAdmin = async (u) => {
    setBusyId(u.id);
    try {
      await api.adminSetAdmin(u.id, !u.isAdmin);
      onToast?.(`${u.name} ${!u.isAdmin ? "ahora es admin" : "ya no es admin"}`, "success");
      load();
    } catch (e) { onToast?.(e.message, "danger"); } finally { setBusyId(null); }
  };

  const openReset = (u) => { setResetTarget(u); setNewPassword(""); };

  const submitReset = async () => {
    if (newPassword.length < 6) return onToast?.("La contraseña debe tener al menos 6 caracteres", "danger");
    setBusyId(resetTarget.id);
    try {
      await api.adminResetPassword(resetTarget.id, newPassword);
      onToast?.(`Contraseña de ${resetTarget.name} actualizada`, "success");
      setResetTarget(null);
      load();
    } catch (e) { onToast?.(e.message, "danger"); } finally { setBusyId(null); }
  };

  return (
    <div className="fixed inset-0 z-[66] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <ShieldCheck className="h-5 w-5 text-brand-600" /> Administración
          </h2>
          <button onClick={onClose} className="icon-btn h-8 w-8"><X className="h-4 w-4" /></button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
            <div>
              <div className="text-xs font-semibold text-slate-700">SMTP (recuperación de contraseña)</div>
              <div className="text-[11px] text-slate-400">info@flexometro.online · smtp.ionos.es</div>
            </div>
            <button onClick={testEmail} disabled={testingEmail}
              className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100">
              <Mail className="h-3.5 w-3.5" /> {testingEmail ? "Enviando…" : "Enviar prueba"}
            </button>
          </div>

          <h3 className="card-title mb-2">Usuarios ({users?.length ?? "…"})</h3>
          <p className="mb-3 text-xs text-slate-400">
            La configuración de IA (proveedor y claves) está en Ajustes y solo la puede cambiar un admin.
          </p>

          {users === null ? (
            <div className="py-6 text-center text-xs text-slate-400">Cargando…</div>
          ) : (
            <div className="space-y-1.5">
              {users.map((u) => (
                <div key={u.id} className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: u.color }}>
                      {u.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-slate-800">{u.name}</span>
                        {u.isAdmin && (
                          <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">ADMIN</span>
                        )}
                        {u.id === currentUserId && <span className="text-[11px] text-slate-400">(tú)</span>}
                        {u.resetRequestedAt && (
                          <span className="flex items-center gap-1 rounded-full bg-warn-soft px-1.5 py-0.5 text-[10px] font-bold text-warn">
                            <Bell className="h-3 w-3" /> pidió reset
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[11px] text-slate-400">{u.email}</div>
                    </div>
                    <div className="num shrink-0 text-right text-xs text-slate-500">
                      <div>{fmt.usd(u.balance)} USDT</div>
                      <div className="text-[10px] text-slate-400">{u.tradeCount} ops · {u.aiCalls} IA</div>
                      <div className="text-[10px] text-slate-400">último acceso: {fmtDateTime(u.lastAccess)}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      onClick={() => toggleActivity(u)}
                      className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                    >
                      <ChevronDown className={`h-3 w-3 transition ${expanded === u.id ? "rotate-180" : ""}`} /> Actividad
                    </button>
                    <button
                      onClick={() => openReset(u)}
                      disabled={busyId === u.id}
                      className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                    >
                      <KeyRound className="h-3 w-3" /> Resetear contraseña
                    </button>
                    {u.id !== currentUserId && (
                      <button
                        onClick={() => toggleAdmin(u)}
                        disabled={busyId === u.id}
                        className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                      >
                        <ShieldAlert className="h-3 w-3" /> {u.isAdmin ? "Quitar admin" : "Hacer admin"}
                      </button>
                    )}
                  </div>

                  {expanded === u.id && (
                    <ActivityDetail data={activity[u.id]} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {resetTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setResetTarget(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h3 className="mb-1 text-sm font-bold text-slate-900">Nueva contraseña para {resetTarget.name}</h3>
            <p className="mb-3 text-xs text-slate-400">Se cerrará su sesión actual; tendrá que entrar con esta contraseña.</p>
            <input
              autoFocus className="input" type="text" placeholder="Nueva contraseña (mín. 6 caracteres)"
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitReset()}
            />
            <div className="mt-3 flex gap-2">
              <button onClick={() => setResetTarget(null)} className="btn-ghost flex-1 text-xs">Cancelar</button>
              <button onClick={submitReset} disabled={busyId === resetTarget.id} className="btn-primary flex-1 text-xs">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityDetail({ data }) {
  if (!data) return <div className="mt-2 py-2 text-center text-[11px] text-slate-400">Cargando actividad…</div>;
  const ai = data.ai || {};
  const kinds = Object.entries(ai.byKind || {});
  return (
    <div className="mt-2 grid gap-3 rounded-xl border border-slate-100 bg-white p-3 sm:grid-cols-2">
      {/* Uso de la IA */}
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-brand-500" /> Uso de la IA
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <Stat label="Llamadas" value={ai.total ?? 0} />
          <Stat label="Correctas" value={`${ai.ok ?? 0}/${ai.total ?? 0}`} />
          <Stat label="Latencia media" value={ai.avgMs != null ? `${(ai.avgMs / 1000).toFixed(1)} s` : "—"} />
          <Stat label="Operaciones con IA" value={ai.aiTrades ?? 0} />
        </div>
        {kinds.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {kinds.map(([k, n]) => (
              <span key={k} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                {AI_KIND_LABEL[k] || k}: <b>{n}</b>
              </span>
            ))}
          </div>
        )}
        <div className="mt-1.5 text-[10px] text-slate-400">Último uso: {fmtDateTime(ai.lastTs)}</div>
      </div>

      {/* Accesos */}
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <Clock className="h-3.5 w-3.5 text-brand-500" /> Accesos ({data.accessTotal ?? 0})
        </div>
        {(!data.accesses || data.accesses.length === 0) ? (
          <div className="text-[11px] text-slate-400">Sin accesos registrados todavía.</div>
        ) : (
          <div className="max-h-32 space-y-1 overflow-y-auto">
            {data.accesses.map((a, i) => (
              <div key={i} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1 text-[11px]">
                <span className="flex items-center gap-1 text-slate-500">
                  <LogIn className="h-3 w-3" /> {METHOD_LABEL[a.method] || a.method}
                </span>
                <span className="num text-slate-400">{fmtDateTime(a.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1">
      <div className="text-[9px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="num font-bold text-slate-700">{value}</div>
    </div>
  );
}
