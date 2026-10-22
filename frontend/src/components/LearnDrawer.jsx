import { useState } from "react";
import { GraduationCap, BookOpen, Lightbulb, ChevronDown, X } from "lucide-react";
import { TUTORIALS, GLOSSARY, TIPS } from "../content";

export default function LearnDrawer({ open, onClose }) {
  const [tab, setTab] = useState("tutoriales");
  const [openItem, setOpenItem] = useState("que-es");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md animate-fade-in flex-col border-l border-slate-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <GraduationCap className="h-5 w-5" />
            </span>
            <h2 className="text-base font-bold text-slate-900">Centro de aprendizaje</h2>
          </div>
          <button onClick={onClose} className="icon-btn h-8 w-8"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex gap-1 border-b border-slate-100 p-2">
          <Tab active={tab === "tutoriales"} onClick={() => setTab("tutoriales")}>Tutoriales</Tab>
          <Tab active={tab === "glosario"} onClick={() => setTab("glosario")}>Glosario</Tab>
          <Tab active={tab === "consejos"} onClick={() => setTab("consejos")}>Consejos</Tab>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "tutoriales" && (
            <div className="space-y-2">
              {TUTORIALS.map((t) => {
                const isOpen = openItem === t.id;
                return (
                  <div key={t.id} className="overflow-hidden rounded-xl border border-slate-200">
                    <button onClick={() => setOpenItem(isOpen ? null : t.id)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50">
                      <span className="flex items-center gap-2.5 text-sm font-semibold text-slate-800">
                        <BookOpen className="h-4 w-4 text-brand-600" /> {t.title}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="space-y-2 border-t border-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-600">
                        {t.body.map((p, i) => <p key={i}>{p}</p>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === "glosario" && (
            <div className="space-y-2">
              {GLOSSARY.map(([term, def]) => (
                <div key={term} className="rounded-xl border border-slate-200 p-3">
                  <div className="text-sm font-bold text-brand-700">{term}</div>
                  <div className="text-sm text-slate-600">{def}</div>
                </div>
              ))}
            </div>
          )}

          {tab === "consejos" && (
            <ul className="space-y-2">
              {TIPS.map((tip, i) => (
                <li key={i} className="flex gap-2.5 rounded-xl border border-slate-200 p-3 text-sm text-slate-600">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> {tip}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
        active ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100"
      }`}>
      {children}
    </button>
  );
}
