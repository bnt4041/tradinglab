import {
  CandlestickChart, BadgeDollarSign, LineChart, Sparkles, Trophy, Wallet,
  GraduationCap, Globe, Bot, ArrowRight, Check, ShieldCheck,
} from "lucide-react";

const FEATURES = [
  { icon: LineChart, title: "Datos de mercado reales", desc: "Cripto en vivo (Binance) y acciones, índices y materias primas (Yahoo Finance). Precios de verdad, dinero ficticio." },
  { icon: Sparkles, title: "Asistente con IA", desc: "Un asesor que combina señal técnica, miedo/codicia y titulares, y un chatbot que te explica la interfaz paso a paso." },
  { icon: Trophy, title: "Retos con tus amigos", desc: "Crea grupos o retos abiertos con cuota, premio, aforo y días límite. Ranking en vivo y la opción de que compita un robot IA." },
  { icon: Wallet, title: "Una cartera por reto", desc: "Tu cuenta libre de práctica no se toca: cada reto es una cartera aislada con su propio saldo y sus propios movimientos." },
  { icon: Globe, title: "Multi-mercado", desc: "Entrena sobre los mercados que elijas: solo cripto, solo acciones… tú decides en qué se juega cada reto." },
  { icon: GraduationCap, title: "Aprende sin riesgo", desc: "Tutoriales, glosario y consejos integrados. Equivócate todo lo que quieras: aquí es gratis." },
];

const STEPS = [
  { n: "1", title: "Crea tu cuenta", desc: "Gratis, en segundos. Empiezas con 10.000 USDT ficticios." },
  { n: "2", title: "Opera con datos reales", desc: "Compra y vende, mira la señal de la IA y tu P&L en tiempo real." },
  { n: "3", title: "Reta a tus amigos", desc: "Monta un reto, compite en el ranking y pon a prueba al robot IA." },
];

export default function Landing({ onStart }) {
  return (
    <div className="min-h-screen">
      {/* Barra superior */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lift">
            <CandlestickChart className="h-5 w-5" />
          </div>
          <span className="text-lg font-extrabold text-slate-900">TradeLab</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onStart("login")} className="btn-ghost !px-4 !py-2 text-sm">Entrar</button>
          <button onClick={() => onStart("register")} className="btn-primary !px-4 !py-2 text-sm">Crear cuenta</button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-8 pt-8 lg:grid-cols-2 lg:pt-16">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warn/20 bg-warn-soft px-3 py-1.5 text-xs font-semibold text-warn">
            <BadgeDollarSign className="h-3.5 w-3.5" /> Dinero ficticio · datos de mercado reales
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Aprende a invertir <span className="text-brand-600">sin arriesgar</span> un euro.
          </h1>
          <p className="mt-4 max-w-md text-base text-slate-500">
            Un simulador de trading con precios reales de cripto, acciones, índices y materias primas.
            Practica, compite con tus amigos en retos y mídete contra un robot con IA.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={() => onStart("register")} className="btn-primary !px-5 !py-3 text-base">
              Empezar gratis <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={() => onStart("login")} className="btn-ghost !px-5 !py-3 text-base">Ya tengo cuenta</button>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-up" /> Sin tarjeta</span>
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-up" /> 10.000 USDT de prueba</span>
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-up" /> Datos: Binance · Yahoo Finance</span>
          </div>
        </div>

        {/* Visual */}
        <div className="relative">
          <div className="card p-5 shadow-lift">
            <div className="flex items-center justify-between">
              <div>
                <div className="card-title">Valor de la cartera</div>
                <div className="num text-2xl font-extrabold text-slate-900">12.480,55 €</div>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-up-soft px-2.5 py-1 text-xs font-bold text-up">
                +24,8%
              </span>
            </div>
            <svg viewBox="0 0 320 90" className="mt-4 w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(99,102,241)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="rgb(99,102,241)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline points="0,70 40,62 80,66 120,48 160,52 200,34 240,38 280,20 320,14"
                fill="none" stroke="rgb(99,102,241)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <polygon points="0,70 40,62 80,66 120,48 160,52 200,34 240,38 280,20 320,14 320,90 0,90" fill="url(#g)" />
            </svg>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[["BTC", "+3,1%", "up"], ["ETH", "-1,2%", "down"], ["Oro", "+0,4%", "up"]].map(([s, v, d]) => (
                <div key={s} className="rounded-xl bg-slate-50 p-2.5 text-center">
                  <div className="text-[11px] font-semibold text-slate-500">{s}</div>
                  <div className={`num text-sm font-bold ${d === "up" ? "text-up" : "text-down"}`}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -bottom-4 -left-4 hidden rotate-[-4deg] items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-lift sm:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-600"><Bot className="h-4 w-4" /></span>
            <span className="text-xs font-semibold text-slate-700">Robot IA · 2º en el ranking</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="text-center text-2xl font-extrabold text-slate-900">Todo para practicar en serio</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500">
          Las herramientas de una plataforma real, sin poner dinero de verdad.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-sm font-bold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto max-w-6xl px-5 py-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{s.n}</span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{s.title}</h3>
                <p className="mt-0.5 text-[13px] text-slate-500">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="relative overflow-hidden rounded-3xl bg-brand-600 px-6 py-12 text-center shadow-lift">
          <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(600px 300px at 80% -20%, white, transparent 60%)" }} />
          <div className="relative">
            <h2 className="text-2xl font-extrabold text-white sm:text-3xl">¿Listo para tu primer trade?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/80">
              Crea tu cuenta gratis y empieza con 10.000 USDT ficticios. Sin riesgo, sin tarjeta.
            </p>
            <button onClick={() => onStart("register")} className="btn mt-6 bg-white !px-6 !py-3 text-base text-brand-700 hover:bg-slate-100">
              Crear mi cuenta <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-5 pb-10 text-center">
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          TradeLab es una herramienta educativa con dinero ficticio. No es asesoramiento financiero.
        </p>
      </footer>
    </div>
  );
}
