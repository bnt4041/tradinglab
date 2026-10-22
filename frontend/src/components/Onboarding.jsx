import { useState } from "react";
import { Hand, Wallet, Sparkles, GraduationCap } from "lucide-react";

const STEPS = [
  {
    Icon: Hand,
    title: "Bienvenido a TradeLab",
    text: "Un simulador de trading con precios REALES (cripto, acciones, índices y materias primas) y dinero FICTICIO. Practica sin ningún riesgo y aprende cómo funciona el mercado.",
  },
  {
    Icon: Wallet,
    title: "Tienes 10.000 USDT virtuales",
    text: "Es tu saldo de práctica. Compra y vende libremente: si te equivocas, no pasa nada. Puedes reiniciar la cuenta o ajustar fondos cuando quieras.",
  },
  {
    Icon: Sparkles,
    title: "La IA es solo una sugerencia",
    text: "Un modelo entrenado combina la señal técnica con el sentimiento del mercado y las noticias. Es una ayuda para aprender a razonar, NO un consejo de inversión.",
  },
  {
    Icon: GraduationCap,
    title: "Aprende sobre la marcha",
    text: "Pulsa 'Aprender' para tutoriales y glosario, o abre el asistente de IA (abajo a la derecha) para preguntar lo que quieras. ¡Vamos allá!",
  },
];

export default function Onboarding({ onClose }) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md animate-fade-in rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <s.Icon className="h-8 w-8" />
        </div>
        <h2 className="mb-2 text-2xl font-extrabold text-slate-900">{s.title}</h2>
        <p className="mb-6 text-sm leading-relaxed text-slate-600">{s.text}</p>

        <div className="mb-6 flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-brand-600" : "w-1.5 bg-slate-200"}`} />
          ))}
        </div>

        <div className="flex gap-2">
          {step > 0 && <button onClick={() => setStep(step - 1)} className="btn-ghost flex-1">Atrás</button>}
          <button onClick={() => (last ? onClose() : setStep(step + 1))} className="btn-primary flex-1">
            {last ? "¡Empezar a operar!" : "Siguiente"}
          </button>
        </div>
        <button onClick={onClose} className="mt-3 text-xs text-slate-400 hover:text-slate-700">Saltar introducción</button>
      </div>
    </div>
  );
}
