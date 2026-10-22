import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

export const CURRENCIES = {
  USD: { code: "USD", symbol: "$", label: "Dólar (USDT)" },
  EUR: { code: "EUR", symbol: "€", label: "Euro" },
  GBP: { code: "GBP", symbol: "£", label: "Libra" },
};

const LOCALE = "es-ES";
const CurrencyContext = createContext(null);

function fmtCurrency(value, code, dp) {
  if (value == null || isNaN(value)) return "—";
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: code,
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(value);
}

export function CurrencyProvider({ children }) {
  const [code, setCodeState] = useState(
    () => localStorage.getItem("tradelab_currency") || "EUR"
  );
  const [rates, setRates] = useState({ USD: 1, EUR: 0.92, GBP: 0.79 });

  useEffect(() => {
    const load = () => api.rates().then(setRates).catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  const setCode = (c) => {
    setCodeState(c);
    localStorage.setItem("tradelab_currency", c);
  };

  const rate = rates[code] ?? 1;
  const symbol = CURRENCIES[code]?.symbol || "$";

  // Importes (valores en USDT -> divisa de visualización)
  const money = (usdt, dp = 2) => fmtCurrency(usdt == null ? null : usdt * rate, code, dp);

  // Precios con decimales variables según magnitud
  const price = (usdt) => {
    if (usdt == null || isNaN(usdt)) return "—";
    const v = usdt * rate;
    const dp = v >= 1000 ? 2 : v >= 1 ? 2 : v >= 0.01 ? 4 : 6;
    return fmtCurrency(v, code, dp);
  };

  const compact = (usdt) => {
    if (usdt == null || isNaN(usdt)) return "—";
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency: code,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(usdt * rate);
  };

  // Convierte un importe introducido en la divisa de visualización a USDT (base)
  const toBase = (displayValue) => {
    const n = Number(displayValue);
    if (!n || isNaN(n)) return 0;
    return n / rate;
  };

  const value = { code, setCode, symbol, rate, rates, money, price, compact, toBase };
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency debe usarse dentro de CurrencyProvider");
  return ctx;
}
