import { useCallback, useState } from "react";

// Estado de plegado por card, persistido en localStorage.
export function useCollapse(key) {
  const storageKey = `tradelab_collapse_${key}`;
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch (_) {
      return false;
    }
  });
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch (_) {}
      return next;
    });
  }, [storageKey]);
  return [collapsed, toggle];
}
