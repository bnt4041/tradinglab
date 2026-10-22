import { useEffect, useRef, useState } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";
import { Lightbulb } from "lucide-react";
import { fmt, coinName } from "../api";
import { useCurrency } from "../currency";
import { CONTEXT_TIPS } from "../content";
import AssetIcon from "./AssetIcon";
import CollapseBtn from "./CollapseBtn";
import { api } from "../api";

const INTERVALS = [
  { v: "15m", label: "15m" },
  { v: "1h", label: "1h" },
  { v: "4h", label: "4h" },
  { v: "1d", label: "1D" },
];

const UP = "#16a34a";
const DOWN = "#e11d48";

export default function PriceChart({ symbol, interval, onInterval, ticker, livePrice, collapsed, onToggleCollapse }) {
  const { price, compact, rate } = useCurrency();
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleRef = useRef(null);
  const volRef = useRef(null);
  const lastCandleRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: "solid", color: "transparent" },
        textColor: "#64748b",
        fontFamily: "Inter, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(15,23,42,0.05)" },
        horzLines: { color: "rgba(15,23,42,0.05)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(15,23,42,0.08)" },
      timeScale: { borderColor: "rgba(15,23,42,0.08)", timeVisible: true, secondsVisible: false },
      autoSize: true,
    });
    const candle = chart.addCandlestickSeries({
      upColor: UP, downColor: DOWN,
      borderUpColor: UP, borderDownColor: DOWN,
      wickUpColor: UP, wickDownColor: DOWN,
    });
    const vol = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: "rgba(99,102,241,0.25)",
    });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    chartRef.current = chart;
    candleRef.current = candle;
    volRef.current = vol;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .klines(symbol, interval, 300)
      .then((candles) => {
        if (cancelled || !candleRef.current) return;
        candleRef.current.setData(
          candles.map((c) => ({
            time: c.time, open: c.open * rate, high: c.high * rate, low: c.low * rate, close: c.close * rate,
          }))
        );
        volRef.current.setData(
          candles.map((c) => ({
            time: c.time,
            value: c.volume,
            color: c.close >= c.open ? "rgba(22,163,74,0.28)" : "rgba(225,29,72,0.28)",
          }))
        );
        lastCandleRef.current = candles[candles.length - 1];
        chartRef.current.timeScale().fitContent();
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, interval, rate]);

  useEffect(() => {
    if (!livePrice || !candleRef.current || !lastCandleRef.current) return;
    const last = lastCandleRef.current;
    const newHigh = Math.max(last.high, livePrice);
    const newLow = Math.min(last.low, livePrice);
    lastCandleRef.current = { ...last, high: newHigh, low: newLow, close: livePrice };
    candleRef.current.update({
      time: last.time, open: last.open * rate, high: newHigh * rate, low: newLow * rate, close: livePrice * rate,
    });
  }, [livePrice, rate]);

  // Al desplegar, reajustar el gráfico (estuvo oculto)
  useEffect(() => {
    if (!collapsed && chartRef.current) {
      setTimeout(() => chartRef.current && chartRef.current.timeScale().fitContent(), 60);
    }
  }, [collapsed]);

  const up = (ticker?.changePercent ?? 0) >= 0;

  return (
    <div className={`card flex flex-col overflow-hidden ${collapsed ? "" : "h-full"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
        <div className="flex items-center gap-3">
          <AssetIcon symbol={symbol} size={44} />
          <div>
            <h2 className="text-lg font-bold text-slate-900">{coinName(symbol)}</h2>
            <span className="text-xs text-slate-400">{symbol.replace("USDT", "")}{symbol.endsWith("USDT") ? "/USDT" : ""}</span>
          </div>
          <div className="ml-2 flex items-baseline gap-2">
            <span className="num text-2xl font-bold text-slate-900">{price(livePrice || ticker?.price)}</span>
            <span
              className={`num rounded-md px-1.5 py-0.5 text-sm font-semibold ${
                up ? "bg-up-soft text-up" : "bg-down-soft text-down"
              }`}
            >
              {fmt.pct(ticker?.changePercent)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!collapsed && (
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {INTERVALS.map((it) => (
                <button
                  key={it.v}
                  onClick={() => onInterval(it.v)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    interval === it.v ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {it.label}
                </button>
              ))}
            </div>
          )}
          <CollapseBtn collapsed={collapsed} onToggle={onToggleCollapse} />
        </div>
      </div>

      {ticker && !collapsed && (
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 text-center">
          <Stat label="Máx. 24h" value={price(ticker.high)} />
          <Stat label="Mín. 24h" value={price(ticker.low)} />
          <Stat label="Volumen 24h" value={compact(ticker.volume)} />
        </div>
      )}

      <div className={`relative flex-1 ${collapsed ? "hidden" : ""}`}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 text-sm text-slate-400">
            Cargando gráfico…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6 text-center text-sm text-down">
            No se pudo cargar el gráfico: {error}
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {!collapsed && (
        <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> {CONTEXT_TIPS.chart.replace("💡 ", "")}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="num text-sm font-semibold text-slate-700">{value}</div>
    </div>
  );
}
