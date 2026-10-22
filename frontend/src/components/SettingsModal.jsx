import { useEffect, useState } from "react";
import {
  X, Cpu, Cloud, Check, RefreshCw, KeyRound, ExternalLink, Zap, CheckCircle2, XCircle, ScrollText,
} from "lucide-react";
import { api } from "../api";

const KIND_LABEL = { chat: "Asistente", coach: "Coach", test: "Prueba", basket: "Cesta" };

export default function SettingsModal({ onClose, onSaved, onToast }) {
  const [provider, setProvider] = useState("local");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [models, setModels] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [log, setLog] = useState([]);

  useEffect(() => {
    api.settings().then((s) => {
      setProvider(s.aiProvider);
      setModel(s.openrouterModel || "");
      setHasKey(s.hasOpenrouterKey);
    }).catch(() => {});
    loadModels();
    loadLog();
  }, []);

  const loadModels = () => {
    setModels(null);
    api.openrouterModels().then(setModels).catch(() => setModels([]));
  };
  const loadLog = () => api.aiLog().then(setLog).catch(() => {});

  // Estadísticas de latencia/errores por proveedor (desde el log)
  const stats = {};
  log.forEach((e) => {
    const p = e.provider;
    stats[p] = stats[p] || { n: 0, okN: 0, sum: 0, errors: 0 };
    stats[p].n += 1;
    if (e.ok) { stats[p].okN += 1; stats[p].sum += e.latency_ms || 0; }
    else stats[p].errors += 1;
  });
  const slowOpenrouter = stats.openrouter && stats.openrouter.okN > 0 && stats.openrouter.sum / stats.openrouter.okN > 4000;

  const validate = () => {
    if (provider === "openrouter") {
      if (!hasKey && !apiKey.trim()) { onToast?.("Pega tu clave de OpenRouter para usarlo", "danger"); return false; }
      if (!model) { onToast?.("Elige un modelo de OpenRouter", "danger"); return false; }
    }
    return true;
  };

  const persist = async () => {
    const payload = { aiProvider: provider, openrouterModel: model };
    if (apiKey.trim()) payload.openrouterKey = apiKey.trim();
    await api.updateSettings(payload);
    setHasKey(hasKey || !!apiKey.trim());
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await persist();
      onToast?.(provider === "local" ? "IA local activada" : "OpenRouter activado", "success");
      onSaved?.();
      onClose();
    } catch (e) {
      onToast?.(e.message, "danger");
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    if (!validate()) return;
    setTesting(true);
    setTestResult(null);
    try {
      await persist();
      const res = await api.aiTest();
      setTestResult(res);
      loadLog();
    } catch (e) {
      setTestResult({ ok: false, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[66] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold text-slate-900">Ajustes · Inteligencia artificial</h2>
          <button onClick={onClose} className="icon-btn h-8 w-8"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <p className="text-xs text-slate-500">
            Elige qué IA usa el asistente y el coach. (El análisis técnico y el asesor funcionan igual con cualquiera.)
          </p>

          <div className="grid grid-cols-2 gap-3">
            <ProviderCard active={provider === "local"} onClick={() => setProvider("local")}
              Icon={Cpu} title="IA local (Llama)" desc="Privada y gratis, en tu equipo. Sin claves." />
            <ProviderCard active={provider === "openrouter"} onClick={() => setProvider("openrouter")}
              Icon={Cloud} title="OpenRouter" desc="Modelos en la nube. Requiere tu clave." />
          </div>

          {provider === "openrouter" && (
            <div className="animate-fade-in space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <KeyRound className="h-3.5 w-3.5" /> Clave de OpenRouter
                  {hasKey && <span className="text-up">· guardada ✓</span>}
                </label>
                <input className="input" type="password" autoComplete="off"
                  placeholder={hasKey ? "•••••••• (deja vacío para mantener la actual)" : "sk-or-v1-…"}
                  value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer"
                   className="mt-1 inline-flex items-center gap-1 text-[11px] text-brand-600 hover:underline">
                  Consigue tu clave gratis en openrouter.ai <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-600">Modelo gratuito</label>
                  <button onClick={loadModels} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700">
                    <RefreshCw className="h-3 w-3" /> Actualizar
                  </button>
                </div>
                {models === null ? (
                  <div className="py-2 text-xs text-slate-400">Cargando modelos gratuitos…</div>
                ) : models.length === 0 ? (
                  <div className="py-2 text-xs text-down">No se pudo cargar la lista de modelos.</div>
                ) : (
                  <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
                    <option value="">— Elige un modelo —</option>
                    {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}
                {models && <p className="mt-1 text-[11px] text-slate-400">{models.length} modelos gratuitos disponibles ahora mismo.</p>}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={runTest} disabled={testing} className="btn-ghost flex-1">
              <Zap className="h-4 w-4" /> {testing ? "Probando…" : "Probar IA"}
            </button>
            <button onClick={save} disabled={saving} className="btn-primary flex-[2]">
              {saving ? "Guardando…" : "Guardar ajustes"}
            </button>
          </div>

          {/* Resultado del test */}
          {testResult && (
            <div className={`flex items-start gap-2 rounded-xl p-3 text-xs ${testResult.ok ? "bg-up-soft text-up" : "bg-down-soft text-down"}`}>
              {testResult.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <div>
                {testResult.ok ? (
                  <>
                    <b>¡Funciona!</b> Respuesta en {testResult.latencyMs} ms
                    {testResult.model ? ` · ${String(testResult.model).split("/").pop()}` : ""}.
                    {testResult.reply ? <span className="text-slate-500"> Respuesta: “{testResult.reply}”.</span> : ""}
                  </>
                ) : (
                  <><b>No responde.</b> {testResult.error || "Error desconocido."}</>
                )}
              </div>
            </div>
          )}

          {/* Registro de uso */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 card-title"><ScrollText className="h-3.5 w-3.5" /> Registro de uso</span>
              <button onClick={loadLog} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700">
                <RefreshCw className="h-3 w-3" /> Actualizar
              </button>
            </div>
            {Object.keys(stats).length > 0 && (
              <div className="mb-2 space-y-1">
                {Object.entries(stats).map(([p, st]) => (
                  <div key={p} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-[11px]">
                    <span className="flex items-center gap-1 font-medium text-slate-600">
                      {p === "openrouter" ? <Cloud className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
                      {p === "openrouter" ? "OpenRouter" : "Local"}
                    </span>
                    <span className="text-slate-400">
                      media <b className="num text-slate-600">{st.okN ? (st.sum / st.okN / 1000).toFixed(1) : "—"} s</b>
                      {st.errors > 0 && <span className="text-down"> · {st.errors} error{st.errors > 1 ? "es" : ""}</span>}
                    </span>
                  </div>
                ))}
                {slowOpenrouter && (
                  <p className="text-[11px] text-slate-400">
                    💡 Los modelos gratuitos de OpenRouter comparten cola y pueden ir lentos. Prueba otro modelo gratuito o la IA local (suele ser más constante).
                  </p>
                )}
              </div>
            )}
            {log.length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
                Sin actividad todavía. Usa el asistente, el coach o pulsa «Probar IA».
              </div>
            ) : (
              <div className="max-h-44 space-y-1 overflow-y-auto">
                {log.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px]">
                    {e.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-up" /> : <XCircle className="h-3.5 w-3.5 shrink-0 text-down" />}
                    <span className="w-16 shrink-0 font-semibold text-slate-600">{KIND_LABEL[e.kind] || e.kind}</span>
                    <span className="flex items-center gap-1 text-slate-400">
                      {e.provider === "openrouter" ? <Cloud className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
                      {e.provider === "openrouter" ? "OpenRouter" : "Local"}
                    </span>
                    <span className="num ml-auto text-slate-400">{e.latency_ms} ms</span>
                    <span className="num w-20 shrink-0 text-right text-slate-400">
                      {new Date(e.ts * 1000).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProviderCard({ active, onClick, Icon, title, desc }) {
  return (
    <button onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200" : "border-slate-200 hover:bg-slate-50"
      }`}>
      <div className="mb-1.5 flex items-center justify-between">
        <Icon className={`h-5 w-5 ${active ? "text-brand-600" : "text-slate-400"}`} />
        {active && <Check className="h-4 w-4 text-brand-600" />}
      </div>
      <div className="text-sm font-bold text-slate-800">{title}</div>
      <div className="text-[11px] leading-snug text-slate-500">{desc}</div>
    </button>
  );
}
