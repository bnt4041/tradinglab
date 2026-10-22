import { useState } from "react";
import { CandlestickChart, Mail, Lock, User, LogIn, UserPlus, KeyRound, ArrowLeft } from "lucide-react";
import { api } from "../api";

export default function AuthScreen({ onAuthenticated, onToast }) {
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return onToast?.("Rellena email y contraseña", "danger");
    if (mode === "register" && !name.trim()) return onToast?.("Elige un nombre", "danger");
    setBusy(true);
    try {
      const { user } =
        mode === "register"
          ? await api.register(name.trim(), email.trim(), password)
          : await api.login(email.trim(), password);
      onAuthenticated(user);
    } catch (err) {
      onToast?.(err.message, "danger");
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async (e) => {
    e.preventDefault();
    if (!email.trim()) return onToast?.("Escribe tu email", "danger");
    setBusy(true);
    try {
      await api.requestPasswordReset(email.trim());
      setResetSent(true);
    } catch (err) {
      onToast?.(err.message, "danger");
    } finally {
      setBusy(false);
    }
  };

  if (mode === "forgot") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lift">
              <KeyRound className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">Recuperar contraseña</h1>
          </div>
          <div className="card p-5">
            {resetSent ? (
              <p className="text-sm text-slate-600">
                Si ese email tiene una cuenta, hemos avisado al administrador de que quieres restablecer tu
                contraseña. En este despliegue no hay envío de correos automático: el admin te pasará una
                contraseña nueva por otro medio.
              </p>
            ) : (
              <form onSubmit={submitForgot} className="space-y-3">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="input pl-9"
                    type="email"
                    placeholder="Tu email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button type="submit" disabled={busy} className="btn-primary w-full !py-2.5">
                  {busy ? "Un momento…" : "Avisar al administrador"}
                </button>
              </form>
            )}
            <button
              onClick={() => { setMode("login"); setResetSent(false); }}
              className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Volver a entrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lift">
            <CandlestickChart className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">TradeLab</h1>
          <p className="text-xs text-slate-400">Simulador de trading · práctica sin riesgo</p>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === "register" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-9"
                  placeholder="Tu nombre"
                  value={name}
                  maxLength={24}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                type="password"
                placeholder="Contraseña"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full !py-2.5">
              {mode === "register" ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              {busy ? "Un momento…" : mode === "register" ? "Crear cuenta" : "Entrar"}
            </button>
          </form>
          {mode === "login" && (
            <button
              onClick={() => setMode("forgot")}
              className="mt-3 w-full text-center text-xs font-medium text-slate-400 hover:text-slate-600"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-400">
          Dinero ficticio, datos de mercado reales. No es asesoramiento financiero.
        </p>
      </div>
    </div>
  );
}
