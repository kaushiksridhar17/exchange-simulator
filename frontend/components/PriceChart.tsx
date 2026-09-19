"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CandlestickSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { buildCandles } from "@/lib/candles";
import type { Trade } from "@/lib/types";

interface Props {
  symbol: string;
  trades: Trade[];
}

export function PriceChart({ symbol, trades }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const candles = useMemo(() => buildCandles(trades), [trades]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const chart = createChart(container, {
      layout: {
        background: { color: "transparent" },
        textColor: "#64748b",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      rightPriceScale: { borderColor: "#1e293b" },
      timeScale: {
        borderColor: "#1e293b",
        timeVisible: true,
        secondsVisible: true,
      },
      localization: {
        timeFormatter: (time: number) =>
          new Date(time * 1000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
      },
      crosshair: { mode: 0 },
      height: 320,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderUpColor: "#10b981",
      borderDownColor: "#f43f5e",
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) {
        chart.applyOptions({ width });
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) {
      return;
    }

    const data: CandlestickData[] = candles.map((candle) => ({
      time: candle.time as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    series.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  useEffect(() => {
    seriesRef.current?.setData([]);
  }, [symbol]);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xs uppercase tracking-widest text-slate-500">
          {symbol} price
        </h2>
        <span className="font-mono text-xs text-slate-600">5s candles</span>
      </div>
      <div className="relative">
        <div ref={containerRef} className="w-full" />
        {candles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-600">
            Waiting for trades
          </div>
        )}
      </div>
    </div>
  );
}