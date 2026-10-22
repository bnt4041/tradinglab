import { ChevronUp, ChevronDown } from "lucide-react";

export default function CollapseBtn({ collapsed, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="icon-btn h-7 w-7"
      title={collapsed ? "Ampliar" : "Reducir"}
      aria-label={collapsed ? "Ampliar" : "Reducir"}
    >
      {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
    </button>
  );
}
