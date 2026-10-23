import { useEffect, useState } from "react";
import { CandlestickChart, Mail, Lock, User, LogIn, UserPlus, KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";
import { api } from "../api";

function tokenFromUrl() {
  return new URLSearchParams(window.location.search).get("resetToken") || "";
}

export default function AuthScreen({ onAuthenticated, onToast, initialMode = "login", onBack }) {
  const [mode, setMode] = useState(() => (tokenFromUrl() ? "reset" : initialMode)); // login | register | forgot | reset
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState("");
  const [resetDone, setResetDone] = useState(false);

  // Quita el token de la URL en cuanto lo leemos, para que no quede
  // pegado en el historial del navegador ni se comparta sin querer.
  useEffect(() => {
    if (resetToken) {
      const url = new URL(window.location.href);
      url.searchParams.delete("resetToken");
      window.history.replaceState({}, "", url);
    }
  }, [resetToken]);

  const submitNewPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) return onToast?.("La contraseña debe tener al menos 6 caracteres", "danger");
    setBusy(true);
    try {
      await api.resetPassword(resetToken, newPassword);
      setResetDone(true);
    } catch (err) {
      onToast?.(err.message, "danger");
    } finally {
      setBusy(false);
    }
  };

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

  if (mode === "reset") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lift">
              <KeyRound className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">Elige una nueva contraseña</h1>
          </div>
          <div className="card p-5">
            {resetDone ? (
              <div className="space-y-3 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-up" />
                <p className="text-sm text-slate-600">Contraseña actualizada. Ya puedes entrar con ella.</p>
                <button onClick={() => setMode("login")} className="btn-primary w-full !py-2.5">Ir a entrar</button>
              </div>
            ) : (
              <form onSubmit={submitNewPassword} className="space-y-3">
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    autoFocus className="input pl-9" type="password" autoComplete="new-password"
                    placeholder="Nueva contraseña (mín. 6 caracteres)"
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <button type="submit" disabled={busy} className="btn-primary w-full !py-2.5">
                  {busy ? "Un momento…" : "Guardar contraseña"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

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
                Si ese email tiene una cuenta, te hemos mandado un enlace para elegir una contraseña nueva.
                Revisa tu bandeja de entrada (y spam) — caduca en 1 hora.
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

          <div className="my-3 flex items-center gap-3 text-[11px] text-slate-400">
            <div className="h-px flex-1 bg-slate-200" /> o <div className="h-px flex-1 bg-slate-200" />
          </div>
          <a href="/api/auth/google/login"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.52 12.27c0-.82-.07-1.6-.21-2.36H12v4.46h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.73Z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z" />
              <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.29a12 12 0 0 0 0 10.75l3.98-3.09Z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
            </svg>
            Continuar con Google
          </a>

          {mode === "login" && (
            <button
              onClick={() => setMode("forgot")}
              className="mt-3 w-full text-center text-xs font-medium text-slate-400 hover:text-slate-600"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </div>

        {onBack && (
          <button onClick={onBack} className="mt-4 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al inicio
          </button>
        )}

        <p className="mt-4 text-center text-[11px] text-slate-400">
          Dinero ficticio, datos de mercado reales. No es asesoramiento financiero.
        </p>
      </div>
    </div>
  );
}
