import { useEffect, useRef, useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { api } from "../api";

const WELCOME = {
  role: "assistant",
  content:
    "¡Hola! 👋 Soy tu asistente de TradeLab. Puedo explicarte cómo usar la app (comprar, vender, alertas, cartera, perfiles, moneda) o conceptos de trading (velas, RSI, la IA y el asesor). ¿Qué quieres saber?",
};

const SUGGESTIONS = [
  "¿Cómo compro mi primera cripto?",
  "¿Qué es el RSI?",
  "¿Cómo funciona la IA?",
  "¿Qué hago en esta pantalla?",
];

const STATE_COLOR = {
  ready: "text-up",
  downloading: "text-warn",
  preparing: "text-warn",
  unavailable: "text-slate-400",
};

export default function ChatAssistant({ context }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const load = () => api.assistantStatus().then(setStatus).catch(() => {});
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await api.assistantChat(next.filter((m) => m.role !== "system"), context || {});
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "Ups, no he podido responder: " + e.message }]);
    } finally {
      setBusy(false);
    }
  };

  const badge = status
    ? { text: status.message || (status.provider === "openrouter" ? "OpenRouter" : "IA local"),
        color: STATE_COLOR[status.state] || "text-slate-400" }
    : null;

  return (
    <>
      <button onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-[55] flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-glow transition hover:scale-105 hover:bg-brand-700"
        title="Asistente IA">
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-[55] flex h-[70vh] max-h-[560px] w-[92vw] max-w-sm animate-fade-in flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Bot className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-bold text-slate-900">Asistente IA</div>
                {badge && (
                  <div className={`flex items-center gap-1 text-[11px] ${badge.color}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" /> {badge.text}
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="icon-btn h-8 w-8"><X className="h-4 w-4" /></button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50/50 p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user" ? "rounded-br-sm bg-brand-600 text-white" : "rounded-bl-sm border border-slate-200 bg-white text-slate-700"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="flex gap-1 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-2 w-2 animate-pulse-soft rounded-full bg-slate-400" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>
            )}

            {messages.length <= 1 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 p-3">
            <div className="flex gap-2">
              <input className="input !py-2.5 text-sm" placeholder="Escribe tu pregunta…"
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()} />
              <button onClick={() => send()} disabled={busy || !input.trim()} className="btn-primary !px-3.5 !py-2.5">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
