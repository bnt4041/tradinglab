import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

const STYLE = {
  success: "border-up/20 bg-white text-up",
  warning: "border-warn/20 bg-white text-warn",
  danger: "border-down/20 bg-white text-down",
  info: "border-brand-200 bg-white text-brand-700",
};
const ICON = { success: CheckCircle2, warning: AlertTriangle, danger: XCircle, info: Info };

export default function Toasts({ toasts }) {
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICON[t.type] || Info;
        return (
          <div key={t.id}
            className={`pointer-events-auto flex animate-fade-in items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium text-slate-700 shadow-soft ${STYLE[t.type] || STYLE.info}`}>
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${STYLE[t.type]?.split(" ").pop() || "text-brand-700"}`} />
            <span className="text-slate-700">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
